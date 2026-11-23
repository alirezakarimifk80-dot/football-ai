export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  tags: string[];
}

export interface CacheStats {
  backend: 'memory' | 'redis-ready-memory';
  entries: number;
  hits: number;
  misses: number;
  hitRatePercent: number;
  inFlightDeduplicated: number;
  evictions: number;
}

/**
 * Shared server-side cache with TTL policies, tag invalidation, and in-flight
 * request deduplication so multiple concurrent users share a single upstream
 * provider call. Designed with an async interface compatible with Redis drop-in.
 */
export class CacheManager {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;
  private deduplicated = 0;
  private evictions = 0;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number, tags: string[] = []): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions += 1;
      }
    }
    const now = Date.now();
    this.store.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      tags,
    });
  }

  async getOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    tags: string[] = []
  ): Promise<{ value: T; cached: boolean }> {
    const cachedVal = this.get<T>(key);
    if (cachedVal !== undefined) {
      return { value: cachedVal, cached: true };
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      this.deduplicated += 1;
      const value = (await existingPromise) as T;
      return { value, cached: true };
    }

    const fetchPromise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlSeconds, tags);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    const value = await fetchPromise;
    return { value, cached: false };
  }

  invalidateByTag(tag: string): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): number {
    const count = this.store.size;
    this.store.clear();
    return count;
  }

  getStats(): CacheStats {
    // Prune expired lazily for accurate count
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    const total = this.hits + this.misses;
    return {
      backend: 'redis-ready-memory',
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatePercent: total > 0 ? Math.round((this.hits / total) * 1000) / 10 : 0,
      inFlightDeduplicated: this.deduplicated,
      evictions: this.evictions,
    };
  }
}

export const sharedCache = new CacheManager(1500);
