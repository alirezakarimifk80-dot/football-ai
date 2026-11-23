import type { NextFunction, Request, Response } from 'express';
import {
  VALID_ENDPOINT_MODULES,
  VALID_PROVIDERS,
} from '../middleware/validateRequest.ts';
import { liveScoreEngine } from '../schedulers/liveScoreEngine.ts';
import { footballDataService } from '../services/footballDataService.ts';
import type { EndpointModuleKey, ProviderId } from '../types/football.ts';

export const adminApiController = {
  getDiagnostics(_req: Request, res: Response): void {
    res.json({
      ...footballDataService.getDiagnostics(),
      liveEngine: liveScoreEngine.getStatus(),
      serverTimeUtc: new Date().toISOString(),
    });
  },

  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawProvider = req.body?.provider;
      let providerId: ProviderId | undefined;
      if (rawProvider !== undefined) {
        if (typeof rawProvider !== 'string' || !VALID_PROVIDERS.includes(rawProvider as ProviderId)) {
          res.status(400).json({ error: 'Invalid provider ID' });
          return;
        }
        providerId = rawProvider as ProviderId;
      }

      const result = await footballDataService.testConnection(providerId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  selectProvider(req: Request, res: Response): void {
    const rawProvider = req.body?.provider;
    if (typeof rawProvider !== 'string' || !VALID_PROVIDERS.includes(rawProvider as ProviderId)) {
      res.status(400).json({ error: 'Invalid provider ID' });
      return;
    }
    const outcome = footballDataService.selectProvider(rawProvider as ProviderId);
    if (!outcome.switched) {
      res.status(400).json({ error: outcome.message });
      return;
    }
    res.json({
      ok: true,
      message: outcome.message,
      activeProvider: rawProvider,
    });
  },

  toggleEndpoint(req: Request, res: Response): void {
    const { moduleKey, enabled } = req.body ?? {};
    if (
      typeof moduleKey !== 'string' ||
      !VALID_ENDPOINT_MODULES.includes(moduleKey as EndpointModuleKey)
    ) {
      res.status(400).json({ error: 'Invalid endpoint module key' });
      return;
    }
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    const updated = footballDataService.setEndpointEnabled(moduleKey as EndpointModuleKey, enabled);
    res.json({ ok: true, enabledEndpoints: updated });
  },

  clearCache(_req: Request, res: Response): void {
    const cleared = footballDataService.clearCache();
    res.json({ ok: true, clearedEntries: cleared });
  },

  async controlLiveEngine(req: Request, res: Response): Promise<void> {
    const { action, pollIntervalSec } = req.body ?? {};

    if (pollIntervalSec !== undefined) {
      const parsed = Number(pollIntervalSec);
      if (!Number.isInteger(parsed) || parsed < 15 || parsed > 600) {
        res.status(400).json({ error: 'pollIntervalSec must be an integer between 15 and 600' });
        return;
      }
      liveScoreEngine.setPollInterval(parsed);
    }

    if (action === 'start') {
      liveScoreEngine.start();
    } else if (action === 'stop') {
      liveScoreEngine.stop();
    } else if (action === 'poll_now') {
      await liveScoreEngine.pollOnce();
    } else if (action !== undefined) {
      res.status(400).json({ error: 'action must be start, stop, or poll_now' });
      return;
    }

    res.json({ ok: true, liveEngine: liveScoreEngine.getStatus() });
  },
};
