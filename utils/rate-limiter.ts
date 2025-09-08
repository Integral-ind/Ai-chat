// Advanced Rate Limiting System
export interface RateLimitRule {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any, res: any) => void;
}

export interface RateLimitConfig {
  // Global rate limits
  global: RateLimitRule;
  
  // API-specific rate limits
  api: {
    auth: RateLimitRule;
    fileUpload: RateLimitRule;
    search: RateLimitRule;
    messaging: RateLimitRule;
    videoCall: RateLimitRule;
  };
  
  // User-based rate limits
  userSpecific: {
    [userId: string]: RateLimitRule;
  };
}

export class RateLimiter {
  private static instance: RateLimiter;
  private requests: Map<string, Array<{ timestamp: number; success: boolean }>> = new Map();
  private config: RateLimitConfig;

  constructor() {
    this.config = {
      global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000, // 1000 requests per 15 min per IP
      },
      api: {
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 5, // 5 login attempts per 15 min
          skipSuccessfulRequests: true,
        },
        fileUpload: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 10, // 10 uploads per minute
        },
        search: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 100, // 100 searches per minute
        },
        messaging: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 60, // 60 messages per minute
        },
        videoCall: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 10, // 10 call attempts per minute
        },
      },
      userSpecific: {},
    };
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if request should be rate limited
   */
  isRateLimited(
    key: string, 
    rule: RateLimitRule, 
    isSuccess: boolean = true
  ): { limited: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    
    // Get or create request history for this key
    let requestHistory = this.requests.get(key) || [];
    
    // Clean old requests outside the window
    requestHistory = requestHistory.filter(req => req.timestamp > windowStart);
    
    // Filter requests based on rule configuration
    let relevantRequests = requestHistory;
    if (rule.skipSuccessfulRequests) {
      relevantRequests = requestHistory.filter(req => !req.success);
    }
    if (rule.skipFailedRequests) {
      relevantRequests = requestHistory.filter(req => req.success);
    }
    
    // Check if limit exceeded
    const currentCount = relevantRequests.length;
    const isLimited = currentCount >= rule.maxRequests;
    
    if (!isLimited) {
      // Add current request to history
      requestHistory.push({ timestamp: now, success: isSuccess });
      this.requests.set(key, requestHistory);
    }
    
    return {
      limited: isLimited,
      resetTime: windowStart + rule.windowMs,
      remaining: Math.max(0, rule.maxRequests - currentCount - (isLimited ? 0 : 1)),
    };
  }

  /**
   * Rate limit middleware for different endpoints
   */
  createMiddleware(ruleType: keyof RateLimitConfig['api'] | 'global') {
    return (req: any, res: any, next: any) => {
      const rule = ruleType === 'global' 
        ? this.config.global 
        : this.config.api[ruleType as keyof RateLimitConfig['api']];
      
      const key = this.generateKey(req, rule);
      const result = this.isRateLimited(key, rule);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rule.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
      if (result.resetTime) {
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      }
      
      if (result.limited) {
        if (rule.onLimitReached) {
          rule.onLimitReached(req, res);
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(rule.windowMs / 1000)} seconds.`,
          retryAfter: Math.ceil(rule.windowMs / 1000),
        });
      }
      
      next();
    };
  }

  /**
   * Generate unique key for rate limiting
   */
  private generateKey(req: any, rule: RateLimitRule): string {
    if (rule.keyGenerator) {
      return rule.keyGenerator(req);
    }
    
    // Default key generation: IP + user ID (if available)
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userId = req.user?.id || req.headers['x-user-id'] || '';
    return `${ip}-${userId}`;
  }

  /**
   * Add custom rate limit for specific user
   */
  setUserRateLimit(userId: string, rule: RateLimitRule): void {
    this.config.userSpecific[userId] = rule;
  }

  /**
   * Remove user-specific rate limit
   */
  removeUserRateLimit(userId: string): void {
    delete this.config.userSpecific[userId];
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(key: string): { 
    requestCount: number; 
    windowStart: number; 
    nextReset: number; 
  } {
    const requestHistory = this.requests.get(key) || [];
    const windowMs = this.config.global.windowMs;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const recentRequests = requestHistory.filter(req => req.timestamp > windowStart);
    
    return {
      requestCount: recentRequests.length,
      windowStart,
      nextReset: windowStart + windowMs,
    };
  }

  /**
   * Clear rate limit history for a key
   */
  clearHistory(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clean up old entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const maxWindowMs = Math.max(
      this.config.global.windowMs,
      ...Object.values(this.config.api).map(rule => rule.windowMs)
    );
    
    this.requests.forEach((history, key) => {
      const cutoff = now - maxWindowMs * 2; // Keep extra buffer
      const cleanHistory = history.filter(req => req.timestamp > cutoff);
      
      if (cleanHistory.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, cleanHistory);
      }
    });
  }
}

// Supabase Edge Function Rate Limiter
export class SupabaseRateLimiter {
  /**
   * Rate limiter specifically for Supabase Edge Functions
   */
  static async checkRateLimit(
    request: Request,
    rule: RateLimitRule
  ): Promise<{ allowed: boolean; headers: Record<string, string> }> {
    const url = new URL(request.url);
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userId = request.headers.get('authorization')?.split(' ')[1] || '';
    
    const key = `${ip}-${userId}-${url.pathname}`;
    const limiter = RateLimiter.getInstance();
    const result = limiter.isRateLimited(key, rule);
    
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': rule.maxRequests.toString(),
      'X-RateLimit-Remaining': (result.remaining || 0).toString(),
    };
    
    if (result.resetTime) {
      headers['X-RateLimit-Reset'] = Math.ceil(result.resetTime / 1000).toString();
    }
    
    return {
      allowed: !result.limited,
      headers,
    };
  }
}

// Rate limiting decorator for class methods
export function RateLimit(rule: RateLimitRule) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const limiter = RateLimiter.getInstance();
    
    descriptor.value = function (...args: any[]) {
      const key = `${target.constructor.name}-${propertyName}-${JSON.stringify(args)}`;
      const result = limiter.isRateLimited(key, rule);
      
      if (result.limited) {
        throw new Error(`Rate limit exceeded for ${propertyName}. Try again later.`);
      }
      
      return method.apply(this, args);
    };
  };
}

// Initialize cleanup interval
setInterval(() => {
  RateLimiter.getInstance().cleanup();
}, 10 * 60 * 1000); // Cleanup every 10 minutes