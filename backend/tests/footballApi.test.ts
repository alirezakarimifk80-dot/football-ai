import assert from 'node:assert/strict';
import { CacheManager } from '../src/cache/cacheManager.ts';
import { ApiFootballProvider } from '../src/providers/apiFootball/apiFootballProvider.ts';
import {
  normalizeApiFootballEvent,
  normalizeApiFootballFixture,
  normalizeApiFootballLineup,
  normalizeApiFootballPlayer,
  normalizeApiFootballStandings,
  normalizeApiFootballStatistics,
  normalizeApiFootballTeamProfile,
} from '../src/providers/apiFootball/normalizer.ts';
import { LiveScoreEngine } from '../src/schedulers/liveScoreEngine.ts';
import { FootballDataService } from '../src/services/footballDataService.ts';
import { ResilientProviderHttpClient } from '../src/utils/httpClient.ts';
import { QuotaTracker } from '../src/utils/quotaTracker.ts';
import { normalizeMatchPhase, phaseToBucket } from '../src/utils/statusMapper.ts';

async function runTests() {
  const results: string[] = [];

  // 1. Test missing API key connection behavior (must report connected: false honestly)
  {
    const prevKey = process.env.API_FOOTBALL_KEY;
    const prevLegacy = process.env.FOOTBALL_API_KEY;
    delete process.env.API_FOOTBALL_KEY;
    delete process.env.FOOTBALL_API_KEY;

    const provider = new ApiFootballProvider();
    const conn = await provider.testConnection();
    assert.equal(conn.connected, false, 'Unconfigured provider must not claim connected');
    assert.ok(conn.error && conn.error.includes('API_FOOTBALL_KEY'));
    results.push('PASS: Unconfigured API connection test returns honest disconnected status');

    if (prevKey) process.env.API_FOOTBALL_KEY = prevKey;
    if (prevLegacy) process.env.FOOTBALL_API_KEY = prevLegacy;
  }

  // 2. Test HTTP 429 rate-limit detection & automatic backoff
  {
    const tracker = new QuotaTracker(100, 10, 5);
    const mock429Fetch: typeof fetch = async () =>
      new Response(JSON.stringify({ errors: { rateLimit: 'Too many requests' } }), {
        status: 429,
        headers: { 'retry-after': '30', 'x-ratelimit-requests-remaining': '0' },
      });

    const client = new ResilientProviderHttpClient({
      baseUrl: 'https://v3.football.api-sports.io',
      headers: { 'x-apisports-key': 'test-key-only' },
      timeoutMs: 2000,
      maxRetries: 0,
      quotaTracker: tracker,
      fetchImpl: mock429Fetch,
    });

    await assert.rejects(() => client.getJson('/fixtures', { live: 'all' }), /HTTP 429/);
    const snap = tracker.getSnapshot();
    assert.equal(snap.isBackoffActive, true, 'Backoff must activate on 429');
    assert.equal(tracker.canMakeRequest('normal').allowed, false, 'Requests blocked during backoff');
    results.push('PASS: HTTP 429 triggers automatic backoff and blocks subsequent requests');
  }

  // 3. Test SSRF host allowlist enforcement
  {
    const tracker = new QuotaTracker(100, 10, 5);
    assert.throws(
      () =>
        new ResilientProviderHttpClient({
          baseUrl: 'http://169.254.169.254',
          headers: {},
          timeoutMs: 1000,
          maxRetries: 0,
          quotaTracker: tracker,
        }),
      /Blocked outbound provider host/
    );
    results.push('PASS: Outbound HTTP client rejects non-allowlisted / metadata hosts');
  }

  // 4. Test shared cache & in-flight request deduplication
  {
    const cache = new CacheManager(50);
    let upstreamCalls = 0;
    const slowFetcher = async () => {
      upstreamCalls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true };
    };

    const [a, b, c] = await Promise.all([
      cache.getOrFetch('live:all', 45, slowFetcher),
      cache.getOrFetch('live:all', 45, slowFetcher),
      cache.getOrFetch('live:all', 45, slowFetcher),
    ]);
    assert.equal(upstreamCalls, 1, 'Concurrent requests must deduplicate into 1 upstream call');
    assert.equal(a.cached, false);
    assert.equal(b.cached, true);
    assert.equal(c.cached, true);
    assert.equal(cache.getStats().inFlightDeduplicated, 2);
    results.push('PASS: Shared cache deduplicates concurrent user requests (3 -> 1 upstream call)');
  }

  // 5. Test missing, null, and invalid API payload normalization
  {
    assert.equal(normalizeApiFootballFixture({}), null);
    assert.equal(normalizeApiFootballEvent({}, 0), null);

    const fixture = normalizeApiFootballFixture({
      fixture: {
        id: 1208411,
        date: '2026-11-22T18:00:00+00:00',
        status: { short: 'PST', long: 'Match Postponed', elapsed: null },
      },
      league: { id: 39, name: 'Premier League', country: 'England', season: 2026 },
      teams: { home: { id: 42, name: 'Arsenal' }, away: { id: 50, name: 'Man City' } },
      goals: { home: null, away: null },
    });
    assert.ok(fixture);
    assert.equal(fixture.providerId, '1208411');
    assert.equal(fixture.phase, 'PST');
    assert.equal(fixture.bucket, 'POSTPONED');
    assert.equal(fixture.goals.home, null);

    // Missing expected_goals stays null (never fabricated!)
    const stats = normalizeApiFootballStatistics({
      team: { id: 42, name: 'Arsenal' },
      statistics: [
        { type: 'Ball Possession', value: '58%' },
        { type: 'Total Shots', value: 12 },
        { type: 'expected_goals', value: null },
      ],
    });
    assert.ok(stats);
    assert.equal(stats.possession, 58);
    assert.equal(stats.expectedGoals, null, 'Unavailable xG must remain null');
    assert.equal(stats.offsides, null, 'Missing stat must remain null');

    // Lineup handles missing coach/substitutes safely
    const lineup = normalizeApiFootballLineup({
      team: { id: 42, name: 'Arsenal' },
      formation: '4-3-3',
      startXI: [{ player: { id: 1, name: 'D. Raya', number: 22, pos: 'G' } }],
      substitutes: [],
    });
    assert.ok(lineup);
    assert.equal(lineup.startXI.length, 1);
    assert.equal(lineup.coach.name, null);

    // Status mapping covers postponed, cancelled, extra time, penalties
    assert.equal(phaseToBucket(normalizeMatchPhase('CANC')), 'CANCELLED');
    assert.equal(phaseToBucket(normalizeMatchPhase('ET')), 'LIVE');
    assert.equal(phaseToBucket(normalizeMatchPhase('PEN')), 'FT');
    results.push('PASS: Defensive normalization handles missing/invalid fields without fabricating data');
  }

  // 6. Test Live Score Engine synchronization (goal, score correction, event dedup, idle stop)
  {
    const service = new FootballDataService({ cache: new CacheManager(20) });
    const engine = new LiveScoreEngine(service);

    const baseFixture = normalizeApiFootballFixture({
      fixture: { id: 9001, date: '2026-11-22T18:00:00Z', status: { short: '1H', elapsed: 30 } },
      league: { id: 39, name: 'Premier League', country: 'England', season: 2026 },
      teams: { home: { id: 42, name: 'Arsenal' }, away: { id: 50, name: 'Man City' } },
      goals: { home: 0, away: 0 },
    })!;

    // First sync seeds state
    engine.processSnapshot([baseFixture], new Map());

    // Second sync: Home scores + Yellow card event
    const goalFixture = { ...baseFixture, elapsed: 35, goals: { home: 1, away: 0 } };
    const cardEvent = normalizeApiFootballEvent(
      {
        time: { elapsed: 34 },
        team: { id: 50, name: 'Man City' },
        player: { id: 16, name: 'Rodri' },
        type: 'Card',
        detail: 'Yellow Card',
      },
      0
    )!;

    const deltas1 = engine.processSnapshot([goalFixture], new Map([['9001', [cardEvent]]]));
    assert.ok(deltas1.some((d) => d.type === 'goal'), 'Should detect new goal');
    assert.ok(deltas1.some((d) => d.type === 'card'), 'Should detect yellow card');

    // Third sync: Same card event repeated must be deduplicated, and VAR disallows goal -> score_corrected
    const correctedFixture = { ...goalFixture, elapsed: 37, goals: { home: 0, away: 0 } };
    const deltas2 = engine.processSnapshot([correctedFixture], new Map([['9001', [cardEvent]]]));
    assert.equal(
      deltas2.filter((d) => d.type === 'card').length,
      0,
      'Duplicate card event must not re-emit'
    );
    assert.ok(
      deltas2.some((d) => d.type === 'score_corrected'),
      'Decreased score must emit score_corrected'
    );

    // Fourth sync: 0 live matches removes fixture from active state
    const deltas3 = engine.processSnapshot([], new Map());
    assert.equal(engine.getCurrentLiveFixtures().length, 0);
    assert.ok(deltas3.some((d) => d.type === 'status_change'));

    // Provider switch guard: unverified scaffold provider cannot be activated
    const switchRes = service.selectProvider('sportmonks');
    assert.equal(switchRes.switched, false);

    results.push('PASS: Live Score Engine detects goals, score corrections, deduplicates events, and guards unverified providers');
  }

  // 7. Test team.logo extraction and URL sanitization across API-Football normalizers
  {
    const fixtureWithLogos = normalizeApiFootballFixture({
      fixture: { id: 9910, date: '2026-11-22T18:00:00Z', status: { short: '1H', elapsed: 12 } },
      league: {
        id: 39,
        name: 'Premier League',
        country: 'England',
        logo: 'http://media.api-sports.io/football/leagues/39.png',
        season: 2026,
      },
      teams: {
        home: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
        away: { id: 50, name: 'Man City', logo: 'javascript:alert(1)' },
      },
      goals: { home: 1, away: 0 },
    })!;

    assert.equal(fixtureWithLogos.league.logo, 'https://media.api-sports.io/football/leagues/39.png');
    assert.equal(fixtureWithLogos.homeTeam.logo, 'https://media.api-sports.io/football/teams/42.png');
    assert.equal(fixtureWithLogos.awayTeam.logo, null, 'Unsafe non-HTTP logo URL must normalize to null');

    const ev = normalizeApiFootballEvent(
      {
        time: { elapsed: 12 },
        team: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
        player: { id: 7, name: 'B. Saka' },
        type: 'Goal',
        detail: 'Normal Goal',
      },
      0
    )!;
    assert.equal(ev.teamLogo, 'https://media.api-sports.io/football/teams/42.png');

    const statsWithLogo = normalizeApiFootballStatistics({
      team: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
      statistics: [{ type: 'Ball Possession', value: '55%' }],
    })!;
    assert.equal(statsWithLogo.teamLogo, 'https://media.api-sports.io/football/teams/42.png');

    const standings = normalizeApiFootballStandings([
      {
        league: {
          standings: [
            [
              {
                rank: 1,
                team: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
                points: 32,
                goalsDiff: 20,
              },
            ],
          ],
        },
      },
    ]);
    assert.equal(standings[0]?.teamLogo, 'https://media.api-sports.io/football/teams/42.png');

    const profile = normalizeApiFootballTeamProfile({
      team: { id: 2742, name: 'Persepolis', logo: 'https://media.api-sports.io/football/teams/2742.png' },
    })!;
    assert.equal(profile.logo, 'https://media.api-sports.io/football/teams/2742.png');

    const player = normalizeApiFootballPlayer({
      player: { id: 10, name: 'B. Saka', photo: 'https://media.api-sports.io/football/players/1460.png' },
      statistics: [
        { team: { id: 42, name: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' } },
      ],
    })!;
    assert.equal(player.teamLogo, 'https://media.api-sports.io/football/teams/42.png');

    results.push('PASS: API-Football normalizers extract and validate team.logo across fixtures, events, stats, standings, profiles, and players');
  }

  for (const line of results) {
    console.log(line);
  }
  console.log(`\nALL ${results.length} VERIFICATION SUITES PASSED.`);
}

runTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
