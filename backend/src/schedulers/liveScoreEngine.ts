import type { Response } from 'express';
import { getFootballApiConfig } from '../config/env.ts';
import { footballDataService, type FootballDataService } from '../services/footballDataService.ts';
import type {
  LiveDeltaEvent,
  NormalizedFixture,
  NormalizedMatchEvent,
} from '../types/football.ts';

export interface LiveEngineStatus {
  running: boolean;
  pollingState: 'active' | 'idle_no_live_matches' | 'paused_quota_or_unconfigured' | 'stopped';
  pollIntervalSec: number;
  connectedClients: number;
  trackedLiveFixtures: number;
  lastPollUtc: string | null;
  totalPollsRun: number;
  recentDeltas: LiveDeltaEvent[];
}

/**
 * Dedicated Live Score Engine:
 * - Polls live matches on a configurable quota-safe interval.
 * - Diffs scorelines, statuses, and events (goals, score corrections, cards, subs, VAR).
 * - Deduplicates events via deterministic eventKey sets.
 * - Broadcasts live updates over Server-Sent Events (SSE) without page refresh.
 * - Automatically stops/idles polling when 0 live matches exist or when quota is low.
 */
export class LiveScoreEngine {
  private readonly service: FootballDataService;
  private readonly sseClients = new Set<Response>();
  private readonly fixtureState = new Map<string, NormalizedFixture>();
  private readonly seenEvents = new Map<string, Set<string>>();
  private recentDeltas: LiveDeltaEvent[] = [];

  private pollIntervalSec: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private pollingState: LiveEngineStatus['pollingState'] = 'stopped';
  private lastPollUtc: string | null = null;
  private totalPollsRun = 0;

  constructor(service: FootballDataService = footballDataService) {
    this.service = service;
    this.pollIntervalSec = getFootballApiConfig().livePollIntervalSec;
  }

  getStatus(): LiveEngineStatus {
    return {
      running: this.running,
      pollingState: this.pollingState,
      pollIntervalSec: this.pollIntervalSec,
      connectedClients: this.sseClients.size,
      trackedLiveFixtures: this.fixtureState.size,
      lastPollUtc: this.lastPollUtc,
      totalPollsRun: this.totalPollsRun,
      recentDeltas: this.recentDeltas.slice(0, 15),
    };
  }

  getCurrentLiveFixtures(): NormalizedFixture[] {
    return Array.from(this.fixtureState.values());
  }

  setPollInterval(seconds: number): void {
    const clamped = Math.max(15, Math.min(600, Math.floor(seconds)));
    this.pollIntervalSec = clamped;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  addSseClient(res: Response): () => void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.sseClients.add(res);

    // Send initial snapshot immediately upon connection
    const snapshot: LiveDeltaEvent = {
      type: 'snapshot',
      timestampUtc: new Date().toISOString(),
      liveFixtures: this.getCurrentLiveFixtures(),
    };
    this.sendToClient(res, snapshot);

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        if (this.sseClients.size === 0) {
          if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
          }
          return;
        }
        this.broadcast({
          type: 'heartbeat',
          timestampUtc: new Date().toISOString(),
        });
      }, 25000);
    }

    return () => {
      this.sseClients.delete(res);
    };
  }

  start(): void {
    if (this.running) return;
    const provider = this.service.getActiveProvider();
    if (!provider.isConfigured()) {
      this.running = false;
      this.pollingState = 'paused_quota_or_unconfigured';
      return;
    }

    this.running = true;
    this.pollingState = 'active';
    void this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollIntervalSec * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.pollingState = 'stopped';
  }

  async pollOnce(): Promise<{ polled: boolean; liveCount: number; deltas: LiveDeltaEvent[] }> {
    const provider = this.service.getActiveProvider();
    if (!provider.isConfigured()) {
      this.pollingState = 'paused_quota_or_unconfigured';
      return { polled: false, liveCount: 0, deltas: [] };
    }

    const quota = provider.getQuotaSnapshot();
    if (quota.isBackoffActive || quota.remainingToday <= 2) {
      this.pollingState = 'paused_quota_or_unconfigured';
      return { polled: false, liveCount: this.fixtureState.size, deltas: [] };
    }

    try {
      this.totalPollsRun += 1;
      this.lastPollUtc = new Date().toISOString();
      const envelope = await this.service.getLiveFixtures();
      const incoming = envelope.data;

      // Stop unnecessary polling automatically when no live matches exist
      if (incoming.length === 0) {
        const deltas = this.processSnapshot([], new Map());
        this.pollingState = 'idle_no_live_matches';
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
          this.running = false;
        }
        return { polled: true, liveCount: 0, deltas };
      }

      this.pollingState = 'active';
      const deltas = this.processSnapshot(incoming, new Map());
      return { polled: true, liveCount: incoming.length, deltas };
    } catch {
      this.pollingState = 'paused_quota_or_unconfigured';
      return { polled: false, liveCount: this.fixtureState.size, deltas: [] };
    }
  }

  /**
   * Pure diffing & deduplication engine exposed for unit testing and SSE fan-out.
   */
  processSnapshot(
    incomingFixtures: NormalizedFixture[],
    eventsByFixture: Map<string, NormalizedMatchEvent[]>
  ): LiveDeltaEvent[] {
    const nowUtc = new Date().toISOString();
    const emitted: LiveDeltaEvent[] = [];
    const incomingIds = new Set<string>();

    for (const fixture of incomingFixtures) {
      incomingIds.add(fixture.providerId);
      const previous = this.fixtureState.get(fixture.providerId);

      if (previous) {
        const prevHome = previous.goals.home ?? 0;
        const prevAway = previous.goals.away ?? 0;
        const currHome = fixture.goals.home ?? 0;
        const currAway = fixture.goals.away ?? 0;

        if (currHome > prevHome || currAway > prevAway) {
          emitted.push({
            type: 'goal',
            timestampUtc: nowUtc,
            fixtureId: fixture.providerId,
            summary: `GOAL: ${fixture.homeTeam.name} ${currHome}-${currAway} ${fixture.awayTeam.name} (${fixture.elapsed ?? 0}')`,
            fixture,
          });
        } else if (currHome < prevHome || currAway < prevAway) {
          emitted.push({
            type: 'score_corrected',
            timestampUtc: nowUtc,
            fixtureId: fixture.providerId,
            summary: `Score corrected: ${fixture.homeTeam.name} ${currHome}-${currAway} ${fixture.awayTeam.name}`,
            fixture,
          });
        }

        if (previous.phase !== fixture.phase) {
          emitted.push({
            type: 'status_change',
            timestampUtc: nowUtc,
            fixtureId: fixture.providerId,
            summary: `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}: ${previous.phase} → ${fixture.phase}`,
            fixture,
          });
        }
      }

      this.fixtureState.set(fixture.providerId, fixture);

      // Deduplicate and emit new match events (cards, subs, VAR, goals)
      const events = eventsByFixture.get(fixture.providerId);
      if (events && events.length > 0) {
        let seenSet = this.seenEvents.get(fixture.providerId);
        if (!seenSet) {
          seenSet = new Set<string>();
          this.seenEvents.set(fixture.providerId, seenSet);
        }

        for (const ev of events) {
          if (seenSet.has(ev.eventKey)) continue;
          seenSet.add(ev.eventKey);

          if (ev.category === 'yellow_card' || ev.category === 'red_card') {
            emitted.push({
              type: 'card',
              timestampUtc: nowUtc,
              fixtureId: fixture.providerId,
              summary: `${ev.category === 'red_card' ? 'Red Card' : 'Yellow Card'}: ${ev.playerName ?? 'Player'} (${ev.minute}')`,
              event: ev,
              fixture,
            });
          } else if (ev.category === 'substitution') {
            emitted.push({
              type: 'substitution',
              timestampUtc: nowUtc,
              fixtureId: fixture.providerId,
              summary: `Sub (${ev.minute}'): ${ev.playerName ?? ''} / ${ev.assistPlayerName ?? ''}`,
              event: ev,
              fixture,
            });
          } else if (ev.category === 'var') {
            emitted.push({
              type: 'var',
              timestampUtc: nowUtc,
              fixtureId: fixture.providerId,
              summary: `VAR (${ev.minute}'): ${ev.rawDetail || 'Review'}`,
              event: ev,
              fixture,
            });
          }
        }
      }
    }

    // Remove fixtures that are no longer live
    for (const existingId of Array.from(this.fixtureState.keys())) {
      if (!incomingIds.has(existingId)) {
        const finished = this.fixtureState.get(existingId)!;
        this.fixtureState.delete(existingId);
        this.seenEvents.delete(existingId);
        emitted.push({
          type: 'status_change',
          timestampUtc: nowUtc,
          fixtureId: existingId,
          summary: `${finished.homeTeam.name} vs ${finished.awayTeam.name} left live feed`,
          fixture: { ...finished, phase: 'FT', bucket: 'FT' },
        });
      }
    }

    if (emitted.length > 0) {
      this.recentDeltas = [...emitted, ...this.recentDeltas].slice(0, 30);
      for (const delta of emitted) {
        this.broadcast(delta);
      }
    }

    // Always fan out compact snapshot on sync when clients are connected
    if (this.sseClients.size > 0) {
      this.broadcast({
        type: 'snapshot',
        timestampUtc: nowUtc,
        liveFixtures: this.getCurrentLiveFixtures(),
      });
    }

    return emitted;
  }

  /**
   * Broadcast an ad-hoc demo update so Admin Dashboard changes stream over SSE immediately too.
   */
  broadcastCustomEvent(payload: LiveDeltaEvent): void {
    this.recentDeltas = [payload, ...this.recentDeltas].slice(0, 30);
    this.broadcast(payload);
  }

  private broadcast(event: LiveDeltaEvent): void {
    for (const client of Array.from(this.sseClients)) {
      this.sendToClient(client, event);
    }
  }

  private sendToClient(res: Response, event: LiveDeltaEvent): void {
    try {
      res.write(`event: football_update\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.sseClients.delete(res);
    }
  }
}

export const liveScoreEngine = new LiveScoreEngine(footballDataService);
