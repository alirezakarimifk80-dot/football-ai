import type {
  AIAskResponse,
  AIMatchAnalysisResponse,
  AIPlayerCompareResponse,
  AIWinProbabilityResponse,
  Language,
} from '../types/football';
import { apiFetch } from './apiClient';

// Dedicated client-side AI service layer communicating strictly with server-side /api/ai/* routes.
export const aiService = {
  analyzeMatch(matchId: string, lang: Language): Promise<AIMatchAnalysisResponse> {
    return apiFetch<AIMatchAnalysisResponse>('/api/ai/analyze-match', {
      method: 'POST',
      body: JSON.stringify({ matchId, lang }),
    });
  },

  getWinProbability(
    matchId: string,
    lang: Language,
    forceRefresh = false
  ): Promise<AIWinProbabilityResponse> {
    return apiFetch<AIWinProbabilityResponse>('/api/ai/win-probability', {
      method: 'POST',
      body: JSON.stringify({ matchId, lang, forceRefresh }),
    });
  },

  comparePlayers(
    playerAId: string,
    playerBId: string,
    lang: Language
  ): Promise<AIPlayerCompareResponse> {
    return apiFetch<AIPlayerCompareResponse>('/api/ai/compare-players', {
      method: 'POST',
      body: JSON.stringify({ playerAId, playerBId, lang }),
    });
  },

  askAnalyst(question: string, lang: Language): Promise<AIAskResponse> {
    return apiFetch<AIAskResponse>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question, lang }),
    });
  },
};
