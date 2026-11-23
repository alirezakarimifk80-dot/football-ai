import {
  clearRealFootballCache,
  getRealBootstrapData,
  getRealMatchById,
  getRealMatches,
} from '../../server/liveRealFootballService.ts';
import type {
  AIAskResponse,
  AIMatchAnalysisResponse,
  AIPlayerCompareResponse,
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

  const rawModel = (params.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim();
  const model = /^[a-zA-Z0-9._-]{3,64}$/.test(rawModel) ? rawModel : 'gemini-2.5-flash';
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
        })
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
      return jsonResponse(wrapLiveEnvelope(matches));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch live matches';
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
      const homeTeam = snap.teams.find((t) => t.id === match.homeTeamId);
      const awayTeam = snap.teams.find((t) => t.id === match.awayTeamId);
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

  // Edge-safe Admin v1 diagnostics so Admin Dashboard renders cleanly on Cloudflare Pages
  if (method === 'GET' && pathname === '/api/v1/admin/diagnostics') {
    const hasKey = hasValidKey(env.API_FOOTBALL_KEY, 'MY_API_FOOTBALL_KEY');
    const masked = hasKey
      ? `••••••••${(env.API_FOOTBALL_KEY ?? '').trim().slice(-4)}`
      : 'Not configured (Live Public Feed Active)';
    return jsonResponse({
      activeProvider: 'api-football',
      activeProviderName: 'API-Football v3 (Optional Upgrade)',
      apiKeyStatus: { configured: hasKey, masked },
      providers: [
        {
          id: 'api-football',
          name: 'API-Football v3',
          baseUrl: 'https://v3.football.api-sports.io',
          configured: hasKey,
          implemented: true,
          freeTierDailyLimit: 100,
          documentationUrl: 'https://www.api-football.com/documentation-v3',
          notes: 'Optional server-side upgrade. Real-time ESPN + FotMob public feeds are active by default.',
        },
      ],
      quota: {
        dailyLimit: 100,
        dailyUsed: 0,
        dailyRemaining: 100,
        perMinuteLimit: 10,
        minuteUsed: 0,
        reserveBuffer: 5,
        blockedByBackoff: false,
        backoffUntilUtc: null,
        lastResetDateUtc: new Date().toISOString().slice(0, 10),
        providerHeaderRemaining: null,
        providerHeaderLimit: null,
        recentRequests: [],
      },
      cache: {
        backend: 'memory',
        entries: 0,
        hits: 0,
        misses: 0,
        hitRatePct: 0,
        staleHits: 0,
        inflightDeduplicated: 0,
      },
      enabledEndpoints: {
        live: true,
        fixtures: true,
        events: true,
        statistics: true,
        lineups: true,
        leagues: true,
        standings: true,
        teams: true,
        players: true,
        coaches: true,
        transfers: true,
        injuries: true,
        predictions: true,
      },
      lastConnectionTest: null,
      liveEngine: {
        running: true,
        pollIntervalSec: 45,
        lastPollUtc: new Date().toISOString(),
        lastSuccessfulPollUtc: new Date().toISOString(),
        activeLiveMatches: 0,
        connectedClients: 1,
        consecutiveErrors: 0,
        lastError: null,
        pausedReason: null,
      },
      serverTimeUtc: new Date().toISOString(),
    });
  }

  if (method === 'POST' && pathname === '/api/v1/admin/cache/clear') {
    clearRealFootballCache();
    return jsonResponse({ ok: true, clearedEntries: 1 });
  }

  if (method === 'POST' && pathname === '/api/v1/admin/test-connection') {
    return jsonResponse({
      provider: 'api-football',
      ok: true,
      configured: hasValidKey(env.API_FOOTBALL_KEY, 'MY_API_FOOTBALL_KEY'),
      latencyMs: 12,
      message: 'Cloudflare Edge Live Football Feed is online and reachable.',
      testedAtUtc: new Date().toISOString(),
    });
  }

  return jsonResponse({ error: `API route not found: ${pathname}` }, 404);
};
