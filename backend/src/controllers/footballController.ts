import type { NextFunction, Request, Response } from 'express';
import {
  parseDateParam,
  parsePositiveIntParam,
  parseSeasonParam,
} from '../middleware/validateRequest.ts';
import { liveScoreEngine } from '../schedulers/liveScoreEngine.ts';
import { footballDataService } from '../services/footballDataService.ts';

function utcDateWithOffset(offsetDays: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

export const footballController = {
  // SSE Live Score Stream
  streamLive(req: Request, res: Response): void {
    const cleanup = liveScoreEngine.addSseClient(res);
    req.on('close', () => {
      cleanup();
    });
  },

  // A. Live scores
  async getLive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await footballDataService.getLiveFixtures();
      res.json(data);
    } catch (err) {
      next(err);
    }
  },

  // B. Fixtures (date / yesterday / today / tomorrow / league / team / upcoming)
  async getFixtures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preset = typeof req.query.preset === 'string' ? req.query.preset.toLowerCase() : '';
      let date = parseDateParam(req.query.date);
      if (!date && preset === 'today') date = utcDateWithOffset(0);
      if (!date && preset === 'yesterday') date = utcDateWithOffset(-1);
      if (!date && preset === 'tomorrow') date = utcDateWithOffset(1);

      const leagueId = parsePositiveIntParam(req.query.league, 'league') ?? undefined;
      const teamId = parsePositiveIntParam(req.query.team, 'team') ?? undefined;
      const season = req.query.season ? parseSeasonParam(req.query.season) : undefined;
      const nextCount = parsePositiveIntParam(req.query.next, 'next') ?? undefined;
      const lastCount = parsePositiveIntParam(req.query.last, 'last') ?? undefined;

      const result = await footballDataService.getFixtures({
        date,
        leagueId,
        teamId,
        season,
        next: nextCount,
        last: lastCount,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getFixtureById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      const result = await footballDataService.getFixtureById(fixtureId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // Combined Match Center bundle (cached per module so only stale pieces call upstream)
  async getFixtureFull(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      const [fixtureEnv, eventsEnv, statsEnv, lineupsEnv] = await Promise.all([
        footballDataService.getFixtureById(fixtureId),
        footballDataService.getFixtureEvents(fixtureId),
        footballDataService.getFixtureStatistics(fixtureId),
        footballDataService.getFixtureLineups(fixtureId),
      ]);
      res.json({
        provider: fixtureEnv.provider,
        dataSource: fixtureEnv.dataSource,
        fetchedAtUtc: new Date().toISOString(),
        data: {
          fixture: fixtureEnv.data,
          events: eventsEnv.data,
          statistics: statsEnv.data,
          lineups: lineupsEnv.data,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getHeadToHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamA = parsePositiveIntParam(req.query.teamA, 'teamA');
      const teamB = parsePositiveIntParam(req.query.teamB, 'teamB');
      if (!teamA || !teamB) {
        res.status(400).json({ error: 'teamA and teamB query parameters are required' });
        return;
      }
      const last = parsePositiveIntParam(req.query.last, 'last') ?? 6;
      const result = await footballDataService.getHeadToHead(teamA, teamB, Math.min(20, last));
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // C. Match Events
  async getFixtureEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getFixtureEvents(fixtureId));
    } catch (err) {
      next(err);
    }
  },

  // D. Match Statistics
  async getFixtureStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getFixtureStatistics(fixtureId));
    } catch (err) {
      next(err);
    }
  },

  // E. Lineups
  async getFixtureLineups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getFixtureLineups(fixtureId));
    } catch (err) {
      next(err);
    }
  },

  // F. Leagues, Standings, Top Scorers, Top Assists
  async getLeagues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const country = typeof req.query.country === 'string' ? req.query.country.trim().slice(0, 60) : undefined;
      const current = req.query.current === 'true';
      res.json(await footballDataService.getLeagues({ country, current }));
    } catch (err) {
      next(err);
    }
  },

  async getStandings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = parsePositiveIntParam(req.params.id, 'id')!;
      const season = parseSeasonParam(req.query.season);
      res.json(await footballDataService.getStandings(leagueId, season));
    } catch (err) {
      next(err);
    }
  },

  async getTopScorers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = parsePositiveIntParam(req.params.id, 'id')!;
      const season = parseSeasonParam(req.query.season);
      res.json(await footballDataService.getTopScorers(leagueId, season));
    } catch (err) {
      next(err);
    }
  },

  async getTopAssists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const leagueId = parsePositiveIntParam(req.params.id, 'id')!;
      const season = parseSeasonParam(req.query.season);
      res.json(await footballDataService.getTopAssists(leagueId, season));
    } catch (err) {
      next(err);
    }
  },

  // G. Teams
  async getTeamProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getTeamProfile(teamId));
    } catch (err) {
      next(err);
    }
  },

  async getTeamSquad(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getTeamSquad(teamId));
    } catch (err) {
      next(err);
    }
  },

  async getTeamStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = parsePositiveIntParam(req.params.id, 'id')!;
      const leagueId = parsePositiveIntParam(req.query.league, 'league');
      if (!leagueId) {
        res.status(400).json({ error: 'league query parameter is required' });
        return;
      }
      const season = parseSeasonParam(req.query.season);
      res.json(await footballDataService.getTeamStatistics(leagueId, season, teamId));
    } catch (err) {
      next(err);
    }
  },

  // H. Players
  async getPlayerProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const playerId = parsePositiveIntParam(req.params.id, 'id')!;
      const season = parseSeasonParam(req.query.season);
      res.json(await footballDataService.getPlayerProfile(playerId, season));
    } catch (err) {
      next(err);
    }
  },

  // I. Other football data
  async getCoaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = parsePositiveIntParam(req.query.team, 'team');
      if (!teamId) {
        res.status(400).json({ error: 'team query parameter is required' });
        return;
      }
      res.json(await footballDataService.getCoaches(teamId));
    } catch (err) {
      next(err);
    }
  },

  async getTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const teamId = parsePositiveIntParam(req.query.team, 'team') ?? undefined;
      const playerId = parsePositiveIntParam(req.query.player, 'player') ?? undefined;
      if (!teamId && !playerId) {
        res.status(400).json({ error: 'Provide either team or player query parameter' });
        return;
      }
      res.json(await footballDataService.getTransfers({ teamId, playerId }));
    } catch (err) {
      next(err);
    }
  },

  async getInjuries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.query.fixture, 'fixture') ?? undefined;
      const teamId = parsePositiveIntParam(req.query.team, 'team') ?? undefined;
      const leagueId = parsePositiveIntParam(req.query.league, 'league') ?? undefined;
      const season = req.query.season ? parseSeasonParam(req.query.season) : undefined;
      if (!fixtureId && !teamId && !leagueId) {
        res.status(400).json({ error: 'Provide fixture, team, or league query parameter' });
        return;
      }
      res.json(await footballDataService.getInjuries({ fixtureId, teamId, leagueId, season }));
    } catch (err) {
      next(err);
    }
  },

  async getPredictions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fixtureId = parsePositiveIntParam(req.params.id, 'id')!;
      res.json(await footballDataService.getPredictions(fixtureId));
    } catch (err) {
      next(err);
    }
  },
};
