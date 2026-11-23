export type RequestPriority = 'high' | 'normal' | 'low';

export interface ProviderErrorLog {
  timestampUtc: string;
  endpoint: string;
  statusCode: number | null;
  message: string;
}

export interface QuotaSnapshot {
  dayKeyUtc: string;
  requestsToday: number;
  dailyLimit: number;
  remainingToday: number;
  requestsLastMinute: number;
  perMinuteLimit: number;
  backoffUntilUtc: string | null;
  isBackoffActive: boolean;
  lastSuccessfulSyncUtc: string | null;
  recentErrors: ProviderErrorLog[];
}

export class QuotaTracker {
  private dayKeyUtc: string;
  private requestsToday = 0;
  private dailyLimit: number;
  private perMinuteLimit: number;
  private reserveBuffer: number;
  private minuteTimestamps: number[] = [];
  private backoffUntilMs = 0;
  private consecutive429s = 0;
  private lastSuccessfulSyncUtc: string | null = null;
  private recentErrors: ProviderErrorLog[] = [];

  constructor(dailyLimit = 100, perMinuteLimit = 10, reserveBuffer = 5) {
    this.dayKeyUtc = this.currentDayKey();
    this.dailyLimit = dailyLimit;
    this.perMinuteLimit = perMinuteLimit;
    this.reserveBuffer = reserveBuffer;
  }

  private currentDayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private rolloverIfNeeded(): void {
    const today = this.currentDayKey();
    if (today !== this.dayKeyUtc) {
      this.dayKeyUtc = today;
      this.requestsToday = 0;
      this.consecutive429s = 0;
      this.backoffUntilMs = 0;
    }
  }

  private pruneMinuteWindow(now: number): void {
    const cutoff = now - 60_000;
    this.minuteTimestamps = this.minuteTimestamps.filter((ts) => ts > cutoff);
  }

  canMakeRequest(priority: RequestPriority = 'normal'): { allowed: boolean; reason?: string } {
    this.rolloverIfNeeded();
    const now = Date.now();
    this.pruneMinuteWindow(now);

    if (now < this.backoffUntilMs) {
      const waitSec = Math.ceil((this.backoffUntilMs - now) / 1000);
      return {
        allowed: false,
        reason: `Rate-limit backoff active for ${waitSec}s after upstream HTTP 429`,
      };
    }

    const effectiveDailyCap =
      priority === 'high' ? this.dailyLimit : Math.max(0, this.dailyLimit - this.reserveBuffer);

    if (this.requestsToday >= effectiveDailyCap) {
      return {
        allowed: false,
        reason: `Daily API quota limit reached (${this.requestsToday}/${this.dailyLimit})`,
      };
    }

    if (this.minuteTimestamps.length >= this.perMinuteLimit) {
      return {
        allowed: false,
        reason: `Per-minute rate limit reached (${this.minuteTimestamps.length}/${this.perMinuteLimit}/min)`,
      };
    }

    return { allowed: true };
  }

  recordRequest(): void {
    this.rolloverIfNeeded();
    const now = Date.now();
    this.pruneMinuteWindow(now);
    this.requestsToday += 1;
    this.minuteTimestamps.push(now);
  }

  recordSuccess(): void {
    this.consecutive429s = 0;
    this.backoffUntilMs = 0;
    this.lastSuccessfulSyncUtc = new Date().toISOString();
  }

  syncUpstreamHeaders(headers: Headers): void {
    const remainingHeader = headers.get('x-ratelimit-requests-remaining');
    const limitHeader = headers.get('x-ratelimit-requests-limit');
    if (limitHeader) {
      const parsedLimit = Number.parseInt(limitHeader, 10);
      if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        this.dailyLimit = parsedLimit;
      }
    }
    if (remainingHeader) {
      const parsedRemaining = Number.parseInt(remainingHeader, 10);
      if (Number.isFinite(parsedRemaining) && parsedRemaining >= 0) {
        this.requestsToday = Math.max(0, this.dailyLimit - parsedRemaining);
      }
    }
  }

  recordRateLimit429(endpoint: string, retryAfterSec?: number): number {
    this.consecutive429s += 1;
    const baseDelaySec = retryAfterSec ?? Math.min(300, 15 * Math.pow(2, this.consecutive429s - 1));
    this.backoffUntilMs = Date.now() + baseDelaySec * 1000;
    this.recordError(endpoint, 429, `HTTP 429 Too Many Requests — backing off ${baseDelaySec}s`);
    return baseDelaySec;
  }

  recordError(endpoint: string, statusCode: number | null, message: string): void {
    this.recentErrors.unshift({
      timestampUtc: new Date().toISOString(),
      endpoint,
      statusCode,
      message: message.slice(0, 260),
    });
    if (this.recentErrors.length > 25) {
      this.recentErrors.length = 25;
    }
  }

  getSnapshot(): QuotaSnapshot {
    this.rolloverIfNeeded();
    const now = Date.now();
    this.pruneMinuteWindow(now);
    return {
      dayKeyUtc: this.dayKeyUtc,
      requestsToday: this.requestsToday,
      dailyLimit: this.dailyLimit,
      remainingToday: Math.max(0, this.dailyLimit - this.requestsToday),
      requestsLastMinute: this.minuteTimestamps.length,
      perMinuteLimit: this.perMinuteLimit,
      backoffUntilUtc: now < this.backoffUntilMs ? new Date(this.backoffUntilMs).toISOString() : null,
      isBackoffActive: now < this.backoffUntilMs,
      lastSuccessfulSyncUtc: this.lastSuccessfulSyncUtc,
      recentErrors: this.recentErrors,
    };
  }
}
