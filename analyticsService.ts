import { supabase } from './supabaseClient';
import { FocusSession, Task, TaskStatus, TaskPriority } from './types';
import { Database } from './types_db';

type DbFocusSession = Database['public']['Tables']['focus_sessions']['Row'];

// Enhanced analytics interfaces
export interface ProductivityMetrics {
  completionRate: number;
  velocityTrend: number;
  burnoutRisk: number;
  efficiencyScore: number;
  complexityScore: number;
}

export interface TimeAnalytics {
  totalFocusTime: number;
  averageDailyFocus: number;
  peakProductivityHours: number[];
  focusConsistency: number;
}

export interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageCompletionTime: number;
  priorityDistribution: Record<TaskPriority, number>;
}

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user for analytics service:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated for analytics operations.");
  }
  return user;
};

const formatSupabaseError = (error: any, context: string): string => {
  let message = `An unknown error occurred in ${context}.`;
  if (error && typeof error === 'object') {
    message = `Error in ${context}: ${error.message || 'No message'}${error.details ? ` - Details: ${error.details}` : ''}${error.hint ? ` - Hint: ${error.hint}` : ''}`;
  } else if (typeof error === 'string') {
    message = `Error in ${context}: ${error}`;
  }
  console.error(message, error);
  return message;
};

const mapDbFocusSessionToFrontend = (dbSession: DbFocusSession): FocusSession => {
  return {
    userId: dbSession.user_id,
    date: dbSession.date,
    durationMs: dbSession.duration_ms,
  };
};

// Enhanced calculation utilities
const calculateTaskComplexityScore = (task: Task): number => {
  let score = 1;
  
  // Priority factor
  if (task.priority === TaskPriority.HIGH) score *= 1.5;
  else if (task.priority === TaskPriority.LOW) score *= 0.8;
  
  // Estimated hours factor
  if (task.estimatedHours) {
    score *= Math.min(task.estimatedHours / 2, 3); // Cap at 3x multiplier
  }
  
  // Dependencies factor
  if (task.dependencies && task.dependencies.length > 0) {
    score *= 1 + (task.dependencies.length * 0.2);
  }
  
  return Math.round(score * 10) / 10;
};

const calculateVelocityTrend = (tasks: Task[]): { current: number; previous: number; trend: number } => {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const currentWeekCompleted = tasks.filter(task => 
    task.status === TaskStatus.COMPLETED && 
    task.completedAt &&
    new Date(task.completedAt) >= oneWeekAgo
  ).length;

  const previousWeekCompleted = tasks.filter(task => 
    task.status === TaskStatus.COMPLETED && 
    task.completedAt &&
    new Date(task.completedAt) >= twoWeeksAgo &&
    new Date(task.completedAt) < oneWeekAgo
  ).length;

  const trend = previousWeekCompleted === 0 ? 100 : 
    ((currentWeekCompleted - previousWeekCompleted) / previousWeekCompleted) * 100;

  return { current: currentWeekCompleted, previous: previousWeekCompleted, trend };
};

const calculateBurnoutRisk = (tasks: Task[], focusSessions: FocusSession[]): number => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Recent overdue tasks
  const recentOverdue = tasks.filter(task => 
    task.dueDate && 
    new Date(task.dueDate) < now && 
    task.status !== TaskStatus.COMPLETED
  ).length;

  // High-priority incomplete tasks
  const highPriorityIncomplete = tasks.filter(task => 
    task.priority === TaskPriority.HIGH && 
    task.status !== TaskStatus.COMPLETED
  ).length;

  // Daily focus time variance (high variance = inconsistent work patterns)
  const recentSessions = focusSessions.filter(session => new Date(session.date) >= sevenDaysAgo);
  const dailyFocusTimes = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    return recentSessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.durationMs, 0);
  });

  const avgFocusTime = dailyFocusTimes.reduce((sum, time) => sum + time, 0) / dailyFocusTimes.length;
  const variance = dailyFocusTimes.reduce((sum, time) => sum + Math.pow(time - avgFocusTime, 2), 0) / dailyFocusTimes.length;
  const inconsistencyScore = variance > 0 && avgFocusTime > 0 ? Math.sqrt(variance) / avgFocusTime : 0;

  // Calculate risk score (0-100)
  const overdueWeight = Math.min(recentOverdue * 15, 40);
  const priorityWeight = Math.min(highPriorityIncomplete * 10, 30);
  const inconsistencyWeight = Math.min(inconsistencyScore * 100, 30);

  return Math.min(overdueWeight + priorityWeight + inconsistencyWeight, 100);
};

const calculateEfficiencyScore = (tasks: Task[]): number => {
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED && t.completedAt && t.estimatedHours);
  
  if (completedTasks.length === 0) return 100;

  let totalEfficiency = 0;
  completedTasks.forEach(task => {
    if (task.timeTaken && task.estimatedHours) {
      const efficiency = Math.min((task.estimatedHours / task.timeTaken) * 100, 200); // Cap at 200%
      totalEfficiency += efficiency;
    } else {
      // Default efficiency if no time tracking
      totalEfficiency += 100;
    }
  });

  return Math.round(totalEfficiency / completedTasks.length);
};

export const enhancedAnalyticsService = {
  // Original methods
  async createFocusSession(userId: string, date: string, durationMs: number): Promise<FocusSession | null> {
    if (!userId) {
      console.error("User ID is required to create a focus session.");
      throw new Error("User ID is required.");
    }
    if (durationMs <= 0) {
      console.warn("Attempted to save focus session with zero or negative duration. Skipping.");
      return null;
    }

    const sessionToInsert: Database['public']['Tables']['focus_sessions']['Insert'] = {
      user_id: userId,
      date: date,
      duration_ms: durationMs,
    };

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert(sessionToInsert)
      .select()
      .single();

    if (error) {
      console.error(formatSupabaseError(error, "enhancedAnalyticsService.createFocusSession"));
      throw new Error(formatSupabaseError(error, "enhancedAnalyticsService.createFocusSession"));
    }
    return data ? mapDbFocusSessionToFrontend(data) : null;
  },

  async getFocusSessionsForUser(userId: string, startDate?: string, endDate?: string): Promise<FocusSession[]> {
    if (!userId) {
      console.error("User ID is required to fetch focus sessions.");
      return [];
    }

    let query = supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    query = query.order('date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error(formatSupabaseError(error, "enhancedAnalyticsService.getFocusSessionsForUser"));
      throw new Error(formatSupabaseError(error, "enhancedAnalyticsService.getFocusSessionsForUser"));
    }
    if (!data) return [];
    return data.map(mapDbFocusSessionToFrontend);
  },

  async getTotalFocusTimeForWeek(userId: string, weekStartDate: string, weekEndDate: string): Promise<number> {
    const sessions = await this.getFocusSessionsForUser(userId, weekStartDate, weekEndDate);
    return sessions.reduce((total, session) => total + session.durationMs, 0);
  },

  // Enhanced analytics methods
  async getProductivityMetrics(userId: string, tasks: Task[], focusSessions: FocusSession[], timeRange: number = 30): Promise<ProductivityMetrics> {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000);
    
    const relevantTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startDate || 
      (task.dueDate && new Date(task.dueDate) >= startDate)
    );

    const completedTasks = relevantTasks.filter(t => t.status === TaskStatus.COMPLETED);
    const completionRate = relevantTasks.length > 0 ? (completedTasks.length / relevantTasks.length) * 100 : 100;
    
    const velocityMetrics = calculateVelocityTrend(tasks);
    const burnoutRisk = calculateBurnoutRisk(tasks, focusSessions);
    const efficiencyScore = calculateEfficiencyScore(relevantTasks);
    
    const averageComplexity = relevantTasks.length > 0 ? 
      relevantTasks.reduce((sum, task) => sum + calculateTaskComplexityScore(task), 0) / relevantTasks.length : 0;

    return {
      completionRate: Math.round(completionRate),
      velocityTrend: Math.round(velocityMetrics.trend),
      burnoutRisk: Math.round(burnoutRisk),
      efficiencyScore: Math.round(efficiencyScore),
      complexityScore: Math.round(averageComplexity * 10) / 10
    };
  },

  async getTimeAnalytics(userId: string, focusSessions: FocusSession[], timeRange: number = 30): Promise<TimeAnalytics> {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000);
    
    const relevantSessions = focusSessions.filter(session => new Date(session.date) >= startDate);
    
    const totalFocusTime = relevantSessions.reduce((sum, session) => sum + session.durationMs, 0);
    const activeDays = new Set(relevantSessions.map(s => s.date)).size;
    const averageDailyFocus = activeDays > 0 ? totalFocusTime / activeDays : 0;

    // Calculate focus consistency (lower variance = higher consistency)
    const dailyFocusTimes = Array.from({ length: timeRange }, (_, i) => {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      return relevantSessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.durationMs, 0);
    });

    const avgFocus = dailyFocusTimes.reduce((sum, time) => sum + time, 0) / dailyFocusTimes.length;
    const variance = dailyFocusTimes.reduce((sum, time) => sum + Math.pow(time - avgFocus, 2), 0) / dailyFocusTimes.length;
    const consistency = avgFocus > 0 ? Math.max(0, 100 - (Math.sqrt(variance) / avgFocus) * 100) : 100;

    // TODO: Implement peak productivity hours analysis from session timestamps
    const peakProductivityHours = [9, 10, 11]; // Placeholder

    return {
      totalFocusTime: Math.round(totalFocusTime),
      averageDailyFocus: Math.round(averageDailyFocus),
      peakProductivityHours,
      focusConsistency: Math.round(consistency)
    };
  },

  async getTaskAnalytics(tasks: Task[], timeRange: number = 30): Promise<TaskAnalytics> {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRange * 24 * 60 * 60 * 1000);
    
    const relevantTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startDate || 
      (task.dueDate && new Date(task.dueDate) >= startDate)
    );

    const completedTasks = relevantTasks.filter(t => t.status === TaskStatus.COMPLETED);
    const overdueTasks = relevantTasks.filter(task => 
      task.dueDate && 
      new Date(task.dueDate) < now && 
      task.status !== TaskStatus.COMPLETED
    );

    // Calculate average completion time
    const tasksWithCompletionTime = completedTasks.filter(task => 
      task.completedAt && task.createdAt
    );

    let averageCompletionTime = 0;
    if (tasksWithCompletionTime.length > 0) {
      const totalCompletionTime = tasksWithCompletionTime.reduce((sum, task) => {
        const created = new Date(task.createdAt).getTime();
        const completed = new Date(task.completedAt!).getTime();
        return sum + (completed - created);
      }, 0);
      averageCompletionTime = totalCompletionTime / tasksWithCompletionTime.length;
    }

    // Priority distribution
    const priorityDistribution = {
      [TaskPriority.HIGH]: relevantTasks.filter(t => t.priority === TaskPriority.HIGH).length,
      [TaskPriority.MEDIUM]: relevantTasks.filter(t => t.priority === TaskPriority.MEDIUM).length,
      [TaskPriority.LOW]: relevantTasks.filter(t => t.priority === TaskPriority.LOW).length,
    };

    return {
      totalTasks: relevantTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      averageCompletionTime: Math.round(averageCompletionTime / (1000 * 60 * 60)), // Convert to hours
      priorityDistribution
    };
  },

  // Advanced analytics methods
  async generateProductivityInsights(userId: string, tasks: Task[], focusSessions: FocusSession[]): Promise<string[]> {
    const insights: string[] = [];
    
    const velocityMetrics = calculateVelocityTrend(tasks);
    const burnoutRisk = calculateBurnoutRisk(tasks, focusSessions);
    const efficiencyScore = calculateEfficiencyScore(tasks);

    // Velocity insights
    if (velocityMetrics.trend > 20) {
      insights.push(`Excellent momentum! You're completing ${velocityMetrics.trend.toFixed(0)}% more tasks than last week.`);
    } else if (velocityMetrics.trend < -20) {
      insights.push(`Task completion has slowed by ${Math.abs(velocityMetrics.trend).toFixed(0)}%. Consider reviewing your workload.`);
    }

    // Burnout insights
    if (burnoutRisk > 70) {
      insights.push("High burnout risk detected. Consider taking breaks and reducing workload.");
    } else if (burnoutRisk < 30) {
      insights.push("Great work-life balance! Your stress levels appear manageable.");
    }

    // Efficiency insights
    if (efficiencyScore > 120) {
      insights.push("Outstanding efficiency! You're completing tasks faster than estimated.");
    } else if (efficiencyScore < 80) {
      insights.push("Tasks are taking longer than expected. Consider breaking them into smaller parts.");
    }

    // Focus pattern insights
    const recentSessions = focusSessions.filter(session => {
      const sessionDate = new Date(session.date);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return sessionDate >= sevenDaysAgo;
    });

    const avgDailyFocus = recentSessions.length > 0 ? 
      recentSessions.reduce((sum, s) => sum + s.durationMs, 0) / (7 * 1000 * 60 * 60) : 0;

    if (avgDailyFocus > 6) {
      insights.push("You're maintaining excellent focus! Consider this your productivity sweet spot.");
    } else if (avgDailyFocus < 2) {
      insights.push("Try to increase your focused work sessions for better productivity.");
    }

    // Task priority insights
    const highPriorityTasks = tasks.filter(t => t.priority === TaskPriority.HIGH);
    const completedHighPriority = highPriorityTasks.filter(t => t.status === TaskStatus.COMPLETED);
    
    if (highPriorityTasks.length > 0) {
      const highPriorityCompletion = (completedHighPriority.length / highPriorityTasks.length) * 100;
      if (highPriorityCompletion < 60) {
        insights.push("Focus on completing high-priority tasks first to improve overall productivity.");
      }
    }

    return insights.slice(0, 3); // Return top 3 insights
  },

  async getPeakProductivityHours(userId: string, focusSessions: FocusSession[]): Promise<number[]> {
    // This would require session timestamps. For now, return common peak hours
    // In a real implementation, you'd analyze when users have their longest/most frequent sessions
    
    const hourlyFocus: Record<number, number> = {};
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyFocus[i] = 0;
    }

    // TODO: If focus sessions had start times, we could analyze this properly
    // For now, return research-backed peak productivity hours
    return [9, 10, 11, 14, 15]; // 9-11 AM and 2-3 PM are typically peak hours
  },

  async getTaskComplexityTrends(tasks: Task[], timeRange: number = 30): Promise<Array<{date: string, complexity: number}>> {
    const now = new Date();
    const trends = [];

    for (let i = timeRange - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTasks = tasks.filter(task => 
        task.completedAt?.startsWith(dateStr) && task.status === TaskStatus.COMPLETED
      );

      const avgComplexity = dayTasks.length > 0 ? 
        dayTasks.reduce((sum, task) => sum + calculateTaskComplexityScore(task), 0) / dayTasks.length : 0;

      trends.push({
        date: dateStr,
        complexity: Math.round(avgComplexity * 10) / 10
      });
    }

    return trends;
  },

  async getFocusSessionStreaks(userId: string, focusSessions: FocusSession[]): Promise<{current: number, longest: number}> {
    if (focusSessions.length === 0) return { current: 0, longest: 0 };

    // Sort sessions by date
    const sortedSessions = focusSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check if current streak is active (session today or yesterday)
    const hasRecentSession = sortedSessions.some(s => s.date === today || s.date === yesterday);
    
    if (hasRecentSession) {
      // Calculate current streak working backwards from most recent session
      for (let i = sortedSessions.length - 1; i > 0; i--) {
        const currentDate = new Date(sortedSessions[i].date);
        const previousDate = new Date(sortedSessions[i - 1].date);
        const dayDiff = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
      currentStreak++; // Include the most recent session
    }

    // Calculate longest streak
    for (let i = 1; i < sortedSessions.length; i++) {
      const currentDate = new Date(sortedSessions[i].date);
      const previousDate = new Date(sortedSessions[i - 1].date);
      const dayDiff = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak };
  },

  // Utility methods
  calculateTaskComplexityScore,
  calculateVelocityTrend,
  calculateBurnoutRisk,
  calculateEfficiencyScore,

};

// Export the enhanced service as the default
export const analyticsService = enhancedAnalyticsService;