import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { LiveDeltaEvent, NormalizedFixture } from '../backend/src/types/football';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { footballService, type BootstrapPayload } from './services/footballService';
import { liveFootballApiService } from './services/liveFootballApiService';
import { storageService } from './services/storageService';
import type {
  AppScreen,
  DataSourceMode,
  LocalizedText,
  Match,
  NewsArticle,
  Team,
  UserPreferences,
} from './types/football';
import { AppShell } from './components/layout/AppShell';
import { LiveProviderFeed } from './components/matches/LiveProviderFeed';
import { HomePage } from './pages/HomePage';
import { LiveMatchesPage } from './pages/LiveMatchesPage';
import { PastMatchesPage } from './pages/PastMatchesPage';
import { MatchCenterPage } from './pages/MatchCenterPage';
import { LeaguesPage } from './pages/LeaguesPage';
import { TeamsPage } from './pages/TeamsPage';
import { PlayersPage } from './pages/PlayersPage';
import { AILabPage } from './pages/AILabPage';
import { NewsPage } from './pages/NewsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const DEFAULT_LIVE_NOTICE: LocalizedText = {
  en: 'Live Real-Time Feed — Syncing real fixtures, scores, standings, lineups, and football news.',
  fa: 'داده‌های واقعی و زنده — همگام‌سازی نتایج مسابقات، جدول لیگ‌ها، ترکیب‌ها و اخبار واقعی فوتبال.',
};

const FootballAIPlatform: React.FC = () => {
  const { t } = useLanguage();
  const [screen, setScreen] = useState<AppScreen>('home');
  const [previousScreen, setPreviousScreen] = useState<AppScreen>('home');

  const [dataset, setDataset] = useState<BootstrapPayload | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceMode>('live');
  const [disclaimer, setDisclaimer] = useState<LocalizedText>(DEFAULT_LIVE_NOTICE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [matchDetailLoading, setMatchDetailLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [liveProviderFixtures, setLiveProviderFixtures] = useState<NormalizedFixture[]>([]);
  const [lastLiveDelta, setLastLiveDelta] = useState<LiveDeltaEvent | null>(null);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('epl');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [aiLabMatchId, setAiLabMatchId] = useState<string | undefined>(undefined);
  const [aiLabPlayerId, setAiLabPlayerId] = useState<string | undefined>(undefined);
  const [archivedMatchesById, setArchivedMatchesById] = useState<Record<string, Match>>({});
  const [archivedTeamsById, setArchivedTeamsById] = useState<Record<string, Team>>({});

  const [prefs, setPrefs] = useState<UserPreferences>(() => storageService.loadPreferences());

  const hydrate = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadError(null);
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const env = await footballService.getBootstrap(forceRefresh && attempt === 0);
        setDataset(env.data);
        setDataSource(env.dataSource);
        setDisclaimer(env.disclaimer);

        const featured = env.data.matches.find((m) => m.isFeatured) ?? env.data.matches[0];
        if (featured) {
          setSelectedMatchId((prev) =>
            env.data.matches.some((m) => m.id === prev) ? prev : featured.id
          );
        }
        if (env.data.teams[0]) {
          setSelectedTeamId((prev) =>
            env.data.teams.some((tm) => tm.id === prev) ? prev : env.data.teams[0].id
          );
        }
        if (env.data.players[0]) {
          setSelectedPlayerId((prev) =>
            env.data.players.some((p) => p.id === prev) ? prev : env.data.players[0].id
          );
        }
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt === 0) {
          await new Promise((r) => window.setTimeout(r, 1200));
        }
      }
    }
    setLoadError(
      lastErr instanceof Error ? lastErr.message : 'Unable to reach live football server'
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    hydrate(false);
  }, [hydrate]);

  // Background real-time polling every 45s to keep live scores & minutes fresh
  useEffect(() => {
    if (!dataset) return;
    const interval = window.setInterval(() => {
      footballService
        .getMatches(false)
        .then((res) => {
          setDataset((prev) => {
            if (!prev) return prev;
            // Preserve enriched match detail (lineups/stats) for currently open match
            const existingById = new Map(prev.matches.map((m) => [m.id, m]));
            const merged = res.data.map((fresh) => {
              const old = existingById.get(fresh.id);
              if (old && old.hasDetailedStats && !fresh.hasDetailedStats) {
                return {
                  ...old,
                  status: fresh.status,
                  minute: fresh.minute,
                  homeScore: fresh.homeScore,
                  awayScore: fresh.awayScore,
                };
              }
              return fresh;
            });
            return { ...prev, matches: merged };
          });
        })
        .catch(() => undefined);
    }, 45000);

    return () => window.clearInterval(interval);
  }, [Boolean(dataset)]);

  // Subscribe to Server-Sent Events live score stream without page refreshes
  useEffect(() => {
    const unsubscribe = liveFootballApiService.subscribeToLiveFeed(
      (event) => {
        if (event.type === 'snapshot' && Array.isArray(event.liveFixtures)) {
          setLiveProviderFixtures(event.liveFixtures);
        } else if (event.type !== 'heartbeat') {
          setLastLiveDelta(event);
          if (event.fixture) {
            setLiveProviderFixtures((prev) => {
              const idx = prev.findIndex((f) => f.providerId === event.fixture!.providerId);
              if (idx === -1) return [event.fixture!, ...prev];
              const copy = [...prev];
              copy[idx] = event.fixture!;
              return copy;
            });
          }
        }
      },
      (connected) => setSseConnected(connected)
    );

    return unsubscribe;
  }, []);

  // Fetch full real match summary (stats, events, lineups, venue, referee) whenever Match Center opens
  const hydrateMatchDetail = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setMatchDetailLoading(true);
    try {
      const res = await footballService.getMatchById(matchId);
      if (matchId.startsWith('fotmob-past-')) {
        setArchivedMatchesById((prev) => ({ ...prev, [matchId]: res.data }));
      } else {
        setDataset((prev) => {
          if (!prev) return prev;
          const exists = prev.matches.some((m) => m.id === matchId);
          if (!exists) {
            setArchivedMatchesById((arch) => ({ ...arch, [matchId]: res.data }));
            return prev;
          }
          return {
            ...prev,
            matches: prev.matches.map((m) => (m.id === matchId ? res.data : m)),
          };
        });
      }
    } catch {
      // Keep base scoreboard match data if summary fetch fails transiently
    } finally {
      setMatchDetailLoading(false);
    }
  }, []);

  const updatePrefs = (next: UserPreferences) => {
    setPrefs(next);
    storageService.savePreferences(next);
  };

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const handleToggleFavoriteMatch = (matchId: string) =>
    updatePrefs({ ...prefs, favoriteMatchIds: toggleId(prefs.favoriteMatchIds, matchId) });

  const handleToggleFavoriteTeam = (teamId: string) =>
    updatePrefs({ ...prefs, favoriteTeamIds: toggleId(prefs.favoriteTeamIds, teamId) });

  const handleToggleFavoritePlayer = (playerId: string) =>
    updatePrefs({ ...prefs, favoritePlayerIds: toggleId(prefs.favoritePlayerIds, playerId) });

  const handleNavigate = (next: AppScreen) => {
    if (next !== 'match-center') {
      setPreviousScreen(screen);
    }
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMatch = (matchId: string) => {
    setPreviousScreen(screen === 'match-center' ? previousScreen : screen);
    setSelectedMatchId(matchId);
    setScreen('match-center');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hydrateMatchDetail(matchId);
  };

  const handleOpenPastMatch = (pastMatch: Match, archiveTeams: Team[]) => {
    setArchivedTeamsById((prev) => {
      const next = { ...prev };
      for (const tm of archiveTeams) {
        if (!next[tm.id]) next[tm.id] = tm;
      }
      return next;
    });
    setArchivedMatchesById((prev) => ({ ...prev, [pastMatch.id]: pastMatch }));
    setPreviousScreen('past-matches');
    setSelectedMatchId(pastMatch.id);
    setScreen('match-center');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    hydrateMatchDetail(pastMatch.id);
  };

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    handleNavigate('teams');
  };

  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    handleNavigate('players');
  };

  const handleOpenAiLab = (matchId?: string) => {
    setAiLabMatchId(matchId);
    setAiLabPlayerId(undefined);
    handleNavigate('ai-lab');
  };

  const handleComparePlayerInAi = (playerId: string) => {
    setAiLabPlayerId(playerId);
    setAiLabMatchId(undefined);
    handleNavigate('ai-lab');
  };

  const handleRefreshLiveScores = async () => {
    setRefreshingLive(true);
    try {
      const res = await footballService.getMatches(true);
      setDataset((prev) => (prev ? { ...prev, matches: res.data } : prev));
      if (screen === 'match-center' && selectedMatchId) {
        await hydrateMatchDetail(selectedMatchId);
      }
    } finally {
      setRefreshingLive(false);
    }
  };

  const handleNewsPublished = (article: NewsArticle) => {
    setDataset((prev) => (prev ? { ...prev, news: [article, ...prev.news] } : prev));
  };

  const liveCount = useMemo(
    () =>
      dataset?.matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length ?? 0,
    [dataset]
  );

  const activeMatch = useMemo(() => {
    if (!dataset) return null;
    return (
      archivedMatchesById[selectedMatchId] ??
      dataset.matches.find((m) => m.id === selectedMatchId) ??
      dataset.matches[0] ??
      null
    );
  }, [dataset, selectedMatchId, archivedMatchesById]);

  return (
    <AppShell
      activeScreen={screen}
      onNavigate={handleNavigate}
      liveCount={liveCount}
      dataSource={dataSource}
      disclaimer={disclaimer}
    >
      {loading && (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-[#22FF66]" />
          <span className="text-sm">{t.common.loading}</span>
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-2xl bg-[#12161B] border border-red-500/30 p-8 text-center space-y-4">
          <p className="text-sm text-red-200">{loadError}</p>
          <button
            type="button"
            onClick={() => hydrate(true)}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#22FF66] text-[#090B0E] text-xs font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t.common.retry}</span>
          </button>
        </div>
      )}

      {!loading && dataset && (
        <>
          {(screen === 'home' || screen === 'live') && (
            <LiveProviderFeed
              sseConnected={sseConnected}
              liveFixtures={liveProviderFixtures}
              lastDelta={lastLiveDelta}
            />
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${screen}-${selectedMatchId}-${selectedTeamId}-${selectedPlayerId}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-full min-w-0"
            >
              {screen === 'home' && (
                <HomePage
                  leagues={dataset.leagues}
                  teams={dataset.teams}
                  matches={dataset.matches}
                  news={dataset.news}
                  standingsByLeague={dataset.standingsByLeague}
                  prefs={prefs}
                  isDemoData={dataSource === 'mock'}
                  onOpenMatch={handleOpenMatch}
                  onOpenAiLab={handleOpenAiLab}
                  onNavigate={handleNavigate}
                  onOpenLeagueTable={(leagueId) => {
                    setSelectedLeagueId(leagueId);
                    handleNavigate('leagues');
                  }}
                  onSelectTeam={handleSelectTeam}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                />
              )}

              {screen === 'live' && (
                <LiveMatchesPage
                  leagues={dataset.leagues}
                  teams={dataset.teams}
                  matches={dataset.matches}
                  prefs={prefs}
                  isDemoData={dataSource === 'mock'}
                  onOpenMatch={handleOpenMatch}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                  onRefreshLive={handleRefreshLiveScores}
                  refreshing={refreshingLive}
                />
              )}

              {screen === 'past-matches' && (
                <PastMatchesPage
                  leagues={dataset.leagues}
                  baseTeams={dataset.teams}
                  prefs={prefs}
                  onOpenPastMatch={handleOpenPastMatch}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                />
              )}

              {screen === 'match-center' &&
                activeMatch &&
                (() => {
                  const homeTeam =
                    dataset.teams.find((tm) => tm.id === activeMatch.homeTeamId) ??
                    archivedTeamsById[activeMatch.homeTeamId];
                  const awayTeam =
                    dataset.teams.find((tm) => tm.id === activeMatch.awayTeamId) ??
                    archivedTeamsById[activeMatch.awayTeamId];
                  const league = dataset.leagues.find((lg) => lg.id === activeMatch.leagueId);
                  if (!homeTeam || !awayTeam || !league) return null;
                  return (
                    <MatchCenterPage
                      match={activeMatch}
                      league={league}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      isFavorite={prefs.favoriteMatchIds.includes(activeMatch.id)}
                      isDemoData={dataSource === 'mock'}
                      loadingDetail={matchDetailLoading}
                      onToggleFavorite={handleToggleFavoriteMatch}
                      onBack={() => handleNavigate(previousScreen)}
                      onSelectTeam={handleSelectTeam}
                    />
                  );
                })()}

              {screen === 'leagues' && (
                <LeaguesPage
                  leagues={dataset.leagues}
                  teams={dataset.teams}
                  players={dataset.players}
                  matches={dataset.matches}
                  standingsByLeague={dataset.standingsByLeague}
                  selectedLeagueId={selectedLeagueId}
                  onSelectLeague={setSelectedLeagueId}
                  prefs={prefs}
                  isDemoData={dataSource === 'mock'}
                  onSelectTeam={handleSelectTeam}
                  onSelectPlayer={handleSelectPlayer}
                  onOpenMatch={handleOpenMatch}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                />
              )}

              {screen === 'teams' && (
                <TeamsPage
                  leagues={dataset.leagues}
                  teams={dataset.teams}
                  players={dataset.players}
                  matches={dataset.matches}
                  selectedTeamId={selectedTeamId}
                  prefs={prefs}
                  isDemoData={dataSource === 'mock'}
                  onSelectTeam={setSelectedTeamId}
                  onSelectPlayer={handleSelectPlayer}
                  onOpenMatch={handleOpenMatch}
                  onToggleFavoriteTeam={handleToggleFavoriteTeam}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                />
              )}

              {screen === 'players' && (
                <PlayersPage
                  players={dataset.players}
                  teams={dataset.teams}
                  selectedPlayerId={selectedPlayerId}
                  prefs={prefs}
                  onSelectPlayer={setSelectedPlayerId}
                  onToggleFavoritePlayer={handleToggleFavoritePlayer}
                  onCompareInAi={handleComparePlayerInAi}
                />
              )}

              {screen === 'ai-lab' && (
                <AILabPage
                  matches={dataset.matches}
                  teams={dataset.teams}
                  players={dataset.players}
                  initialMatchId={aiLabMatchId}
                  initialPlayerAId={aiLabPlayerId}
                />
              )}

              {screen === 'news' && <NewsPage news={dataset.news} />}

              {screen === 'favorites' && (
                <FavoritesPage
                  teams={dataset.teams}
                  matches={dataset.matches}
                  players={dataset.players}
                  prefs={prefs}
                  isDemoData={dataSource === 'mock'}
                  onSelectTeam={handleSelectTeam}
                  onSelectPlayer={handleSelectPlayer}
                  onOpenMatch={handleOpenMatch}
                  onToggleFavoriteTeam={handleToggleFavoriteTeam}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                  onToggleFavoritePlayer={handleToggleFavoritePlayer}
                  onNavigate={handleNavigate}
                />
              )}

              {screen === 'profile' && (
                <ProfilePage
                  prefs={prefs}
                  onUpdatePrefs={updatePrefs}
                  onResetPrefs={() => setPrefs(storageService.resetPreferences())}
                />
              )}

              {screen === 'admin' && (
                <AdminDashboardPage
                  matches={dataset.matches}
                  teams={dataset.teams}
                  onRefreshLive={handleRefreshLiveScores}
                  refreshingLive={refreshingLive}
                  onNewsPublished={handleNewsPublished}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <FootballAIPlatform />
    </LanguageProvider>
  );
}
