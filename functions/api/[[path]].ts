import {
  clearRealFootballCache,
  getRealBootstrapData,
  getRealMatchById,
  getRealMatches,
} from '../../server/liveRealFootballService.ts';
import {
  getPastMatchesArchive,
  VALID_ARCHIVE_LEAGUE_IDS,
} from '../../server/pastMatchesService.ts';
import type {
  AIAskResponse,
  AIMatchAnalysisResponse,
  AIPlayerCompareResponse,
  AIWinProbabilityPoint,
  AIWinProbabilityResponse,
  ApiEnvelope,
  Language,
  NewsArticle,
} from '../../src/types/football.ts';

interface CloudflareEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  API_FOOTBALL_KEY?: string;
}

interface PagesFunctionContext {
  request: Request;
  env: CloudflareEnv;
  params: { path?: string | string[] };
}

const LIVE_DISCLAIMER = {
  en: 'Live Real-Time Feed — Real fixtures, scores, league tables, lineups, and football news synced from live providers.',
  fa: 'داده‌های واقعی و زنده — نتایج مسابقات، جدول لیگ‌ها، ترکیب تیم‌ها و اخبار واقعی فوتبال به‌صورت زنده همگام‌سازی می‌شوند.',
};

const ALLOWED_NEWS_CATEGORIES: NewsArticle['category'][] = [
  'tactics',
  'transfers',
  'match-report',
  'analytics',
];

const editorialNewsStore: NewsArticle[] = [];
let aiRequestsCount = 0;

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders ?? {}),
    },
  });
}

function wrapLiveEnvelope<T>(data: T): ApiEnvelope<T> {
  return {
    dataSource: 'live',
    disclaimer: LIVE_DISCLAIMER,
    lastSyncedAt: new Date().toISOString(),
    data,
  };
}

function parseLanguage(val: unknown): Language {
  return val === 'fa' ? 'fa' : 'en';
}

function hasValidKey(raw: string | undefined, placeholder: string): boolean {
  const key = (raw ?? '').trim();
  return Boolean(key && key !== placeholder);
}

function languageInstruction(lang: Language): string {
  return lang === 'fa'
    ? 'Respond completely in natural, professional Persian (Farsi) football journalism and tactical terminology. Keep standard football acronyms like xG or formations (4-3-3) clear.'
    : 'Respond in crisp, authoritative English football tactical analysis terminology.';
}

async function callGeminiJson(params: {
  env: CloudflareEnv;
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
}): Promise<{ parsed: any; modelUsed: string }> {
  const apiKey = (params.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured in Cloudflare Pages Settings > Environment Variables.'
    );
  }

  const rawModel = (params.env.GEMINI_MODEL ?? 'gemini-4-hydrogen').trim();
  const model = /^[a-zA-Z0-9._-]{3,64}$/.test(rawModel) ? rawModel : 'gemini-4-hydrogen';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: params.systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API request failed (${res.status}): ${errText.slice(0, 180)}`);
  }

  const payload = (await res.json()) as any;
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  aiRequestsCount += 1;
  return { parsed: JSON.parse(String(text).trim() || '{}'), modelUsed: model };
}

async function readJsonBody(request: Request): Promise<Record<string, any>> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 100_000) {
    throw new Error('Request payload too large');
  }
  const text = await request.text();
  if (text.length > 100_000) {
    throw new Error('Request payload too large');
  }
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

export const onRequest = async (context: PagesFunctionContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, '') || '/api';

  // Health check
  if (method === 'GET' && pathname === '/api/health') {
    return jsonResponse({ ok: true, runtime: 'cloudflare-pages', timestamp: new Date().toISOString() });
  }

  // System capabilities
  if (method === 'GET' && pathname === '/api/system/capabilities') {
    let liveFixturesCount = 0;
    let newsCount = editorialNewsStore.length;
    try {
      const snap = await getRealBootstrapData();
      liveFixturesCount = snap.matches.length;
      newsCount += snap.news.length;
    } catch {
      // Keep counts at 0 if upstream temporarily unreachable
    }

    return jsonResponse({
      dataSource: 'live',
      geminiConfigured: hasValidKey(env.GEMINI_API_KEY, 'MY_GEMINI_API_KEY'),
      externalFootballApiConfigured: true,
      apiFootballKeyConfigured: hasValidKey(env.API_FOOTBALL_KEY, 'MY_API_FOOTBALL_KEY'),
      capacitorReady: true,
      serverTime: new Date().toISOString(),
      aiRequestsCount,
      demoFixturesCount: liveFixturesCount,
      newsCount,
    });
  }

  // Full live bootstrap (7 global leagues + Iran Persian Gulf Pro League)
  if (method === 'GET' && pathname === '/api/football/bootstrap') {
    try {
      if (url.searchParams.get('refresh') === '1') {
        clearRealFootballCache();
      }
      const realData = await getRealBootstrapData();
      const mergedNews = [...editorialNewsStore, ...realData.news];
      return jsonResponse(
        wrapLiveEnvelope({
          leagues: realData.leagues,
          teams: realData.teams,
          players: realData.players,
          matches: realData.matches,
          news: mergedNews,
          standingsByLeague: realData.standingsByLeague,
        }),
        200,
        url.searchParams.get('refresh') === '1'
          ? { 'Cache-Control': 'no-store' }
          : { 'Cache-Control': 'public, max-age=20, s-maxage=45' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch live football data';
      return jsonResponse({ error: msg }, 503);
    }
  }

  // Live matches list
  if (method === 'GET' && pathname === '/api/football/matches') {
    try {
      if (url.searchParams.get('refresh') === '1') {
        clearRealFootballCache();
      }
      const matches = await getRealMatches();
      return jsonResponse(
        wrapLiveEnvelope(matches),
        200,
        url.searchParams.get('refresh') === '1'
          ? { 'Cache-Control': 'no-store' }
          : { 'Cache-Control': 'public, max-age=15, s-maxage=30' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch live matches';
      return jsonResponse({ error: msg }, 503);
    }
  }

  // Previous / archived matches across all 8 leagues
  if (method === 'GET' && pathname === '/api/football/past-matches') {
    try {
      const rawLeague = (url.searchParams.get('league') ?? 'all').trim();
      if (!VALID_ARCHIVE_LEAGUE_IDS.has(rawLeague)) {
        return jsonResponse({ error: 'Invalid league filter' }, 400);
      }
      if (url.searchParams.get('refresh') === '1') {
        clearRealFootballCache();
      }
      const archive = await getPastMatchesArchive(rawLeague);
      return jsonResponse(
        wrapLiveEnvelope(archive),
        200,
        url.searchParams.get('refresh') === '1'
          ? { 'Cache-Control': 'no-store' }
          : { 'Cache-Control': 'public, max-age=120, s-maxage=300' }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch previous matches archive';
      return jsonResponse({ error: msg }, 503);
    }
  }

  // Single match detail hydration (Match Center)
  if (method === 'GET' && pathname.startsWith('/api/football/matches/')) {
    try {
      const rawId = decodeURIComponent(pathname.slice('/api/football/matches/'.length)).trim();
      const match = await getRealMatchById(rawId);
      if (!match) {
        return jsonResponse({ error: 'Match not found' }, 404);
      }
      return jsonResponse(wrapLiveEnvelope(match));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load match details';
      return jsonResponse({ error: msg }, 503);
    }
  }

  // Force live cache refresh from Admin
  if (method === 'POST' && pathname === '/api/admin/matches/refresh') {
    try {
      clearRealFootballCache();
      const matches = await getRealMatches();
      return jsonResponse(wrapLiveEnvelope(matches));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to refresh live feed';
      return jsonResponse({ error: msg }, 503);
    }
  }

  // Editorial news brief publisher
  if (method === 'POST' && pathname === '/api/admin/news') {
    try {
      const body = await readJsonBody(request);
      const { category, titleEn, titleFa, summaryEn, summaryFa } = body;
      if (
        typeof category !== 'string' ||
        !ALLOWED_NEWS_CATEGORIES.includes(category as NewsArticle['category'])
      ) {
        return jsonResponse({ error: 'Invalid news category' }, 400);
      }
      const cleanTitleEn = typeof titleEn === 'string' ? titleEn.trim().slice(0, 140) : '';
      const cleanTitleFa = typeof titleFa === 'string' ? titleFa.trim().slice(0, 140) : '';
      const cleanSummaryEn = typeof summaryEn === 'string' ? summaryEn.trim().slice(0, 320) : '';
      const cleanSummaryFa = typeof summaryFa === 'string' ? summaryFa.trim().slice(0, 320) : '';

      if (!cleanTitleEn || !cleanSummaryEn) {
        return jsonResponse({ error: 'English headline and summary are required' }, 400);
      }

      const article: NewsArticle = {
        id: `editorial-${Date.now()}`,
        category: category as NewsArticle['category'],
        title: { en: cleanTitleEn, fa: cleanTitleFa || cleanTitleEn },
        summary: { en: cleanSummaryEn, fa: cleanSummaryFa || cleanSummaryEn },
        body: { en: cleanSummaryEn, fa: cleanSummaryFa || cleanSummaryEn },
        author: { en: 'Football AI Editorial Desk', fa: 'تحریریه Football AI' },
        publishedAt: 'Just now',
        readTimeMin: 3,
        imageUrl: '/src/assets/images/news_scouting_analytics_1795373660766.jpg',
      };

      editorialNewsStore.unshift(article);
      return jsonResponse(wrapLiveEnvelope(article), 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid request payload';
      return jsonResponse({ error: msg }, 400);
    }
  }

  // AI Match Tactical Analysis
  if (method === 'POST' && pathname === '/api/ai/analyze-match') {
    try {
      const body = await readJsonBody(request);
      const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
      const lang = parseLanguage(body.lang);

      const [match, snap] = await Promise.all([getRealMatchById(matchId), getRealBootstrapData()]);
      if (!match) {
        return jsonResponse({ error: 'Match not found for analysis' }, 404);
      }
      let homeTeam = snap.teams.find((t) => t.id === match.homeTeamId);
      let awayTeam = snap.teams.find((t) => t.id === match.awayTeamId);
      if (!homeTeam || !awayTeam) {
        const archive = await getPastMatchesArchive(match.leagueId).catch(() => null);
        homeTeam = homeTeam ?? archive?.teams.find((t) => t.id === match.homeTeamId);
        awayTeam = awayTeam ?? archive?.teams.find((t) => t.id === match.awayTeamId);
      }
      const league = snap.leagues.find((l) => l.id === match.leagueId);
      if (!homeTeam || !awayTeam || !league) {
        return jsonResponse({ error: 'Incomplete match entities' }, 400);
      }

      const prompt = `Analyze this real football match using ONLY the provided live telemetry:
Competition: ${league.name.en} (${match.round.en})
Fixture: ${homeTeam.name.en} (${match.lineups.homeFormation}) vs ${awayTeam.name.en} (${match.lineups.awayFormation})
Status: ${match.status}${match.minute ? ` (${match.minute}')` : ''}
Score: ${match.homeScore ?? '-'} - ${match.awayScore ?? '-'}
Stats (Home vs Away):
- Possession: ${match.stats.possession[0]}% vs ${match.stats.possession[1]}%
- Total Shots: ${match.stats.totalShots[0]} vs ${match.stats.totalShots[1]}
- Shots on Target: ${match.stats.shotsOnTarget[0]} vs ${match.stats.shotsOnTarget[1]}
- Corners: ${match.stats.corners[0]} vs ${match.stats.corners[1]}
- Fouls: ${match.stats.fouls[0]} vs ${match.stats.fouls[1]}
- Key Events: ${match.events.map((e) => `${e.minute}' ${e.type} ${e.playerName.en} (${e.teamSide})`).join('; ') || 'Pre-match'}
- Win Probability: Home ${match.winProbability.home}% / Draw ${match.winProbability.draw}% / Away ${match.winProbability.away}%`;

      const { parsed, modelUsed } = await callGeminiJson({
        env,
        systemInstruction: `You are Football AI's senior tactical analyst. Provide sharp, grounded football analysis based strictly on the provided live telemetry without inventing events that did not occur. ${languageInstruction(lang)}`,
        prompt,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            headline: { type: 'STRING' },
            tacticalSummary: { type: 'STRING' },
            keyBattle: { type: 'STRING' },
            momentumInsight: { type: 'STRING' },
            predictedEdge: { type: 'STRING' },
            tacticalBullets: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: [
            'headline',
            'tacticalSummary',
            'keyBattle',
            'momentumInsight',
            'predictedEdge',
            'tacticalBullets',
          ],
        },
      });

      const response: AIMatchAnalysisResponse = {
        headline: parsed.headline ?? '',
        tacticalSummary: parsed.tacticalSummary ?? '',
        keyBattle: parsed.keyBattle ?? '',
        momentumInsight: parsed.momentumInsight ?? '',
        predictedEdge: parsed.predictedEdge ?? '',
        tacticalBullets: Array.isArray(parsed.tacticalBullets) ? parsed.tacticalBullets : [],
        modelUsed,
        generatedAt: new Date().toISOString(),
      };
      return jsonResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI analysis failed';
      return jsonResponse({ error: msg }, 502);
    }
  }

  // AI Live Win Probability Timeline
  if (method === 'POST' && pathname === '/api/ai/win-probability') {
    try {
      const body = await readJsonBody(request);
      const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
      const lang = parseLanguage(body.lang);
      if (!matchId) {
        return jsonResponse({ error: 'matchId is required' }, 400);
      }

      const [match, snap] = await Promise.all([getRealMatchById(matchId), getRealBootstrapData()]);
      if (!match) {
        return jsonResponse({ error: 'Match not found for win probability modeling' }, 404);
      }
      let homeTeam = snap.teams.find((t) => t.id === match.homeTeamId);
      let awayTeam = snap.teams.find((t) => t.id === match.awayTeamId);
      if (!homeTeam || !awayTeam) {
        const archive = await getPastMatchesArchive(match.leagueId).catch(() => null);
        homeTeam = homeTeam ?? archive?.teams.find((t) => t.id === match.homeTeamId);
        awayTeam = awayTeam ?? archive?.teams.find((t) => t.id === match.awayTeamId);
      }
      const league = snap.leagues.find((l) => l.id === match.leagueId);
      if (!homeTeam || !awayTeam || !league) {
        return jsonResponse({ error: 'Incomplete match entities' }, 400);
      }

      const table = snap.standingsByLeague[match.leagueId] ?? [];
      const homeRow = table.find((r) => r.teamId === homeTeam.id);
      const awayRow = table.find((r) => r.teamId === awayTeam.id);
      const endMinute =
        match.status === 'FT'
          ? Math.max(90, ...match.events.map((e) => e.minute))
          : match.status === 'HT'
            ? 45
            : match.status === 'LIVE'
              ? Math.max(1, match.minute ?? 1)
              : 0;

      const eventsText =
        match.events
          .slice()
          .sort((a, b) => a.minute - b.minute)
          .map((e) => `${e.minute}' [${e.teamSide.toUpperCase()}] ${e.type.toUpperCase()} - ${e.playerName.en}`)
          .join('\n') || 'None yet.';

      const prompt = `Build a realistic minute-by-minute Win Probability timeline using ONLY the provided match events, live stats, and historical performance.
Competition: ${league.name.en} (${match.round.en})
Match: ${homeTeam.name.en} vs ${awayTeam.name.en} | Status: ${match.status}${match.minute ? ` (${match.minute}')` : ''} | Score: ${match.homeScore ?? 0}-${match.awayScore ?? 0}
Home Standing: ${homeRow ? `#${homeRow.rank} (${homeRow.won}W-${homeRow.drawn}D-${homeRow.lost}L, ${homeRow.points} pts, Form ${homeRow.form.join('-')})` : `${homeTeam.seasonStats.points} pts`}
Away Standing: ${awayRow ? `#${awayRow.rank} (${awayRow.won}W-${awayRow.drawn}D-${awayRow.lost}L, ${awayRow.points} pts, Form ${awayRow.form.join('-')})` : `${awayTeam.seasonStats.points} pts`}
H2H: Home ${match.h2h.homeWins}W, ${match.h2h.draws}D, Away ${match.h2h.awayWins}W
Stats: Possession ${match.stats.possession[0]}%-${match.stats.possession[1]}%, Shots ${match.stats.totalShots[0]}-${match.stats.totalShots[1]}, On Target ${match.stats.shotsOnTarget[0]}-${match.stats.shotsOnTarget[1]}
Events:\n${eventsText}
Return 6-14 chronological points from minute 0 to ${endMinute} (if UPCOMING, use checkpoints 0,15,45,75,90). Every point must sum homeWin+draw+awayWin=100. Include exact points at goals/red cards with short eventLabel. Never invent events.`;

      const { parsed, modelUsed } = await callGeminiJson({
        env,
        systemInstruction: `You are Football AI's quantitative match probability modeler. Produce calibrated win/draw/away probability curves grounded in real match events and historical standings/form. ${languageInstruction(lang)}`,
        prompt,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            timeline: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  minute: { type: 'INTEGER' },
                  homeWin: { type: 'NUMBER' },
                  draw: { type: 'NUMBER' },
                  awayWin: { type: 'NUMBER' },
                  eventLabel: { type: 'STRING' },
                },
                required: ['minute', 'homeWin', 'draw', 'awayWin'],
              },
            },
            turningPointSummary: { type: 'STRING' },
            historicalEdgeNote: { type: 'STRING' },
            keyDrivers: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['timeline', 'turningPointSummary', 'historicalEdgeNote', 'keyDrivers'],
        },
      });

      const rawTimeline: any[] = Array.isArray(parsed.timeline) ? parsed.timeline : [];
      const timeline: AIWinProbabilityPoint[] = rawTimeline
        .map((pt) => {
          const h = Math.max(0, Number(pt?.homeWin ?? 0) || 0);
          const d = Math.max(0, Number(pt?.draw ?? 0) || 0);
          const a = Math.max(0, Number(pt?.awayWin ?? 0) || 0);
          const sum = h + d + a || 100;
          const homeWin = Math.round((h / sum) * 100);
          const awayWin = Math.round((a / sum) * 100);
          const draw = Math.max(0, 100 - homeWin - awayWin);
          const label = typeof pt?.eventLabel === 'string' && pt.eventLabel.trim() ? pt.eventLabel.trim().slice(0, 72) : undefined;
          return {
            minute: Math.max(0, Math.min(125, Math.round(Number(pt?.minute ?? 0)))),
            homeWin,
            draw,
            awayWin,
            ...(label ? { eventLabel: label } : {}),
          };
        })
        .sort((a, b) => a.minute - b.minute);

      if (match.status === 'FT' && match.homeScore !== null && match.awayScore !== null && timeline.length > 0) {
        const last = timeline[timeline.length - 1];
        if (match.homeScore > match.awayScore) {
          timeline[timeline.length - 1] = { ...last, homeWin: 100, draw: 0, awayWin: 0 };
        } else if (match.awayScore > match.homeScore) {
          timeline[timeline.length - 1] = { ...last, homeWin: 0, draw: 0, awayWin: 100 };
        } else {
          timeline[timeline.length - 1] = { ...last, homeWin: 0, draw: 100, awayWin: 0 };
        }
      }

      const lastPt = timeline[timeline.length - 1] ?? {
        homeWin: match.winProbability.home,
        draw: match.winProbability.draw,
        awayWin: match.winProbability.away,
      };

      const response: AIWinProbabilityResponse = {
        current: { homeWin: lastPt.homeWin, draw: lastPt.draw, awayWin: lastPt.awayWin },
        timeline,
        turningPointSummary: typeof parsed.turningPointSummary === 'string' ? parsed.turningPointSummary : '',
        historicalEdgeNote: typeof parsed.historicalEdgeNote === 'string' ? parsed.historicalEdgeNote : '',
        keyDrivers: Array.isArray(parsed.keyDrivers) ? parsed.keyDrivers.slice(0, 4) : [],
        modelUsed,
        generatedAt: new Date().toISOString(),
      };
      return jsonResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI win probability generation failed';
      return jsonResponse({ error: msg }, 502);
    }
  }

  // AI Player Comparison
  if (method === 'POST' && pathname === '/api/ai/compare-players') {
    try {
      const body = await readJsonBody(request);
      const playerAId = typeof body.playerAId === 'string' ? body.playerAId.trim() : '';
      const playerBId = typeof body.playerBId === 'string' ? body.playerBId.trim() : '';
      const lang = parseLanguage(body.lang);

      if (!playerAId || !playerBId || playerAId === playerBId) {
        return jsonResponse({ error: 'Select two distinct players to compare' }, 400);
      }

      const snap = await getRealBootstrapData();
      const playerA = snap.players.find((p) => p.id === playerAId);
      const playerB = snap.players.find((p) => p.id === playerBId);
      if (!playerA || !playerB) {
        return jsonResponse({ error: 'One or both players not found' }, 404);
      }
      const teamA = snap.teams.find((t) => t.id === playerA.teamId);
      const teamB = snap.teams.find((t) => t.id === playerB.teamId);
      if (!teamA || !teamB) {
        return jsonResponse({ error: 'Team data missing for player' }, 400);
      }

      const prompt = `Compare these two footballers strictly using their current season statistics:
Player A: ${playerA.name.en} (${teamA.name.en}, ${playerA.position}, Age ${playerA.age})
- Rating: ${playerA.rating}, Apps: ${playerA.stats.appearances}, Goals: ${playerA.stats.goals}, Assists: ${playerA.stats.assists}

Player B: ${playerB.name.en} (${teamB.name.en}, ${playerB.position}, Age ${playerB.age})
- Rating: ${playerB.rating}, Apps: ${playerB.stats.appearances}, Goals: ${playerB.stats.goals}, Assists: ${playerB.stats.assists}`;

      const { parsed, modelUsed } = await callGeminiJson({
        env,
        systemInstruction: `You are Football AI's head of recruitment and scouting analytics. Deliver an objective, data-backed head-to-head comparison. ${languageInstruction(lang)}`,
        prompt,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            headline: { type: 'STRING' },
            verdict: { type: 'STRING' },
            playerAStrengths: { type: 'ARRAY', items: { type: 'STRING' } },
            playerBStrengths: { type: 'ARRAY', items: { type: 'STRING' } },
            tacticalFitSummary: { type: 'STRING' },
          },
          required: [
            'headline',
            'verdict',
            'playerAStrengths',
            'playerBStrengths',
            'tacticalFitSummary',
          ],
        },
      });

      const response: AIPlayerCompareResponse = {
        headline: parsed.headline ?? '',
        verdict: parsed.verdict ?? '',
        playerAStrengths: Array.isArray(parsed.playerAStrengths) ? parsed.playerAStrengths : [],
        playerBStrengths: Array.isArray(parsed.playerBStrengths) ? parsed.playerBStrengths : [],
        tacticalFitSummary: parsed.tacticalFitSummary ?? '',
        modelUsed,
        generatedAt: new Date().toISOString(),
      };
      return jsonResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Player comparison failed';
      return jsonResponse({ error: msg }, 502);
    }
  }

  // AI Ask Football Analyst
  if (method === 'POST' && pathname === '/api/ai/ask') {
    try {
      const body = await readJsonBody(request);
      const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';
      const lang = parseLanguage(body.lang);
      if (!rawQuestion || rawQuestion.length < 3 || rawQuestion.length > 600) {
        return jsonResponse({ error: 'Question must be between 3 and 600 characters' }, 400);
      }

      const snap = await getRealBootstrapData();
      const teamById = new Map(snap.teams.map((t) => [t.id, t]));
      const lines = snap.matches.slice(0, 20).map((m) => {
        const home = teamById.get(m.homeTeamId)?.name.en ?? m.homeTeamId;
        const away = teamById.get(m.awayTeamId)?.name.en ?? m.awayTeamId;
        const score =
          m.homeScore !== null && m.awayScore !== null ? `${m.homeScore}-${m.awayScore}` : 'vs';
        return `- ${home} ${score} ${away} [${m.status}${m.minute ? ` ${m.minute}'` : ''}]`;
      });

      const { parsed, modelUsed } = await callGeminiJson({
        env,
        systemInstruction: `You are Football AI's tactical intelligence analyst. Answer football tactics, match telemetry, and player scouting questions concisely and accurately based on real-world football knowledge and the live match context provided. ${languageInstruction(lang)}`,
        prompt: `Live World & Iran Football Context:\n${lines.join('\n')}\n\nUser Question:\n${rawQuestion}`,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            answer: { type: 'STRING' },
            keyTakeaways: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['answer', 'keyTakeaways'],
        },
      });

      const response: AIAskResponse = {
        answer: parsed.answer ?? '',
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
        modelUsed,
        generatedAt: new Date().toISOString(),
      };
      return jsonResponse(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI analyst query failed';
      return jsonResponse({ error: msg }, 502);
    }
  }

  // Graceful SSE heartbeat for /api/v1/football/stream/live on Cloudflare Edge
  if (method === 'GET' && pathname === '/api/v1/football/stream/live') {
    const frame = `event: football_update\ndata: ${JSON.stringify({
      type: 'heartbeat',
      timestampUtc: new Date().toISOString(),
      summary: 'Connected to Cloudflare Pages Edge live football feed',
    })}\n\n`;
    return new Response(frame, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Edge-safe Admin v1 diagnostics matching AdminApiDiagnostics interface
  if (method === 'GET' && pathname === '/api/v1/admin/diagnostics') {
    const hasKey = hasValidKey(env.API_FOOTBALL_KEY, 'MY_API_FOOTBALL_KEY');
    const masked = hasKey
      ? `••••••••${(env.API_FOOTBALL_KEY ?? '').trim().slice(-4)}`
      : 'Not configured';
    const nowIso = new Date().toISOString();
    return jsonResponse({
      activeProvider: 'api-football',
      activeProviderName: 'Live Public Feed (ESPN + Iran PGPL)',
      apiKeyStatus: { configured: hasKey, masked },
      providers: [
        {
          id: 'api-football',
          displayName: 'API-Football v3 (Optional Upgrade)',
          baseUrl: 'https://v3.football.api-sports.io',
          configured: hasKey,
          implemented: true,
          supported: true,
          docsUrl: 'https://www.api-football.com/documentation-v3',
          freeTierNotes:
            'Built-in Live Public Feed (8 leagues + Iran Pro League) is active without requiring a key.',
        },
      ],
      quota: {
        dailyLimit: 100,
        requestsToday: 0,
        remainingToday: 100,
        perMinuteLimit: 10,
        requestsLastMinute: 0,
        reserveBuffer: 5,
        backoffUntilUtc: null,
        lastProviderRemaining: null,
        lastProviderLimit: null,
        recentErrors: [],
        lastRequestAtUtc: nowIso,
      },
      cache: {
        backend: 'memory',
        entries: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        staleServed: 0,
        deduplicatedInflight: 0,
      },
      enabledEndpoints: {
        live: true,
        fixtures: true,
        events: true,
        statistics: true,
        lineups: true,
        h2h: true,
        leagues: true,
        standings: true,
        topScorers: true,
        topAssists: true,
        teams: true,
        players: true,
        coaches: true,
        transfers: true,
        injuries: true,
        predictions: true,
      },
      lastConnectionTest: null,
      liveEngine: {
        pollingState: 'active',
        pollIntervalSec: 45,
        lastPollAtUtc: nowIso,
        nextPollAtUtc: null,
        liveMatchCount: 0,
        connectedClients: 1,
        consecutiveErrors: 0,
        lastError: null,
      },
      serverTimeUtc: nowIso,
    });
  }

  if (method === 'POST' && pathname === '/api/v1/admin/cache/clear') {
    clearRealFootballCache();
    return jsonResponse({ ok: true, clearedEntries: 1 });
  }

  if (method === 'POST' && pathname === '/api/v1/admin/test-connection') {
    const start = Date.now();
    try {
      const snap = await getRealBootstrapData();
      return jsonResponse({
        provider: 'api-football',
        connected: true,
        configured: true,
        plan: `Live Edge Feed (${snap.leagues.length} leagues · ${snap.matches.length} fixtures)`,
        accountName: 'Cloudflare Pages Edge',
        requestsToday: 0,
        dailyLimit: 100,
        remainingToday: 100,
        latencyMs: Date.now() - start,
        testedAtUtc: new Date().toISOString(),
      });
    } catch (err) {
      return jsonResponse({
        provider: 'api-football',
        connected: false,
        configured: false,
        error: err instanceof Error ? err.message : 'Unable to reach live football feed',
        latencyMs: Date.now() - start,
        testedAtUtc: new Date().toISOString(),
      });
    }
  }

  if (method === 'POST' && pathname === '/api/v1/admin/live-engine') {
    return jsonResponse({
      ok: true,
      liveEngine: {
        pollingState: 'active',
        pollIntervalSec: 45,
        lastPollAtUtc: new Date().toISOString(),
        nextPollAtUtc: null,
        liveMatchCount: 0,
        connectedClients: 1,
        consecutiveErrors: 0,
        lastError: null,
      },
    });
  }

  if (method === 'GET' && pathname === '/api/admin/auth/status') {
    return jsonResponse({ mode: 'env' });
  }

  if (method === 'GET' && pathname === '/api/admin/github/status') {
    return jsonResponse({
      availableInRuntime: false,
      tokenConfigured: false,
      tokenSource: null,
      tokenType: null,
      authenticatedUser: null,
      scopes: [],
      rateLimitRemaining: null,
      rateLimitLimit: null,
      defaultOwner: '',
      defaultRepo: 'football-ai',
      defaultBranch: 'main',
      fileCount: 0,
      totalSizeBytes: 0,
      statusNote:
        'Direct GitHub upload runs from the workspace/Node server where project source files live. Cloudflare Pages serves compiled production assets.',
    });
  }

  if (
    (method === 'POST' || method === 'DELETE') &&
    (pathname === '/api/admin/github/push' ||
      pathname === '/api/admin/github/diagnose' ||
      pathname === '/api/admin/github/token')
  ) {
    return jsonResponse(
      {
        error:
          'Direct GitHub source upload and diagnostics are only available in the workspace/Node development server, not inside the deployed Cloudflare Pages runtime.',
      },
      400
    );
  }

  return jsonResponse({ error: `API route not found: ${pathname}` }, 404);
};
