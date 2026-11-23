import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { adminApiV1Router } from './backend/src/routes/adminApiRoutes.ts';
import { footballV1Router } from './backend/src/routes/footballRoutes.ts';
import { liveScoreEngine } from './backend/src/schedulers/liveScoreEngine.ts';
import { footballDataService } from './backend/src/services/footballDataService.ts';
import {
  analyzeMatchTactics,
  askFootballAnalyst,
  comparePlayersAI,
  generateWinProbabilityTimeline,
  getAiRequestCount,
  isGeminiConfigured,
} from './server/aiService.ts';
import {
  clearRealFootballCache,
  getRealBootstrapData,
  getRealMatchById,
  getRealMatches,
} from './server/liveRealFootballService.ts';
import {
  getPastMatchesArchive,
  VALID_ARCHIVE_LEAGUE_IDS,
} from './server/pastMatchesService.ts';
import {
  claimAdminPasscode,
  getAdminAuthStatus,
  getVerifiedAdminSessionKey,
  loginAdminPasscode,
} from './server/adminAuthService.ts';
import {
  clearSessionGitHubToken,
  diagnoseGitHubUpload,
  getGitHubStatus,
  pushProjectToGitHub,
  setSessionGitHubToken,
} from './server/githubPushService.ts';
import type { ApiEnvelope, Language, NewsArticle } from './src/types/football.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_NEWS_CATEGORIES: NewsArticle['category'][] = [
  'tactics',
  'transfers',
  'match-report',
  'analytics',
];

const LIVE_DISCLAIMER = {
  en: 'Live Real-Time Feed — Real fixtures, scores, league tables, lineups, and football news synced from live providers.',
  fa: 'داده‌های واقعی و زنده — نتایج مسابقات، جدول لیگ‌ها، ترکیب تیم‌ها و اخبار واقعی فوتبال به‌صورت زنده همگام‌سازی می‌شوند.',
};

const editorialNewsStore: NewsArticle[] = [];

function parseLanguage(val: unknown): Language {
  return val === 'fa' ? 'fa' : 'en';
}

function wrapLiveEnvelope<T>(data: T): ApiEnvelope<T> {
  return {
    dataSource: 'live',
    disclaimer: LIVE_DISCLAIMER,
    lastSyncedAt: new Date().toISOString(),
    data,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100kb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Mount production Football Live Data API v1 & Admin API Management routes
  app.use('/api/v1/football', footballV1Router);
  app.use('/api/v1/admin', adminApiV1Router);

  // Read-only system capability diagnostics (never exposes any secret values)
  app.get('/api/system/capabilities', async (_req, res) => {
    const apiFootballConfigured = footballDataService.getActiveProvider().isConfigured();
    let liveFixturesCount = 0;
    let newsCount = editorialNewsStore.length;
    try {
      const snap = await getRealBootstrapData();
      liveFixturesCount = snap.matches.length;
      newsCount += snap.news.length;
    } catch {
      // Keep counts at 0 if upstream temporarily unreachable
    }

    res.json({
      dataSource: 'live',
      geminiConfigured: isGeminiConfigured(),
      externalFootballApiConfigured: true,
      apiFootballKeyConfigured: apiFootballConfigured,
      capacitorReady: true,
      serverTime: new Date().toISOString(),
      aiRequestsCount: getAiRequestCount(),
      demoFixturesCount: liveFixturesCount,
      newsCount,
    });
  });

  // Real-Time Football Data API routes (no mock/demo fallback!)
  app.get('/api/football/bootstrap', async (req, res) => {
    try {
      if (req.query.refresh === '1') {
        clearRealFootballCache();
      }
      const realData = await getRealBootstrapData();
      const mergedNews = [...editorialNewsStore, ...realData.news];
      res.json(
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
      res.status(503).json({ error: msg });
    }
  });

  app.get('/api/football/matches', async (req, res) => {
    try {
      if (req.query.refresh === '1') {
        clearRealFootballCache();
      }
      const matches = await getRealMatches();
      res.json(wrapLiveEnvelope(matches));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch live matches';
      res.status(503).json({ error: msg });
    }
  });

  app.get('/api/football/past-matches', async (req, res) => {
    try {
      const rawLeague = typeof req.query.league === 'string' ? req.query.league.trim() : 'all';
      if (!VALID_ARCHIVE_LEAGUE_IDS.has(rawLeague)) {
        res.status(400).json({ error: 'Invalid league filter' });
        return;
      }
      if (req.query.refresh === '1') {
        clearRealFootballCache();
      }
      const archive = await getPastMatchesArchive(rawLeague);
      res.json(wrapLiveEnvelope(archive));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch previous matches archive';
      res.status(503).json({ error: msg });
    }
  });

  app.get('/api/football/matches/:id', async (req, res) => {
    try {
      const id = String(req.params.id ?? '').trim();
      const match = await getRealMatchById(id);
      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }
      res.json(wrapLiveEnvelope(match));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load match details';
      res.status(503).json({ error: msg });
    }
  });

  // Editorial news publisher (works alongside real live news)
  app.post('/api/admin/news', (req, res) => {
    const { category, titleEn, titleFa, summaryEn, summaryFa } = req.body ?? {};
    if (
      typeof category !== 'string' ||
      !ALLOWED_NEWS_CATEGORIES.includes(category as NewsArticle['category'])
    ) {
      res.status(400).json({ error: 'Invalid news category' });
      return;
    }
    const cleanTitleEn = typeof titleEn === 'string' ? titleEn.trim().slice(0, 140) : '';
    const cleanTitleFa = typeof titleFa === 'string' ? titleFa.trim().slice(0, 140) : '';
    const cleanSummaryEn = typeof summaryEn === 'string' ? summaryEn.trim().slice(0, 320) : '';
    const cleanSummaryFa = typeof summaryFa === 'string' ? summaryFa.trim().slice(0, 320) : '';

    if (!cleanTitleEn || !cleanSummaryEn) {
      res.status(400).json({ error: 'English headline and summary are required' });
      return;
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
    res.status(201).json(wrapLiveEnvelope(article));
  });

  // Force live cache refresh from Admin
  app.post('/api/admin/matches/refresh', async (_req, res) => {
    try {
      clearRealFootballCache();
      const matches = await getRealMatches();
      liveScoreEngine.broadcastCustomEvent({
        type: 'heartbeat',
        timestampUtc: new Date().toISOString(),
        summary: `Synced ${matches.length} real fixtures from live football feed`,
      });
      res.json(wrapLiveEnvelope(matches));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to refresh live feed';
      res.status(503).json({ error: msg });
    }
  });

  // Server-side Admin Passcode authentication (in-memory Bearer sessions)
  app.get('/api/admin/auth/status', (_req, res) => {
    res.json(getAdminAuthStatus());
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    const result = claimAdminPasscode(req.body?.passcode);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ ok: true, token: result.token, mode: result.mode });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const result = loginAdminPasscode(req.body?.passcode);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true, token: result.token, mode: result.mode });
  });

  // Direct GitHub Upload routes (token read from verified admin session RAM or server process.env)
  app.get('/api/admin/github/status', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const sessionKey = getVerifiedAdminSessionKey(req.headers.authorization);
      const status = await getGitHubStatus(forceRefresh, sessionKey);
      res.json(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to inspect GitHub status';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/github/token', async (req, res) => {
    const sessionKey = getVerifiedAdminSessionKey(req.headers.authorization);
    if (!sessionKey) {
      res.status(401).json({ error: 'Admin verification required before connecting a GitHub token.' });
      return;
    }
    try {
      const status = await setSessionGitHubToken(sessionKey, req.body?.token);
      res.json({ ok: true, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify GitHub token';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/admin/github/token', async (req, res) => {
    const sessionKey = getVerifiedAdminSessionKey(req.headers.authorization);
    if (!sessionKey) {
      res.status(401).json({ error: 'Admin verification required.' });
      return;
    }
    try {
      clearSessionGitHubToken(sessionKey);
      const status = await getGitHubStatus(true, sessionKey);
      res.json({ ok: true, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to clear GitHub token';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/github/diagnose', async (req, res) => {
    const sessionKey = getVerifiedAdminSessionKey(req.headers.authorization);
    if (!sessionKey) {
      res.status(401).json({ error: 'Admin verification required to diagnose target GitHub repository.' });
      return;
    }
    try {
      const report = await diagnoseGitHubUpload(
        {
          owner: req.body?.owner,
          repo: req.body?.repo,
          branch: req.body?.branch,
          createRepoIfMissing: req.body?.createRepoIfMissing,
        },
        sessionKey
      );
      res.json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GitHub diagnostics failed';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/admin/github/push', async (req, res) => {
    const sessionKey = getVerifiedAdminSessionKey(req.headers.authorization);
    if (!sessionKey) {
      res.status(401).json({ error: 'Admin verification required before uploading to GitHub.' });
      return;
    }
    try {
      const result = await pushProjectToGitHub(
        {
          owner: req.body?.owner,
          repo: req.body?.repo,
          branch: req.body?.branch,
          commitMessage: req.body?.commitMessage,
          createRepoIfMissing: req.body?.createRepoIfMissing,
          isPrivate: req.body?.isPrivate,
        },
        sessionKey
      );
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GitHub upload failed';
      res.status(400).json({ error: msg });
    }
  });

  // Separate AI Service routes (server-side Gemini SDK analyzing REAL live match/player data)
  app.post('/api/ai/analyze-match', async (req, res) => {
    try {
      const matchId = typeof req.body?.matchId === 'string' ? req.body.matchId.trim() : '';
      const lang = parseLanguage(req.body?.lang);
      const [match, snap] = await Promise.all([
        getRealMatchById(matchId),
        getRealBootstrapData(),
      ]);

      if (!match) {
        res.status(404).json({ error: 'Match not found for analysis' });
        return;
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
        res.status(400).json({ error: 'Incomplete match entities' });
        return;
      }

      const analysis = await analyzeMatchTactics({ match, homeTeam, awayTeam, league, lang });
      res.json(analysis);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/win-probability', async (req, res) => {
    try {
      const matchId = typeof req.body?.matchId === 'string' ? req.body.matchId.trim() : '';
      const lang = parseLanguage(req.body?.lang);
      const forceRefresh = req.body?.forceRefresh === true;

      if (!matchId) {
        res.status(400).json({ error: 'matchId is required' });
        return;
      }

      const [match, snap] = await Promise.all([
        getRealMatchById(matchId),
        getRealBootstrapData(),
      ]);

      if (!match) {
        res.status(404).json({ error: 'Match not found for win probability modeling' });
        return;
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
        res.status(400).json({ error: 'Incomplete match entities' });
        return;
      }

      const leagueTable = snap.standingsByLeague[match.leagueId] ?? [];
      const homeStanding = leagueTable.find((r) => r.teamId === homeTeam.id);
      const awayStanding = leagueTable.find((r) => r.teamId === awayTeam.id);

      const timeline = await generateWinProbabilityTimeline({
        match,
        homeTeam,
        awayTeam,
        league,
        homeStanding,
        awayStanding,
        lang,
        forceRefresh,
      });
      res.json(timeline);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI win probability generation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/compare-players', async (req, res) => {
    try {
      const playerAId = typeof req.body?.playerAId === 'string' ? req.body.playerAId.trim() : '';
      const playerBId = typeof req.body?.playerBId === 'string' ? req.body.playerBId.trim() : '';
      const lang = parseLanguage(req.body?.lang);

      if (!playerAId || !playerBId || playerAId === playerBId) {
        res.status(400).json({ error: 'Select two distinct players to compare' });
        return;
      }

      const snap = await getRealBootstrapData();
      const playerA = snap.players.find((p) => p.id === playerAId);
      const playerB = snap.players.find((p) => p.id === playerBId);
      if (!playerA || !playerB) {
        res.status(404).json({ error: 'One or both players not found' });
        return;
      }
      const teamA = snap.teams.find((t) => t.id === playerA.teamId);
      const teamB = snap.teams.find((t) => t.id === playerB.teamId);
      if (!teamA || !teamB) {
        res.status(400).json({ error: 'Team data missing for player' });
        return;
      }

      const result = await comparePlayersAI({ playerA, teamA, playerB, teamB, lang });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Player comparison failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/ask', async (req, res) => {
    try {
      const rawQuestion = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      const lang = parseLanguage(req.body?.lang);
      if (!rawQuestion || rawQuestion.length < 3 || rawQuestion.length > 600) {
        res.status(400).json({ error: 'Question must be between 3 and 600 characters' });
        return;
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

      const result = await askFootballAnalyst({
        question: rawQuestion,
        contextSummary: `Real Current World Football Matches:\n${lines.join('\n')}`,
        lang,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analyst query failed';
      res.status(502).json({ error: message });
    }
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Football AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start Football AI server:', error);
  process.exit(1);
});
