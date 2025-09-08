// Security Headers and Content Security Policy Configuration
export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    'default-src'?: string[];
    'script-src'?: string[];
    'style-src'?: string[];
    'img-src'?: string[];
    'font-src'?: string[];
    'connect-src'?: string[];
    'media-src'?: string[];
    'object-src'?: string[];
    'child-src'?: string[];
    'worker-src'?: string[];
    'form-action'?: string[];
    'frame-ancestors'?: string[];
    'base-uri'?: string[];
    'upgrade-insecure-requests'?: boolean;
    'block-all-mixed-content'?: boolean;
  };
  permissionsPolicy?: Record<string, string[]>;
  referrerPolicy?: string;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
}

export class SecurityHeaders {
  private static config: SecurityHeadersConfig = {
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Needed for React development
        "'unsafe-eval'", // Needed for development only
        'https://api.getstream.io',
        'https://stream-io-api.stream-io-api.com',
        'https://*.supabase.co',
        'https://unpkg.com',
        'https://cdn.jsdelivr.net',
        'https://cdn.tailwindcss.com',
        'https://cdn.quilljs.com',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Needed for styled-components and CSS-in-JS
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdn.tailwindcss.com',
        'https://cdn.quilljs.com',
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'https://*.supabase.co',
        'https://api.getstream.io',
        'https://*.stream-io-cdn.com',
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'data:',
      ],
      'connect-src': [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://api.getstream.io',
        'wss://getstream.io',
        'https://*.stream-io-api.com',
        'wss://*.stream-io-api.com',
        'https://stream-io-api.stream-io-api.com',
        'wss://stream-io-api.stream-io-api.com',
        'https://hint.stream-io-video.com',
        'https://*.stream-io-video.com',
        'wss://*.stream-io-video.com',
      ],
      'media-src': [
        "'self'",
        'https://*.supabase.co',
        'https://api.getstream.io',
        'blob:',
        'data:',
      ],
      'object-src': ["'none'"],
      'child-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
    },
    permissionsPolicy: {
      'camera': ["'self'"],
      'microphone': ["'self'"],
      'geolocation': ["'none'"],
      'gyroscope': ["'none'"],
      'magnetometer': ["'none'"],
      'payment': ["'none'"],
      'usb': ["'none'"],
      'interest-cohort': ["'none'"], // Disable FLoC
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  };

  /**
   * Generate CSP header string
   */
  static generateCSPHeader(isDevelopment: boolean = false): string {
    const csp = this.config.contentSecurityPolicy;
    if (!csp) return '';

    const directives: string[] = [];

    // Handle each directive
    Object.entries(csp).forEach(([key, value]) => {
      if (key === 'upgrade-insecure-requests' && value) {
        directives.push('upgrade-insecure-requests');
      } else if (key === 'block-all-mixed-content' && value) {
        directives.push('block-all-mixed-content');
      } else if (Array.isArray(value) && value.length > 0) {
        let sources = value;
        
        // Remove unsafe directives in production
        if (!isDevelopment && key === 'script-src') {
          sources = sources.filter(src => 
            !src.includes('unsafe-inline') && !src.includes('unsafe-eval')
          );
        }
        
        if (sources.length > 0) {
          directives.push(`${key} ${sources.join(' ')}`);
        }
      }
    });

    return directives.join('; ');
  }

  /**
   * Generate Permissions Policy header
   */
  static generatePermissionsPolicyHeader(): string {
    const policy = this.config.permissionsPolicy;
    if (!policy) return '';

    const directives = Object.entries(policy).map(([directive, allowlist]) => {
      const sources = allowlist.map(source => 
        source === "'self'" ? 'self' : 
        source === "'none'" ? '' : source
      ).join(' ');
      
      return `${directive}=(${sources})`;
    });

    return directives.join(', ');
  }

  /**
   * Generate all security headers
   */
  static generateAllHeaders(isDevelopment: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    const csp = this.generateCSPHeader(isDevelopment);
    if (csp) {
      headers['Content-Security-Policy'] = csp;
    }

    // Permissions Policy
    const permissionsPolicy = this.generatePermissionsPolicyHeader();
    if (permissionsPolicy) {
      headers['Permissions-Policy'] = permissionsPolicy;
    }

    // Other security headers
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';
    headers['X-XSS-Protection'] = '1; mode=block';
    headers['Referrer-Policy'] = this.config.referrerPolicy || 'strict-origin-when-cross-origin';
    
    // HSTS (only in production with HTTPS)
    if (!isDevelopment && this.config.strictTransportSecurity) {
      const hsts = this.config.strictTransportSecurity;
      let hstsValue = `max-age=${hsts.maxAge}`;
      if (hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (hsts.preload) hstsValue += '; preload';
      headers['Strict-Transport-Security'] = hstsValue;
    }

    // Additional security headers
    headers['X-Permitted-Cross-Domain-Policies'] = 'none';
    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Resource-Policy'] = 'same-site';

    return headers;
  }

  /**
   * Update CSP for development vs production
   */
  static updateCSPForEnvironment(isDevelopment: boolean): void {
    if (!this.config.contentSecurityPolicy) return;

    if (isDevelopment) {
      // Allow localhost for development
      this.config.contentSecurityPolicy['connect-src']?.push(
        'http://localhost:*',
        'ws://localhost:*',
        'https://localhost:*',
        'wss://localhost:*'
      );
      this.config.contentSecurityPolicy['script-src']?.push(
        'http://localhost:*'
      );
    }
  }

  /**
   * Validate CSP compliance
   */
  static validateCSPCompliance(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol;
      const hostname = urlObj.hostname;

      // Check if the URL matches allowed sources
      const connectSrc = this.config.contentSecurityPolicy?.['connect-src'] || [];
      
      return connectSrc.some(src => {
        if (src === "'self'") return false; // Would need request context
        if (src === 'https:') return protocol === 'https:';
        if (src.includes('*')) {
          const pattern = src.replace(/\*/g, '.*');
          return new RegExp(pattern).test(url);
        }
        return src === url || src === `${protocol}//${hostname}`;
      });
    } catch {
      return false;
    }
  }
}

// Vite plugin for injecting security headers
export function securityHeadersPlugin(isDevelopment: boolean = false) {
  return {
    name: 'security-headers',
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        const headers = SecurityHeaders.generateAllHeaders(isDevelopment);
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        next();
      });
    },
  };
}