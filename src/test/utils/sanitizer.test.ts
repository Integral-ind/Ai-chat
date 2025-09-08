import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeFileName,
  sanitizeUrl,
  sanitizeFormData,
  rateLimiter
} from '../../utils/sanitizer';

describe('Sanitizer Utils', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const dirty = '<script>alert("xss")</script><p>Safe content</p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Safe content</p>');
    });

    it('should remove dangerous attributes', () => {
      const dirty = '<div onclick="alert(\'xss\')">Content</div>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('Content');
    });

    it('should allow safe HTML tags', () => {
      const safe = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const clean = sanitizeHtml(safe);
      expect(clean).toBe(safe);
    });

    it('should handle empty or invalid input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('should remove control characters', () => {
      const dirty = 'Text with\x00null\x08byte';
      const clean = sanitizeText(dirty);
      expect(clean).toBe('Text withnullbyte');
    });

    it('should trim whitespace', () => {
      const dirty = '  spaced text  ';
      const clean = sanitizeText(dirty);
      expect(clean).toBe('spaced text');
    });

    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null as any)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate and sanitize valid emails', () => {
      expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
      expect(sanitizeEmail('test.email+tag@domain.co.uk')).toBe('test.email+tag@domain.co.uk');
    });

    it('should reject invalid emails', () => {
      expect(sanitizeEmail('invalid-email')).toBe('');
      expect(sanitizeEmail('user@')).toBe('');
      expect(sanitizeEmail('@domain.com')).toBe('');
      expect(sanitizeEmail('')).toBe('');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      const dangerous = 'file<>:"/\\|?*name.txt';
      const clean = sanitizeFileName(dangerous);
      expect(clean).toBe('filename.txt');
    });

    it('should remove leading and trailing dots', () => {
      expect(sanitizeFileName('...file.txt...')).toBe('file.txt');
    });

    it('should limit length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const clean = sanitizeFileName(longName);
      expect(clean.length).toBeLessThanOrEqual(255);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
      expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should reject dangerous URLs', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBe('');
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizeUrl('ftp://malicious.com')).toBe('');
    });

    it('should reject URLs with path traversal', () => {
      expect(sanitizeUrl('https://example.com/../../../etc/passwd')).toBe('');
      expect(sanitizeUrl('https://example..com/path')).toBe('');
    });

    it('should handle invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe('');
      expect(sanitizeUrl('')).toBe('');
    });
  });

  describe('sanitizeFormData', () => {
    it('should sanitize string values', () => {
      const dirty = {
        name: '  John Doe  ',
        email: 'JOHN@EXAMPLE.COM',
        message: 'Hello\x00World'
      };
      const clean = sanitizeFormData(dirty);
      expect(clean.name).toBe('John Doe');
      expect(clean.email).toBe('JOHN@EXAMPLE.COM');
      expect(clean.message).toBe('HelloWorld');
    });

    it('should handle nested objects', () => {
      const dirty = {
        user: {
          name: '  Jane  ',
          details: {
            bio: 'Bio\x08content'
          }
        }
      };
      const clean = sanitizeFormData(dirty);
      expect(clean.user.name).toBe('Jane');
      expect(clean.user.details.bio).toBe('Biocontent');
    });

    it('should preserve non-string values', () => {
      const data = {
        name: 'John',
        age: 30,
        active: true,
        scores: [1, 2, 3]
      };
      const clean = sanitizeFormData(data);
      expect(clean.age).toBe(30);
      expect(clean.active).toBe(true);
      expect(clean.scores).toEqual([1, 2, 3]);
    });
  });

  describe('rateLimiter', () => {
    beforeEach(() => {
      rateLimiter.clear();
    });

    it('should allow requests within limit', () => {
      expect(rateLimiter.isAllowed('user1', 5)).toBe(true);
      expect(rateLimiter.isAllowed('user1', 5)).toBe(true);
      expect(rateLimiter.isAllowed('user1', 5)).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.isAllowed('user1', 5)).toBe(true);
      }
      // 6th request should be blocked
      expect(rateLimiter.isAllowed('user1', 5)).toBe(false);
    });

    it('should handle different users separately', () => {
      // User1 makes requests up to limit
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.isAllowed('user1', 5)).toBe(true);
      }
      expect(rateLimiter.isAllowed('user1', 5)).toBe(false);
      
      // User2 should still be allowed
      expect(rateLimiter.isAllowed('user2', 5)).toBe(true);
    });

    it('should reset after time window', async () => {
      // Use a very short window for testing
      const shortWindow = 100; // 100ms
      
      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        expect(rateLimiter.isAllowed('user1', 3, shortWindow)).toBe(true);
      }
      expect(rateLimiter.isAllowed('user1', 3, shortWindow)).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, shortWindow + 10));
      
      // Should be allowed again
      expect(rateLimiter.isAllowed('user1', 3, shortWindow)).toBe(true);
    });
  });
});