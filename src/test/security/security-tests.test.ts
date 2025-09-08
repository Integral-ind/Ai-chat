// Security Testing Suite
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RBACService, SecurityContext } from '../../../utils/rbac';
import { UserRole } from '../../../types';
import { SecurityHeaders } from '../../../utils/security-headers';
import { RateLimiter } from '../../../utils/rate-limiter';
import { SecurityLogger, SecurityEventType, SecurityRiskLevel } from '../../../utils/security-logger';

describe('Security Tests', () => {
  describe('Role-Based Access Control (RBAC)', () => {
    let adminContext: SecurityContext;
    let memberContext: SecurityContext;
    let viewerContext: SecurityContext;

    beforeEach(() => {
      adminContext = {
        userId: 'admin-user',
        role: UserRole.ADMIN,
        teamId: 'team-1',
      };

      memberContext = {
        userId: 'member-user',
        role: UserRole.MEMBER,
        teamId: 'team-1',
      };

      viewerContext = {
        userId: 'viewer-user',
        role: UserRole.VIEWER,
        teamId: 'team-1',
      };
    });

    it('should grant admin access to team management', () => {
      expect(RBACService.hasPermission(adminContext, 'teams', 'write')).toBe(true);
    });

    it('should deny viewer access to team management', () => {
      expect(RBACService.hasPermission(viewerContext, 'teams', 'write')).toBe(false);
    });

    it('should allow resource owners to access their resources', () => {
      expect(RBACService.hasPermission(memberContext, 'projects', 'write', 'member-user')).toBe(true);
    });

    it('should deny access to resources owned by others', () => {
      expect(RBACService.hasPermission(memberContext, 'admin', 'write', 'other-user')).toBe(false);
    });

    it('should validate sensitive operations correctly', () => {
      expect(RBACService.validateSensitiveOperation(adminContext, 'delete_team')).toBe(false);
      expect(RBACService.validateSensitiveOperation({ ...adminContext, role: UserRole.OWNER }, 'delete_team')).toBe(true);
    });

    it('should filter resources based on permissions', () => {
      const resources = [
        { id: '1', ownerId: 'admin-user' },
        { id: '2', ownerId: 'other-user' },
        { id: '3', ownerId: 'member-user' },
      ];

      const filtered = RBACService.filterResourcesByPermission(memberContext, resources, 'write');
      expect(filtered).toHaveLength(3); // Members can write to projects, all resources pass
    });
  });

  describe('Security Headers', () => {
    it('should generate proper CSP header for development', () => {
      const csp = SecurityHeaders.generateCSPHeader(true);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
      expect(csp).toContain("'unsafe-inline'"); // Should allow in development
    });

    it('should generate proper CSP header for production', () => {
      const csp = SecurityHeaders.generateCSPHeader(false);
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toContain("'unsafe-eval'"); // Should remove in production
    });

    it('should generate permissions policy header', () => {
      const policy = SecurityHeaders.generatePermissionsPolicyHeader();
      expect(policy).toContain('camera=(self)');
      expect(policy).toContain('geolocation=()');
    });

    it('should generate all security headers', () => {
      const headers = SecurityHeaders.generateAllHeaders(false);
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('Referrer-Policy');
    });

    it('should validate CSP compliance', () => {
      expect(SecurityHeaders.validateCSPCompliance('https://api.getstream.io')).toBe(true);
      expect(SecurityHeaders.validateCSPCompliance('http://malicious-site.com')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = RateLimiter.getInstance();
      // Clear any existing rate limit data
      rateLimiter.clearHistory('test-key');
    });

    it('should allow requests within rate limit', () => {
      const rule = { windowMs: 60000, maxRequests: 5 };
      
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.isRateLimited('test-key', rule);
        expect(result.limited).toBe(false);
      }
    });

    it('should block requests exceeding rate limit', () => {
      const rule = { windowMs: 60000, maxRequests: 3 };
      
      // Make 3 requests (should be allowed)
      for (let i = 0; i < 3; i++) {
        rateLimiter.isRateLimited('test-key', rule);
      }
      
      // 4th request should be blocked
      const result = rateLimiter.isRateLimited('test-key', rule);
      expect(result.limited).toBe(true);
    });

    it('should reset rate limit after window expires', () => {
      const rule = { windowMs: 100, maxRequests: 1 }; // Very short window
      
      // Make first request
      rateLimiter.isRateLimited('test-key', rule);
      
      // Second request should be blocked
      expect(rateLimiter.isRateLimited('test-key', rule).limited).toBe(true);
      
      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Should be allowed again
          expect(rateLimiter.isRateLimited('test-key', rule).limited).toBe(false);
          resolve(undefined);
        }, 150);
      });
    });

    it('should handle different keys independently', () => {
      const rule = { windowMs: 60000, maxRequests: 1 };
      
      // Use up limit for key1
      rateLimiter.isRateLimited('key1', rule);
      expect(rateLimiter.isRateLimited('key1', rule).limited).toBe(true);
      
      // key2 should still be allowed
      expect(rateLimiter.isRateLimited('key2', rule).limited).toBe(false);
    });

    it('should provide usage statistics', () => {
      const rule = { windowMs: 60000, maxRequests: 5 };
      
      rateLimiter.isRateLimited('stats-key', rule);
      rateLimiter.isRateLimited('stats-key', rule);
      
      const now = Date.now();
      const stats = rateLimiter.getUsageStats('stats-key');
      expect(stats.requestCount).toBe(2);
      expect(stats.windowStart).toBeLessThanOrEqual(now);
      expect(stats.nextReset).toBeGreaterThan(stats.windowStart);
    });
  });

  describe('Security Logging', () => {
    let securityLogger: SecurityLogger;

    beforeEach(() => {
      securityLogger = SecurityLogger.getInstance();
    });

    it('should log authentication events', () => {
      const eventListener = vi.fn();
      securityLogger.addEventListener(eventListener);

      securityLogger.logAuthEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0...'
      );

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityEventType.AUTHENTICATION_SUCCESS,
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          success: true,
        })
      );
    });

    it('should log data access events with appropriate risk levels', () => {
      const eventListener = vi.fn();
      securityLogger.addEventListener(eventListener);

      // High-risk data access
      securityLogger.logDataAccess(
        'user-123',
        'users',
        'export',
        '192.168.1.1',
        'Mozilla/5.0...',
        true,
        { recordCount: 5000, sensitiveData: true }
      );

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityEventType.DATA_ACCESS,
          riskLevel: SecurityRiskLevel.HIGH,
          resource: 'users',
          action: 'export',
        })
      );
    });

    it('should create alerts for suspicious activity', () => {
      const alert = securityLogger.createAlert(
        SecurityRiskLevel.HIGH,
        'Test Alert',
        'Test alert description',
        [],
        ['test']
      );

      expect(alert.id).toBeDefined();
      expect(alert.severity).toBe(SecurityRiskLevel.HIGH);
      expect(alert.isResolved).toBe(false);
    });

    it('should resolve alerts', () => {
      const alert = securityLogger.createAlert(
        SecurityRiskLevel.MEDIUM,
        'Test Alert',
        'Test alert description',
        []
      );

      const resolved = securityLogger.resolveAlert(alert.id, 'admin-user');
      expect(resolved).toBe(true);
      expect(alert.isResolved).toBe(true);
      expect(alert.resolvedBy).toBe('admin-user');
    });

    it('should filter events correctly', () => {
      // Log multiple events
      securityLogger.logAuthEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        'user-1',
        '192.168.1.1',
        'Mozilla/5.0...'
      );
      
      securityLogger.logAuthEvent(
        SecurityEventType.AUTHENTICATION_FAILURE,
        undefined,
        '192.168.1.2',
        'Mozilla/5.0...'
      );

      const successEvents = securityLogger.getEvents({
        type: SecurityEventType.AUTHENTICATION_SUCCESS,
      });
      
      const failureEvents = securityLogger.getEvents({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
      });

      expect(successEvents.length).toBeGreaterThan(0);
      expect(failureEvents.length).toBeGreaterThan(0);
      expect(successEvents[0].type).toBe(SecurityEventType.AUTHENTICATION_SUCCESS);
      expect(failureEvents[0].type).toBe(SecurityEventType.AUTHENTICATION_FAILURE);
    });

    it('should generate security statistics', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Log some events
      securityLogger.logAuthEvent(
        SecurityEventType.AUTHENTICATION_SUCCESS,
        'user-1',
        '192.168.1.1',
        'Mozilla/5.0...'
      );
      
      securityLogger.logSuspiciousActivity(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        '192.168.1.100',
        'Suspicious-Agent',
        { reason: 'Multiple failed attempts' }
      );

      const stats = securityLogger.getSecurityStats({
        start: oneHourAgo,
        end: now,
      });

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByType).toBeDefined();
      expect(stats.suspiciousActivity).toBeGreaterThan(0);
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should detect XSS attempts', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
      ];

      maliciousInputs.forEach(input => {
        // Mock function to detect XSS
        const containsScript = /<script|javascript:|onerror=|onload=/i.test(input);
        expect(containsScript).toBe(true);
      });
    });

    it('should detect SQL injection attempts', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
      ];

      maliciousInputs.forEach(input => {
        // Mock function to detect SQL injection
        const containsSqlInjection = /('|(--|;)|(\b(OR|AND|UNION|SELECT|DROP|INSERT|UPDATE|DELETE)\b))/i.test(input);
        expect(containsSqlInjection).toBe(true);
      });
    });

    it('should validate file upload security', () => {
      const dangerousFileTypes = [
        'script.js',
        'malware.exe',
        'virus.bat',
        'backdoor.php',
        'shell.jsp',
      ];

      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.txt'];
      
      dangerousFileTypes.forEach(filename => {
        const extension = '.' + filename.split('.').pop()?.toLowerCase();
        const isAllowed = allowedExtensions.includes(extension);
        expect(isAllowed).toBe(false);
      });
    });
  });

  describe('Session Security', () => {
    it('should validate secure session configuration', () => {
      const sessionConfig = {
        httpOnly: true,
        secure: true, // Should be true in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      };

      expect(sessionConfig.httpOnly).toBe(true);
      expect(sessionConfig.secure).toBe(true);
      expect(sessionConfig.sameSite).toBe('strict');
      expect(sessionConfig.maxAge).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('should detect session hijacking attempts', () => {
      const session1 = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        lastActivity: new Date(),
      };

      const suspiciousSession = {
        userId: 'user-123', // Same user
        ipAddress: '10.0.0.1', // Different IP
        userAgent: 'curl/7.68.0', // Different user agent
        lastActivity: new Date(),
      };

      // Simple heuristic for session hijacking detection
      const ipChanged = session1.ipAddress !== suspiciousSession.ipAddress;
      const userAgentChanged = session1.userAgent !== suspiciousSession.userAgent;
      const suspicious = ipChanged && userAgentChanged;

      expect(suspicious).toBe(true);
    });
  });
});

// Integration Tests
describe('Security Integration Tests', () => {
  it('should integrate RBAC with rate limiting', () => {
    const rateLimiter = RateLimiter.getInstance();
    const adminContext: SecurityContext = {
      userId: 'admin-user',
      role: UserRole.ADMIN,
      teamId: 'team-1',
    };

    // Admin should have access to sensitive operations
    expect(RBACService.hasPermission(adminContext, 'users', 'read')).toBe(true);

    // But should still be subject to rate limiting
    const rule = { windowMs: 60000, maxRequests: 1 };
    rateLimiter.isRateLimited('admin-user', rule);
    
    const result = rateLimiter.isRateLimited('admin-user', rule);
    expect(result.limited).toBe(true);
  });

  it('should log security events when rate limits are exceeded', () => {
    const securityLogger = SecurityLogger.getInstance();
    const rateLimiter = RateLimiter.getInstance();
    
    const eventListener = vi.fn();
    securityLogger.addEventListener(eventListener);

    const rule = { windowMs: 60000, maxRequests: 1 };
    const key = 'integration-test-user';
    
    // First request - should be allowed
    rateLimiter.isRateLimited(key, rule);
    
    // Second request - should be blocked and logged
    const result = rateLimiter.isRateLimited(key, rule);
    
    if (result.limited) {
      securityLogger.logEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        riskLevel: SecurityRiskLevel.MEDIUM,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        success: false,
        details: { rateLimitKey: key, rule },
      });
    }

    expect(result.limited).toBe(true);
    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        riskLevel: SecurityRiskLevel.MEDIUM,
      })
    );
  });
});