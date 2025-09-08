// Enhanced Security Logging & Monitoring System
import React from 'react';

export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'auth_success',
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_DENIED = 'authz_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  SESSION_CREATED = 'session_created',
  SESSION_TERMINATED = 'session_terminated',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCKED = 'account_locked',
  MALICIOUS_REQUEST = 'malicious_request',
  FILE_UPLOAD = 'file_upload',
  EXPORT_DATA = 'export_data',
  CONFIGURATION_CHANGE = 'config_change',
}

export enum SecurityRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  riskLevel: SecurityRiskLevel;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  resource?: string;
  action?: string;
  success: boolean;
  details: Record<string, any>;
  metadata?: {
    requestId?: string;
    traceId?: string;
    geolocation?: string;
    deviceFingerprint?: string;
  };
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: SecurityRiskLevel;
  title: string;
  description: string;
  events: SecurityEvent[];
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  tags: string[];
}

export class SecurityLogger {
  private static instance: SecurityLogger;
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private listeners: ((event: SecurityEvent) => void)[] = [];
  
  // Anomaly detection thresholds
  private readonly ANOMALY_THRESHOLDS = {
    failedLoginAttempts: 5,
    rapidRequests: 100, // requests per minute
    suspiciousIpChanges: 3, // different IPs in short time
    privilegeEscalationAttempts: 1,
    unusualDataAccess: 10, // large data exports
  };

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  /**
   * Log a security event
   */
  logEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...eventData,
    };

    this.events.push(event);
    this.notifyListeners(event);
    this.detectAnomalies(event);
    this.sendToExternalSystems(event);

    // Keep only last 10000 events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    type: SecurityEventType.AUTHENTICATION_SUCCESS | SecurityEventType.AUTHENTICATION_FAILURE,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any> = {}
  ): void {
    this.logEvent({
      type,
      riskLevel: type === SecurityEventType.AUTHENTICATION_FAILURE ? SecurityRiskLevel.MEDIUM : SecurityRiskLevel.LOW,
      userId,
      ipAddress,
      userAgent,
      success: type === SecurityEventType.AUTHENTICATION_SUCCESS,
      details: {
        method: details.method || 'password',
        provider: details.provider,
        ...details,
      },
    });
  }

  /**
   * Log data access events
   */
  logDataAccess(
    userId: string,
    resource: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    details: Record<string, any> = {}
  ): void {
    const riskLevel = this.calculateDataAccessRisk(resource, action, details);
    
    this.logEvent({
      type: SecurityEventType.DATA_ACCESS,
      riskLevel,
      userId,
      ipAddress,
      userAgent,
      resource,
      action,
      success,
      details: {
        recordCount: details.recordCount,
        sensitiveData: details.sensitiveData,
        exportFormat: details.exportFormat,
        ...details,
      },
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    type: SecurityEventType,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>,
    userId?: string
  ): void {
    this.logEvent({
      type,
      riskLevel: SecurityRiskLevel.HIGH,
      userId,
      ipAddress,
      userAgent,
      success: false,
      details: {
        suspicionReason: details.reason,
        detectionMethod: details.detectionMethod,
        confidence: details.confidence,
        ...details,
      },
    });
  }

  /**
   * Create security alert
   */
  createAlert(
    severity: SecurityRiskLevel,
    title: string,
    description: string,
    relatedEvents: SecurityEvent[],
    tags: string[] = []
  ): SecurityAlert {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      severity,
      title,
      description,
      events: relatedEvents,
      isResolved: false,
      tags,
    };

    this.alerts.push(alert);
    this.sendAlertNotification(alert);
    
    return alert;
  }

  /**
   * Resolve security alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.isResolved) {
      alert.isResolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get events with filtering
   */
  getEvents(filters: {
    startDate?: Date;
    endDate?: Date;
    type?: SecurityEventType;
    userId?: string;
    riskLevel?: SecurityRiskLevel;
    ipAddress?: string;
    limit?: number;
  } = {}): SecurityEvent[] {
    let filteredEvents = [...this.events];

    if (filters.startDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endDate!);
    }
    if (filters.type) {
      filteredEvents = filteredEvents.filter(e => e.type === filters.type);
    }
    if (filters.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    }
    if (filters.riskLevel) {
      filteredEvents = filteredEvents.filter(e => e.riskLevel === filters.riskLevel);
    }
    if (filters.ipAddress) {
      filteredEvents = filteredEvents.filter(e => e.ipAddress === filters.ipAddress);
    }

    // Sort by timestamp (most recent first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filters.limit ? filteredEvents.slice(0, filters.limit) : filteredEvents;
  }

  /**
   * Get security statistics
   */
  getSecurityStats(timeRange: { start: Date; end: Date }): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsByRiskLevel: Record<SecurityRiskLevel, number>;
    topIpAddresses: Array<{ ip: string; count: number }>;
    suspiciousActivity: number;
    activeAlerts: number;
  } {
    const events = this.getEvents({
      startDate: timeRange.start,
      endDate: timeRange.end,
    });

    const eventsByType: Record<SecurityEventType, number> = {} as any;
    const eventsByRiskLevel: Record<SecurityRiskLevel, number> = {} as any;
    const ipCounts: Record<string, number> = {};

    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByRiskLevel[event.riskLevel] = (eventsByRiskLevel[event.riskLevel] || 0) + 1;
      ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
    });

    const topIpAddresses = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const suspiciousActivity = events.filter(e => 
      e.type === SecurityEventType.SUSPICIOUS_ACTIVITY ||
      e.riskLevel === SecurityRiskLevel.HIGH ||
      e.riskLevel === SecurityRiskLevel.CRITICAL
    ).length;

    const activeAlerts = this.alerts.filter(a => !a.isResolved).length;

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByRiskLevel,
      topIpAddresses,
      suspiciousActivity,
      activeAlerts,
    };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: SecurityEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: SecurityEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Private methods
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(event: SecurityEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in security event listener:', error);
      }
    });
  }

  private calculateDataAccessRisk(resource: string, action: string, details: Record<string, any>): SecurityRiskLevel {
    // High-risk data access patterns
    if (details.recordCount > 1000) return SecurityRiskLevel.HIGH;
    if (details.sensitiveData) return SecurityRiskLevel.HIGH;
    if (action === 'export' || action === 'download') return SecurityRiskLevel.MEDIUM;
    if (resource.includes('user') || resource.includes('admin')) return SecurityRiskLevel.MEDIUM;
    
    return SecurityRiskLevel.LOW;
  }

  private detectAnomalies(event: SecurityEvent): void {
    // Failed login attempts
    if (event.type === SecurityEventType.AUTHENTICATION_FAILURE) {
      const recentFailures = this.getEvents({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        ipAddress: event.ipAddress,
        startDate: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes
      });

      if (recentFailures.length >= this.ANOMALY_THRESHOLDS.failedLoginAttempts) {
        this.createAlert(
          SecurityRiskLevel.HIGH,
          'Multiple Failed Login Attempts',
          `${recentFailures.length} failed login attempts from IP ${event.ipAddress}`,
          [event, ...recentFailures.slice(0, 5)],
          ['brute-force', 'authentication', 'ip-based']
        );
      }
    }

    // Rapid requests (potential DoS)
    if (event.ipAddress) {
      const recentRequests = this.getEvents({
        ipAddress: event.ipAddress,
        startDate: new Date(Date.now() - 60 * 1000), // 1 minute
      });

      if (recentRequests.length >= this.ANOMALY_THRESHOLDS.rapidRequests) {
        this.createAlert(
          SecurityRiskLevel.MEDIUM,
          'Rapid Request Pattern Detected',
          `${recentRequests.length} requests in 1 minute from IP ${event.ipAddress}`,
          [event, ...recentRequests.slice(0, 10)],
          ['dos', 'rate-limiting', 'ip-based']
        );
      }
    }

    // Privilege escalation attempts
    if (event.type === SecurityEventType.PRIVILEGE_ESCALATION) {
      this.createAlert(
        SecurityRiskLevel.CRITICAL,
        'Privilege Escalation Attempt Detected',
        `Unauthorized privilege escalation attempt by user ${event.userId}`,
        [event],
        ['privilege-escalation', 'critical', 'user-based']
      );
    }
  }

  private sendToExternalSystems(event: SecurityEvent): void {
    // Send to external SIEM/logging systems
    if (event.riskLevel === SecurityRiskLevel.HIGH || event.riskLevel === SecurityRiskLevel.CRITICAL) {
      // Send to external monitoring systems
      console.warn('HIGH RISK SECURITY EVENT:', {
        type: event.type,
        risk: event.riskLevel,
        user: event.userId,
        ip: event.ipAddress,
        details: event.details,
      });
      
      // TODO: Implement integration with external systems
      // - Send to SIEM
      // - Send to Slack/Discord webhook
      // - Send to monitoring service
    }
  }

  private sendAlertNotification(alert: SecurityAlert): void {
    console.error('SECURITY ALERT:', {
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      eventCount: alert.events.length,
    });
    
    // TODO: Implement alert notifications
    // - Send email to security team
    // - Send to monitoring dashboard
    // - Create incident ticket
  }
}

// React Hook for security logging
export function useSecurityLogger() {
  const logger = SecurityLogger.getInstance();
  
  return {
    logEvent: logger.logEvent.bind(logger),
    logAuthEvent: logger.logAuthEvent.bind(logger),
    logDataAccess: logger.logDataAccess.bind(logger),
    logSuspiciousActivity: logger.logSuspiciousActivity.bind(logger),
    getEvents: logger.getEvents.bind(logger),
    getSecurityStats: logger.getSecurityStats.bind(logger),
    addEventListener: logger.addEventListener.bind(logger),
    removeEventListener: logger.removeEventListener.bind(logger),
  };
}

// Higher-order component for automatic security logging
export function withSecurityLogging<T extends object>(
  Component: React.ComponentType<T>,
  resource: string
) {
  return function SecurityLoggedComponent(props: T) {
    const logger = useSecurityLogger();
    
    React.useEffect(() => {
      logger.logDataAccess(
        'current-user-id', // Get from context
        resource,
        'view',
        'client-ip', // Get from request
        navigator.userAgent,
        true
      );
    }, []);
    
    return React.createElement(Component, props);
  };
}