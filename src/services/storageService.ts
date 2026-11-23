import type { UserPreferences } from '../types/football';

const PREFS_KEY = 'football_ai_user_prefs_v2';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  displayName: 'Alex Karimi',
  roleTitle: 'Match Analyst',
  favoriteTeamIds: [],
  favoriteMatchIds: [],
  favoriteLeagueIds: ['epl', 'ucl', 'laliga'],
  favoritePlayerIds: [],
  showXgOnCards: true,
  compactMatchRows: false,
  liveGoalAlerts: true,
  aiInsightAlerts: true,
  defaultScreen: 'home',
};

// Capacitor-ready storage abstraction (can swap to @capacitor/preferences without changing callers)
export const storageService = {
  loadPreferences(): UserPreferences {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (!raw) return DEFAULT_USER_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      return {
        ...DEFAULT_USER_PREFERENCES,
        ...parsed,
        favoriteTeamIds: Array.isArray(parsed.favoriteTeamIds)
          ? parsed.favoriteTeamIds
          : DEFAULT_USER_PREFERENCES.favoriteTeamIds,
        favoriteMatchIds: Array.isArray(parsed.favoriteMatchIds)
          ? parsed.favoriteMatchIds
          : DEFAULT_USER_PREFERENCES.favoriteMatchIds,
        favoriteLeagueIds: Array.isArray(parsed.favoriteLeagueIds)
          ? parsed.favoriteLeagueIds
          : DEFAULT_USER_PREFERENCES.favoriteLeagueIds,
        favoritePlayerIds: Array.isArray(parsed.favoritePlayerIds)
          ? parsed.favoritePlayerIds
          : DEFAULT_USER_PREFERENCES.favoritePlayerIds,
      };
    } catch {
      return DEFAULT_USER_PREFERENCES;
    }
  },

  savePreferences(prefs: UserPreferences): void {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore restricted storage exceptions
    }
  },

  resetPreferences(): UserPreferences {
    this.savePreferences(DEFAULT_USER_PREFERENCES);
    return DEFAULT_USER_PREFERENCES;
  },
};
