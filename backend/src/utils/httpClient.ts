import { ALLOWED_PROVIDER_HOSTS } from '../config/env.ts';
import type { QuotaTracker, RequestPriority } from './quotaTracker.ts';

export class ProviderHttpError extends Error {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly retryable: boolean;

  constructor(message: string, statusCode: number, endpoint: string, retryable = false) {
    super(message);
    this.name = 'ProviderHttpError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.retryable = retryable;
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  quotaTracker: QuotaTracker;
  fetchImpl?: typeof fetch;
}

export class ResilientProviderHttpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly quotaTracker: QuotaTracker;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpClientOptions) {
    const parsed = new URL(options.baseUrl);
    if (parsed.protocol !== 'https:' || !ALLOWED_PROVIDER_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error(`Blocked outbound provider host: ${parsed.hostname}`);
    }
    this.baseUrl = parsed.origin;
    this.headers = options.headers;
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
    this.quotaTracker = options.quotaTracker;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getJson<T>(
    endpoint: string,
    query: Record<string, string | number | undefined> = {},
    priority: RequestPriority = 'normal'
  ): Promise<T> {
    const gate = this.quotaTracker.canMakeRequest(priority);
    if (!gate.allowed) {
      throw new ProviderHttpError(gate.reason ?? 'Quota exceeded', 429, endpoint, false);
    }

    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${safeEndpoint}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        this.quotaTracker.recordRequest();
        const response = await this.fetchImpl(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...this.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);
        this.quotaTracker.syncUpstreamHeaders(response.headers);

        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
          const backoffSec = this.quotaTracker.recordRateLimit429(
            safeEndpoint,
            Number.isFinite(retryAfter) ? retryAfter : undefined
          );
          throw new ProviderHttpError(
            `Upstream provider rate limit hit (HTTP 429). Backing off ${backoffSec}s.`,
            429,
            safeEndpoint,
            false
          );
        }

        if (response.status >= 500 && attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(300 * Math.pow(2, attempt - 1));
          continue;
        }

        if (!response.ok) {
          const msg = `Provider returned HTTP ${response.status} on ${safeEndpoint}`;
          this.quotaTracker.recordError(safeEndpoint, response.status, msg);
          throw new ProviderHttpError(msg, response.status, safeEndpoint, false);
        }

        const payload = (await response.json()) as T & {
          errors?: Record<string, string> | string[];
        };

        // API-Football returns 200 OK even on plan/key/rate errors inside payload.errors
        if (payload && typeof payload === 'object' && 'errors' in payload && payload.errors) {
          const errList = Array.isArray(payload.errors)
            ? payload.errors
            : Object.values(payload.errors);
          if (errList.length > 0) {
            const combined = errList.join('; ');
            if (combined.toLowerCase().includes('rate') || combined.toLowerCase().includes('requests')) {
              this.quotaTracker.recordRateLimit429(safeEndpoint, 60);
              throw new ProviderHttpError(combined, 429, safeEndpoint, false);
            }
            this.quotaTracker.recordError(safeEndpoint, 400, combined);
            throw new ProviderHttpError(combined, 400, safeEndpoint, false);
          }
        }

        this.quotaTracker.recordSuccess();
        return payload;
      } catch (err) {
        clearTimeout(timeoutHandle);
        if (err instanceof ProviderHttpError) {
          throw err;
        }
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(250 * Math.pow(2, attempt - 1));
          continue;
        }
        const msg = isAbort
          ? `Provider request timed out after ${this.timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : 'Network error contacting football data provider';
        this.quotaTracker.recordError(safeEndpoint, isAbort ? 504 : 502, msg);
        throw new ProviderHttpError(msg, isAbort ? 504 : 502, safeEndpoint, false);
      }
    }

    throw new ProviderHttpError('Exhausted retries contacting provider', 502, safeEndpoint, false);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
