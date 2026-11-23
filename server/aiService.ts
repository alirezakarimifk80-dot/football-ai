import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AIAskResponse,
  AIMatchAnalysisResponse,
  AIPlayerCompareResponse,
  AIWinProbabilityPoint,
  AIWinProbabilityResponse,
  Language,
  League,
  Match,
  Player,
  StandingRow,
  Team,
} from '../src/types/football.ts';

const DEFAULT_MODEL = 'gemini-4-hydrogen';

let aiRequestCounter = 0;

export function getAiRequestCount(): number {
  return aiRequestCounter;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server. Set it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function languageInstruction(lang: Language): string {
  return lang === 'fa'
    ? 'Respond completely in natural, professional Persian (Farsi) football journalism and tactical terminology. Keep standard football acronyms like xG, PPDA, or formations (4-3-3) clear.'
    : 'Respond in crisp, authoritative English football tactical analysis terminology.';
}

export async function analyzeMatchTactics(params: {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  lang: Language;
}): Promise<AIMatchAnalysisResponse> {
  const ai = getClient();
  aiRequestCounter += 1;

  const { match, homeTeam, awayTeam, league, lang } = params;
  const prompt = `Analyze this real football match using ONLY the provided live telemetry:
Competition: ${league.name.en} (${match.round.en})
Fixture: ${homeTeam.name.en} (${match.lineups.homeFormation}) vs ${awayTeam.name.en} (${match.lineups.awayFormation})
Status: ${match.status}${match.minute ? ` (${match.minute}')` : ''}
Score: ${match.homeScore ?? '-'} - ${match.awayScore ?? '-'}
Stats (Home vs Away):
- Possession: ${match.stats.possession[0]}% vs ${match.stats.possession[1]}%
- xG: ${match.stats.xG[0]} vs ${match.stats.xG[1]}
- Total Shots: ${match.stats.totalShots[0]} vs ${match.stats.totalShots[1]}
- Shots on Target: ${match.stats.shotsOnTarget[0]} vs ${match.stats.shotsOnTarget[1]}
- Big Chances: ${match.stats.bigChances[0]} vs ${match.stats.bigChances[1]}
- Pass Accuracy: ${match.stats.passAccuracy[0]}% vs ${match.stats.passAccuracy[1]}%
- Key Events: ${match.events.map((e) => `${e.minute}' ${e.type} ${e.playerName.en} (${e.teamSide})`).join('; ') || 'Pre-match'}
- Win Probability Model: Home ${match.winProbability.home}% / Draw ${match.winProbability.draw}% / Away ${match.winProbability.away}%`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are Football AI's senior tactical analyst. Provide sharp, grounded football analysis based strictly on the provided telemetry without inventing events that did not occur. ${languageInstruction(lang)}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          tacticalSummary: { type: Type.STRING },
          keyBattle: { type: Type.STRING },
          momentumInsight: { type: Type.STRING },
          predictedEdge: { type: Type.STRING },
          tacticalBullets: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
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
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    headline: parsed.headline ?? '',
    tacticalSummary: parsed.tacticalSummary ?? '',
    keyBattle: parsed.keyBattle ?? '',
    momentumInsight: parsed.momentumInsight ?? '',
    predictedEdge: parsed.predictedEdge ?? '',
    tacticalBullets: Array.isArray(parsed.tacticalBullets) ? parsed.tacticalBullets : [],
    modelUsed: DEFAULT_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

export async function comparePlayersAI(params: {
  playerA: Player;
  teamA: Team;
  playerB: Player;
  teamB: Team;
  lang: Language;
}): Promise<AIPlayerCompareResponse> {
  const ai = getClient();
  aiRequestCounter += 1;

  const { playerA, teamA, playerB, teamB, lang } = params;
  const prompt = `Compare these two footballers strictly using their current season statistics:
Player A: ${playerA.name.en} (${teamA.name.en}, ${playerA.position}, Age ${playerA.age})
- Rating: ${playerA.rating}, Apps: ${playerA.stats.appearances}, Goals: ${playerA.stats.goals}, Assists: ${playerA.stats.assists}
- xG: ${playerA.stats.xG}, xA: ${playerA.stats.xA}, Pass Acc: ${playerA.stats.passAccuracy}%, Key Passes/90: ${playerA.stats.keyPassesPer90}, Shots/90: ${playerA.stats.shotsPer90}
- Attributes: Pace ${playerA.radar.pace}, Shooting ${playerA.radar.shooting}, Passing ${playerA.radar.passing}, Dribbling ${playerA.radar.dribbling}, Defending ${playerA.radar.defending}, Physical ${playerA.radar.physical}

Player B: ${playerB.name.en} (${teamB.name.en}, ${playerB.position}, Age ${playerB.age})
- Rating: ${playerB.rating}, Apps: ${playerB.stats.appearances}, Goals: ${playerB.stats.goals}, Assists: ${playerB.stats.assists}
- xG: ${playerB.stats.xG}, xA: ${playerB.stats.xA}, Pass Acc: ${playerB.stats.passAccuracy}%, Key Passes/90: ${playerB.stats.keyPassesPer90}, Shots/90: ${playerB.stats.shotsPer90}
- Attributes: Pace ${playerB.radar.pace}, Shooting ${playerB.radar.shooting}, Passing ${playerB.radar.passing}, Dribbling ${playerB.radar.dribbling}, Defending ${playerB.radar.defending}, Physical ${playerB.radar.physical}`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are Football AI's head of recruitment and scouting analytics. Deliver an objective, data-backed head-to-head comparison. ${languageInstruction(lang)}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          verdict: { type: Type.STRING },
          playerAStrengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          playerBStrengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          tacticalFitSummary: { type: Type.STRING },
        },
        required: [
          'headline',
          'verdict',
          'playerAStrengths',
          'playerBStrengths',
          'tacticalFitSummary',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    headline: parsed.headline ?? '',
    verdict: parsed.verdict ?? '',
    playerAStrengths: Array.isArray(parsed.playerAStrengths) ? parsed.playerAStrengths : [],
    playerBStrengths: Array.isArray(parsed.playerBStrengths) ? parsed.playerBStrengths : [],
    tacticalFitSummary: parsed.tacticalFitSummary ?? '',
    modelUsed: DEFAULT_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

export async function askFootballAnalyst(params: {
  question: string;
  contextSummary: string;
  lang: Language;
}): Promise<AIAskResponse> {
  const ai = getClient();
  aiRequestCounter += 1;

  const { question, contextSummary, lang } = params;
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Live World & Iran Football Context:\n${contextSummary}\n\nUser Question:\n${question}`,
    config: {
      systemInstruction: `You are Football AI's tactical intelligence analyst. Answer football tactics, match telemetry, and player scouting questions concisely and accurately based on real-world football knowledge and the live match context provided. ${languageInstruction(lang)}`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['answer', 'keyTakeaways'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    answer: parsed.answer ?? '',
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
    modelUsed: DEFAULT_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

interface CachedWinProb {
  expiresAt: number;
  value: AIWinProbabilityResponse;
}

const winProbCache = new Map<string, CachedWinProb>();
const WIN_PROB_CACHE_TTL_MS = 30 * 1000;

function normalizeTriplet(h: unknown, d: unknown, a: unknown): { homeWin: number; draw: number; awayWin: number } {
  const rawH = Math.max(0, Number.isFinite(Number(h)) ? Number(h) : 0);
  const rawD = Math.max(0, Number.isFinite(Number(d)) ? Number(d) : 0);
  const rawA = Math.max(0, Number.isFinite(Number(a)) ? Number(a) : 0);
  const sum = rawH + rawD + rawA;
  if (sum <= 0) {
    return { homeWin: 34, draw: 32, awayWin: 34 };
  }
  const homeWin = Math.round((rawH / sum) * 100);
  const awayWin = Math.round((rawA / sum) * 100);
  const draw = Math.max(0, 100 - homeWin - awayWin);
  // Adjust if rounding pushed homeWin + awayWin over 100
  if (homeWin + awayWin > 100) {
    const excess = homeWin + awayWin - 100;
    return {
      homeWin: homeWin >= awayWin ? homeWin - excess : homeWin,
      draw: 0,
      awayWin: awayWin > homeWin ? awayWin - excess : awayWin,
    };
  }
  return { homeWin, draw, awayWin };
}

export async function generateWinProbabilityTimeline(params: {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  homeStanding?: StandingRow;
  awayStanding?: StandingRow;
  lang: Language;
  forceRefresh?: boolean;
}): Promise<AIWinProbabilityResponse> {
  const { match, homeTeam, awayTeam, league, homeStanding, awayStanding, lang, forceRefresh } = params;
  const cacheKey = `${match.id}:${lang}:${match.status}:${match.minute ?? 0}:${match.homeScore ?? 'x'}-${match.awayScore ?? 'x'}:${match.events.length}`;

  if (!forceRefresh) {
    const hit = winProbCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }
  }

  const ai = getClient();
  aiRequestCounter += 1;

  const endMinute =
    match.status === 'FT'
      ? Math.max(90, ...match.events.map((e) => e.minute))
      : match.status === 'HT'
        ? 45
        : match.status === 'LIVE'
          ? Math.max(1, match.minute ?? 1)
          : 0;

  const eventsSummary =
    match.events.length > 0
      ? match.events
          .slice()
          .sort((a, b) => a.minute - b.minute)
          .map(
            (e) =>
              `${e.minute}${e.addedTime ? `+${e.addedTime}` : ''}' [${e.teamSide.toUpperCase()}] ${e.type.toUpperCase()} - ${e.playerName.en}${e.assistOrDetail?.en ? ` (${e.assistOrDetail.en})` : ''}`
          )
          .join('\n')
      : 'None yet (pre-kickoff or no major incidents recorded).';

  const formatTeamHistory = (team: Team, standing?: StandingRow) => {
    const s = team.seasonStats;
    const rankStr = standing
      ? `League Rank #${standing.rank} (${standing.played}P ${standing.won}W-${standing.drawn}D-${standing.lost}L, GD ${standing.goalDiff >= 0 ? '+' : ''}${standing.goalDiff}, ${standing.points} pts)`
      : `Season Record: ${s.played}P ${s.won}W-${s.drawn}D-${s.lost}L, GF ${s.goalsFor}, GA ${s.goalsAgainst}, ${s.points} pts`;
    const formStr = (standing?.form?.length ? standing.form : team.form).join('-') || 'N/A';
    return `${team.name.en}: ${rankStr} | Recent Form: ${formStr}`;
  };

  const h2hSummary = `H2H Record: Home ${match.h2h.homeWins}W, ${match.h2h.draws}D, Away ${match.h2h.awayWins}W. Recent meetings: ${
    match.h2h.recentMeetings.map((m) => `${m.date} ${m.homeShort} ${m.score} ${m.awayShort}`).join('; ') ||
    'Not available'
  }`;

  const prompt = `Build a realistic minute-by-minute Win Probability timeline for this football match using ONLY the provided real match events, live stats, and historical team performance.

Competition: ${league.name.en} (${match.round.en})
Match: ${homeTeam.name.en} (Home) vs ${awayTeam.name.en} (Away)
Status: ${match.status}${match.minute ? ` (Current Minute: ${match.minute}')` : ''}
Score: ${match.homeScore ?? 0} - ${match.awayScore ?? 0}
Timeline Range: Minute 0 to Minute ${endMinute === 0 ? 0 : endMinute}

Historical Team Performance:
- ${formatTeamHistory(homeTeam, homeStanding)}
- ${formatTeamHistory(awayTeam, awayStanding)}
- ${h2hSummary}

Live Match Boxscore Stats (Home vs Away):
- Possession: ${match.stats.possession[0]}% vs ${match.stats.possession[1]}%
- Total Shots: ${match.stats.totalShots[0]} vs ${match.stats.totalShots[1]}
- Shots on Target: ${match.stats.shotsOnTarget[0]} vs ${match.stats.shotsOnTarget[1]}
- Corners: ${match.stats.corners[0]} vs ${match.stats.corners[1]}
- Fouls: ${match.stats.fouls[0]} vs ${match.stats.fouls[1]}
${match.hasXg ? `- xG: ${match.stats.xG[0]} vs ${match.stats.xG[1]}` : ''}

Chronological Match Events:
${eventsSummary}

Rules:
1. Return between 6 and 14 chronological timeline points starting at minute 0 (pre-match prior grounded in historical standings, recent form, H2H, and home advantage) up to minute ${endMinute} (if UPCOMING with minute 0, return 5 pre-match projection checkpoints at minutes 0, 15, 45, 75, 90 reflecting expected trajectory).
2. Always include an exact point at the minute of every goal or red card (with a concise eventLabel like "23' Goal - Saka") showing the realistic probability swing caused by that event.
3. For every point, homeWin + draw + awayWin MUST equal 100.
4. If status is FT, the final point MUST reflect the decisive full-time outcome (100% for the winner, or 100% draw if tied).
5. Never invent goals, cards, or players not present in the provided event list.
6. Provide concise, insightful turningPointSummary, historicalEdgeNote, and 3 short keyDrivers.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: `You are Football AI's quantitative match probability modeler. Produce calibrated win/draw/away probability curves strictly grounded in real match events, live statistics, league standings, recent form, and head-to-head history. ${languageInstruction(lang)}`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                minute: { type: Type.INTEGER },
                homeWin: { type: Type.NUMBER },
                draw: { type: Type.NUMBER },
                awayWin: { type: Type.NUMBER },
                eventLabel: { type: Type.STRING },
              },
              required: ['minute', 'homeWin', 'draw', 'awayWin'],
            },
          },
          turningPointSummary: { type: Type.STRING },
          historicalEdgeNote: { type: Type.STRING },
          keyDrivers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['timeline', 'turningPointSummary', 'historicalEdgeNote', 'keyDrivers'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  const rawTimeline: any[] = Array.isArray(parsed.timeline) ? parsed.timeline : [];

  const normalizedTimeline: AIWinProbabilityPoint[] = rawTimeline
    .map((pt) => {
      const triplet = normalizeTriplet(pt?.homeWin, pt?.draw, pt?.awayWin);
      const minute = Math.max(0, Math.min(125, Math.round(Number(pt?.minute ?? 0))));
      const label = typeof pt?.eventLabel === 'string' && pt.eventLabel.trim() ? pt.eventLabel.trim().slice(0, 72) : undefined;
      return {
        minute,
        ...triplet,
        ...(label ? { eventLabel: label } : {}),
      };
    })
    .sort((a, b) => a.minute - b.minute);

  // Deduplicate identical minutes (keep latest / labeled point)
  const deduped: AIWinProbabilityPoint[] = [];
  for (const pt of normalizedTimeline) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.minute === pt.minute) {
      deduped[deduped.length - 1] = pt.eventLabel ? pt : { ...pt, eventLabel: prev.eventLabel };
    } else {
      deduped.push(pt);
    }
  }

  // Enforce exact FT final point if match has ended
  if (match.status === 'FT' && match.homeScore !== null && match.awayScore !== null && deduped.length > 0) {
    const last = deduped[deduped.length - 1];
    if (match.homeScore > match.awayScore) {
      deduped[deduped.length - 1] = { ...last, homeWin: 100, draw: 0, awayWin: 0 };
    } else if (match.awayScore > match.homeScore) {
      deduped[deduped.length - 1] = { ...last, homeWin: 0, draw: 0, awayWin: 100 };
    } else {
      deduped[deduped.length - 1] = { ...last, homeWin: 0, draw: 100, awayWin: 0 };
    }
  }

  const latest =
    deduped.length > 0
      ? deduped[deduped.length - 1]
      : normalizeTriplet(match.winProbability.home, match.winProbability.draw, match.winProbability.away);

  const result: AIWinProbabilityResponse = {
    current: {
      homeWin: latest.homeWin,
      draw: latest.draw,
      awayWin: latest.awayWin,
    },
    timeline: deduped,
    turningPointSummary: typeof parsed.turningPointSummary === 'string' ? parsed.turningPointSummary : '',
    historicalEdgeNote: typeof parsed.historicalEdgeNote === 'string' ? parsed.historicalEdgeNote : '',
    keyDrivers: Array.isArray(parsed.keyDrivers)
      ? parsed.keyDrivers.filter((d: unknown): d is string => typeof d === 'string').slice(0, 4)
      : [],
    modelUsed: DEFAULT_MODEL,
    generatedAt: new Date().toISOString(),
  };

  winProbCache.set(cacheKey, { expiresAt: Date.now() + WIN_PROB_CACHE_TTL_MS, value: result });
  if (winProbCache.size > 60) {
    const firstKey = winProbCache.keys().next().value;
    if (firstKey) winProbCache.delete(firstKey);
  }

  return result;
}
