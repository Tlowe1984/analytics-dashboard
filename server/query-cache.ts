/**
 * Simple in-memory query cache
 * 
 * Since dashboard data updates only once per day (6 AM sync),
 * we can cache query results to reduce database load.
 * 
 * Cache is automatically invalidated after sync completes.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 0; // Disabled - production and sandbox share same database

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryEstimateMB: (JSON.stringify(Array.from(this.cache.entries())).length / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Singleton instance
export const queryCache = new QueryCache();

// Run cleanup every 5 minutes
setInterval(() => {
  queryCache.cleanup();
}, 1000 * 60 * 5);

/**
 * Helper function to wrap database queries with caching
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = queryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute query
  const result = await queryFn();

  // Store in cache
  queryCache.set(key, result, ttl);

  return result;
}

/**
 * Invalidate all dashboard-related cache after sync
 */
export function invalidateDashboardCache(): void {
  queryCache.invalidatePattern(/^dashboard:/);
  queryCache.invalidatePattern(/^software:/);
  queryCache.invalidatePattern(/^systems:/);
  queryCache.invalidatePattern(/^decisions:/);
  queryCache.invalidatePattern(/^reviews:/);
  queryCache.invalidatePattern(/^milestones:/);
  queryCache.invalidatePattern(/^ai:/);
  
  console.log(`[${new Date().toISOString()}] Dashboard cache invalidated`);
}
