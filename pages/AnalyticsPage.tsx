import React, { useMemo, useContext, useState, useEffect } from 'react';
import { Card, Button, ProgressBar, StatCard } from '../components';
import { Task, TaskStatus, TaskPriority, Project as ProjectType, StatCardData, DailyPerformance, TaskDistributionItem, DarkModeContextType, FocusSession, User as FrontendUser } from '../types';
import { 
    CheckBadgeIcon, ClockFastForwardIcon, BrainCircuitIcon, BullseyeArrowIcon, LightBulbIcon,
    ANALYTICS_CHART_COLORS, SparklesIcon as TagIcon, ChartBarIcon, TableCellsIcon, TrendingUpIcon, TrendingDownIcon, CalendarIcon
} from '../constants';
import { DarkModeContext } from '../App'; 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, ComposedChart } from 'recharts';
import { supabase } from '../supabaseClient'; 
import { analyticsService } from '../analyticsService';

// Helper functions
const toYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDuration = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Enhanced analytics algorithms
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

  const trend = previousWeekCompleted === 0 ? 
    (currentWeekCompleted > 0 ? 100 : 0) : 
    ((currentWeekCompleted - previousWeekCompleted) / previousWeekCompleted) * 100;

  return { current: currentWeekCompleted, previous: previousWeekCompleted, trend };
};

const calculateBurnoutRisk = (tasks: Task[], focusSessions: FocusSession[]): number => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentOverdue = tasks.filter(task => 
    task.dueDate && 
    new Date(task.dueDate) < now && 
    task.status !== TaskStatus.COMPLETED
  ).length;

  const highPriorityIncomplete = tasks.filter(task => 
    task.priority === TaskPriority.HIGH && 
    task.status !== TaskStatus.COMPLETED
  ).length;

  const recentSessions = focusSessions.filter(session => new Date(session.date) >= sevenDaysAgo);
  const dailyFocusTimes = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = toYYYYMMDD(date);
    return recentSessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.durationMs, 0);
  });

  const avgFocusTime = dailyFocusTimes.reduce((sum, time) => sum + time, 0) / dailyFocusTimes.length;
  const variance = dailyFocusTimes.reduce((sum, time) => sum + Math.pow(time - avgFocusTime, 2), 0) / dailyFocusTimes.length;
  const inconsistencyScore = avgFocusTime > 0 ? Math.sqrt(variance) / avgFocusTime : 0;

  const overdueWeight = Math.min(recentOverdue * 15, 40);
  const priorityWeight = Math.min(highPriorityIncomplete * 10, 30);
  const inconsistencyWeight = Math.min(inconsistencyScore * 100, 30);

  return Math.min(overdueWeight + priorityWeight + inconsistencyWeight, 100);
};

const calculateTaskComplexityScore = (task: Task): number => {
  let score = 1;
  
  if (task.priority === TaskPriority.HIGH) score *= 1.5;
  else if (task.priority === TaskPriority.LOW) score *= 0.8;
  
  if (task.estimatedHours && task.estimatedHours > 0) {
    score *= Math.min(task.estimatedHours / 2, 3);
  }
  
  if (task.dependencies && task.dependencies.length > 0) {
    score *= 1 + (task.dependencies.length * 0.2);
  }
  
  return Math.round(score * 10) / 10;
};

interface AnalyticsPageProps {
  appTasks: Task[];
  appProjects: ProjectType[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ appTasks, appProjects }) => {
  const darkModeContext = useContext<DarkModeContextType | undefined>(DarkModeContext);
  const isDarkMode = darkModeContext?.isDarkMode ?? false;
  const [allFocusSessions, setAllFocusSessions] = useState<FocusSession[]>([]);
  const [isLoadingFocusData, setIsLoadingFocusData] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [showTagDistributionAsChart, setShowTagDistributionAsChart] = useState(true);
  const [showProductivityTrendAsChart, setShowProductivityTrendAsChart] = useState(true);

  useEffect(() => {
    const fetchUserDataAndFocusSessions = async () => {
      setIsLoadingFocusData(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          try {
            const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
            const startDateStr = toYYYYMMDD(startDate);
            
            const sessions = await analyticsService.getFocusSessionsForUser(user.id, startDateStr);
            setAllFocusSessions(sessions || []);
          } catch (e) { 
            console.error("Error loading focus sessions for analytics:", e); 
            setAllFocusSessions([]);
          }
        } else {
          setAllFocusSessions([]);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setAllFocusSessions([]);
      } finally {
        setIsLoadingFocusData(false);
      }
    };
    fetchUserDataAndFocusSessions();
  }, [timeRange]);

  // Core metrics calculations
  const velocityMetrics = useMemo(() => calculateVelocityTrend(appTasks), [appTasks]);
  const burnoutRisk = useMemo(() => calculateBurnoutRisk(appTasks, allFocusSessions), [appTasks, allFocusSessions]);

  const coreMetrics = useMemo(() => {
    const completionRate = appTasks.length > 0 ? Math.round(appTasks.filter(t=>t.status === TaskStatus.COMPLETED).length / appTasks.length * 100) : 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueTasks = appTasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate <= today;
    });
    
    const onTimeDeliveryRate = dueTasks.length === 0 ? 100 : Math.round(
      (dueTasks.filter(task => {
          if (task.status !== TaskStatus.COMPLETED || !task.completedAt) return false;
          const completionDate = new Date(task.completedAt);
          const dueDateObj = new Date(task.dueDate + 'T23:59:59.999');
          return completionDate <= dueDateObj;
      }).length / dueTasks.length) * 100
    );

    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const relevantTasks = appTasks.filter(task => 
      new Date(task.createdAt) >= startDate || 
      (task.dueDate && new Date(task.dueDate) >= startDate)
    );

    let totalComplexityAchieved = 0;
    let totalComplexityPossible = 0;
    let timelinessBonusTotal = 0;

    relevantTasks.forEach(task => {
      const complexity = calculateTaskComplexityScore(task);
      totalComplexityPossible += complexity;

      if (task.status === TaskStatus.COMPLETED) {
        totalComplexityAchieved += complexity;

        if (task.completedAt && task.dueDate) {
          const completedDate = new Date(task.completedAt);
          const dueDate = new Date(task.dueDate);
          const timeDiff = dueDate.getTime() - completedDate.getTime();
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          if (daysDiff > 1) timelinessBonusTotal += complexity * 0.2;
          else if (daysDiff < 0) timelinessBonusTotal -= complexity * 0.3;
        }
      }
    });

    const productivityScore = totalComplexityPossible === 0 ? 100 : Math.round(
      Math.max(0, Math.min(100, 
        ((totalComplexityAchieved / totalComplexityPossible) * 100) + 
        ((timelinessBonusTotal / totalComplexityPossible) * 100)
      ))
    );

    const focusTimeDisplay = (() => {
      if (isLoadingFocusData) return "Loading...";
      if (allFocusSessions.length === 0) return "0h";
      
      const totalMs = allFocusSessions.reduce((sum, s) => sum + s.durationMs, 0);
      const activeDays = new Set(allFocusSessions.map(s => s.date)).size;

      if (activeDays === 0) return "0h";
      
      const averageDailyMsOnActiveDays = totalMs / activeDays;
      const hours = (averageDailyMsOnActiveDays / (1000 * 60 * 60)).toFixed(1);
      return `${hours}h avg/day`;
    })();

    return { completionRate, onTimeDeliveryRate, productivityScore, focusTimeDisplay };
  }, [appTasks, allFocusSessions, isLoadingFocusData, timeRange]);

  // Chart data
  const productivityTrendData = useMemo(() => {
    const daysToShow = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const today = new Date();
    const trendData = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - i);
      const dayKey = toYYYYMMDD(currentDate);

      const tasksCompleted = appTasks.filter(
        task => task.status === TaskStatus.COMPLETED && task.completedAt?.startsWith(dayKey)
      );

      const focusTimeMs = allFocusSessions
        .filter(s => s.date === dayKey)
        .reduce((sum, s) => sum + s.durationMs, 0);

      const focusHours = focusTimeMs / (1000 * 60 * 60);
      const complexityCompleted = tasksCompleted.reduce((sum, task) => sum + calculateTaskComplexityScore(task), 0);

      trendData.push({
        date: dayKey,
        day: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tasksCompleted: tasksCompleted.length,
        focusHours: parseFloat(focusHours.toFixed(1)),
        complexityScore: parseFloat(complexityCompleted.toFixed(1)),
        efficiency: tasksCompleted.length > 0 ? parseFloat((complexityCompleted / tasksCompleted.length).toFixed(1)) : 0
      });
    }

    return trendData;
  }, [appTasks, allFocusSessions, timeRange]);

  const tagDistributionData = useMemo(() => {
    if (!appTasks || appTasks.length === 0) return [];
    const tagCounts: Record<string, number> = {};
    appTasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            tagCounts[trimmedTag] = (tagCounts[trimmedTag] || 0) + 1;
          }
        });
      }
    });
    if (Object.keys(tagCounts).length === 0) return [];

    const PIE_CHART_COLORS = [
      '#10B981', // Emerald 500
      '#3B82F6', // Blue 500
      '#22C55E', // Green 500
      '#6366F1', // Indigo 500
      '#14B8A6', // Teal 500
      '#0EA5E9', // Sky 500
      '#84CC16', // Lime 500
      '#06B6D4', // Cyan 500
    ];

    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([name, value], index) => ({
        name,
        value,
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      }));
  }, [appTasks]);

  // Derived stats
  const weeklyTasksCompleted = useMemo(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return appTasks.filter(t => 
      t.status === TaskStatus.COMPLETED && 
      t.completedAt && 
      new Date(t.completedAt) >= oneWeekAgo
    ).length;
  }, [appTasks]);

  const averageFocusHours = useMemo(() => {
    if (isLoadingFocusData || allFocusSessions.length === 0) return 0;
    const totalMs = allFocusSessions.reduce((sum, s) => sum + s.durationMs, 0);
    const activeDays = new Set(allFocusSessions.map(s => s.date)).size;
    if (activeDays === 0) return 0;
    return (totalMs / activeDays) / (1000 * 60 * 60);
  }, [allFocusSessions, isLoadingFocusData]);

  const complexityStats = useMemo(() => {
    const allComplexities = appTasks.map(calculateTaskComplexityScore);
    const completedComplexities = appTasks
      .filter(t => t.status === TaskStatus.COMPLETED)
      .map(calculateTaskComplexityScore);

    return {
      average: allComplexities.length > 0 ? (allComplexities.reduce((sum, c) => sum + c, 0) / allComplexities.length).toFixed(1) : '0.0',
      completed: completedComplexities.length > 0 ? (completedComplexities.reduce((sum, c) => sum + c, 0) / completedComplexities.length).toFixed(1) : '0.0',
      highest: allComplexities.length > 0 ? Math.max(...allComplexities).toFixed(1) : '0.0'
    };
  }, [appTasks]);

  // Top stat cards
  const topStatCards: StatCardData[] = useMemo(() => {
    const velocityTrendIcon = velocityMetrics.trend > 0 ? TrendingUpIcon : TrendingDownIcon;
    const velocityTrendClass = velocityMetrics.trend > 0 ? "text-green-500" : "text-red-500";
    
    return [
      { 
        title: "Task Completion Rate", 
        value: `${coreMetrics.completionRate}%`, 
        icon: CheckBadgeIcon, 
        change: `${velocityMetrics.current} this week`,
        trendIcon: velocityTrendIcon,
        iconBgColor: "bg-green-100 dark:bg-green-900/30",
        valueClassName: `${velocityTrendClass}`
      },
      { 
        title: "Average Focus Time", 
        value: coreMetrics.focusTimeDisplay, 
        icon: ClockFastForwardIcon, 
        change: `Last ${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} days`, 
        iconBgColor: "bg-blue-100 dark:bg-blue-900/30" 
      },
      { 
        title: "On-time Delivery", 
        value: `${coreMetrics.onTimeDeliveryRate}%`, 
        icon: BullseyeArrowIcon, 
        footerText: "Of all due tasks", 
        iconBgColor: "bg-purple-100 dark:bg-purple-900/30" 
      },
      { 
        title: "Productivity Score", 
        value: `${coreMetrics.productivityScore}%`, 
        icon: BrainCircuitIcon, 
        change: "Enhanced Algorithm", 
        iconBgColor: `${burnoutRisk > 70 ? 'bg-red-100 dark:bg-red-900/30' : burnoutRisk > 40 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}` 
      },
    ];
  }, [coreMetrics, velocityMetrics, burnoutRisk, timeRange]);

  // Theme styles
  const getThemeAwareTooltipStyle = () => ({
    backgroundColor: isDarkMode ? '#0A0A0A' : '#FFFFFF', 
    border: `1px solid ${isDarkMode ? '#262626' : '#E5E7EB'}`, 
    color: isDarkMode ? '#FFFFFF' : '#1F2937', 
    borderRadius: '0.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  });

  const getThemeAwareLabelStyle = () => ({
    color: isDarkMode ? '#FFFFFF' : '#1F2937',
    fontSize: '12px',
  });

  // UI Components
  const renderChartToggle = (isChart: boolean, toggleFn: () => void) => (
    <Button
        variant="ghost"
        size="sm"
        onClick={toggleFn}
        className="p-1.5 text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-surface-dark"
        aria-label={`Switch to ${isChart ? 'table' : 'chart'} view`}
    >
        {isChart ? <TableCellsIcon className="w-5 h-5" /> : <ChartBarIcon className="w-5 h-5" />}
    </Button>
  );

  const ProductivityTrendTable: React.FC<{data: typeof productivityTrendData}> = ({data}) => (
    <div className="overflow-x-auto max-h-[300px]">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
          <tr>
            <th scope="col" className="px-3 py-2">Date</th>
            <th scope="col" className="px-3 py-2 text-right">Completed</th>
            <th scope="col" className="px-3 py-2 text-right">Focus (h)</th>
            <th scope="col" className="px-3 py-2 text-right">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(-10).map(item => (
            <tr key={item.date} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white">{item.day}</td>
              <td className="px-3 py-2 text-right">{item.tasksCompleted}</td>
              <td className="px-3 py-2 text-right">{item.focusHours}</td>
              <td className="px-3 py-2 text-right">{item.efficiency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const TagDistributionTable: React.FC<{data: {name: string; value: number; fill: string}[]}> = ({data}) => (
    <div className="overflow-x-auto max-h-[280px]"> 
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-4 py-2">Tag</th>
            <th scope="col" className="px-4 py-2 text-right">Count</th>
            <th scope="col" className="px-4 py-2 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => {
            const totalTasks = data.reduce((sum, d) => sum + d.value, 0);
            const percentage = totalTasks > 0 ? ((item.value / totalTasks) * 100).toFixed(1) : '0.0';
            return (
              <tr key={item.name} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{backgroundColor: item.fill}}></span>
                  {item.name}
                </td>
                <td className="px-4 py-2 text-right">{item.value}</td>
                <td className="px-4 py-2 text-right">{percentage}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const generateInsights = () => {
    const insights = [];

    if (burnoutRisk > 70) {
      insights.push({
        type: 'danger',
        title: 'High stress detected',
        message: 'Consider reducing workload or taking breaks',
        color: 'red'
      });
    }

    if (velocityMetrics.trend > 20) {
      insights.push({
        type: 'success',
        title: 'Great momentum!',
        message: `+${velocityMetrics.trend.toFixed(0)}% vs last week`,
        color: 'green'
      });
    }

    if (coreMetrics.onTimeDeliveryRate < 80 && appTasks.filter(t => t.dueDate).length > 0) {
      insights.push({
        type: 'warning',
        title: 'Improve time management',
        message: 'Focus on deadline planning',
        color: 'yellow'
      });
    }

    if (coreMetrics.productivityScore > 85) {
      insights.push({
        type: 'success',
        title: 'Excellent performance!',
        message: 'Keep up the great work',
        color: 'blue'
      });
    }

    if (velocityMetrics.trend < -20) {
      insights.push({
        type: 'warning',
        title: 'Velocity declining',
        message: 'Review task prioritization',
        color: 'orange'
      });
    }

    if (burnoutRisk <= 30 && coreMetrics.productivityScore > 70 && velocityMetrics.trend > 0) {
      insights.push({
        type: 'success',
        title: 'Optimal performance',
        message: 'Sustainable productivity level',
        color: 'emerald'
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Keep going!',
        message: 'Complete more tasks to unlock insights',
        color: 'gray'
      });
    }

    return insights;
  };

  return (
    <div className="min-h-screen bg-background dark:bg-black">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 border-b border-border dark:border-border-dark">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text dark:text-text-dark mb-2">Analytics & Insights</h1>
              <p className="text-muted dark:text-muted-dark">Track your productivity and performance metrics</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={timeRange === '7d' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                7 Days
              </Button>
              <Button
                variant={timeRange === '30d' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                30 Days
              </Button>
              <Button
                variant={timeRange === '90d' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('90d')}
              >
                90 Days
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-8">
        {/* Alert Section */}
        {burnoutRisk > 60 && (
          <Card className="p-4 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  High Burnout Risk Detected ({Math.round(burnoutRisk)}%)
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Consider reducing workload or taking breaks. Focus on completing high-priority tasks first.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Key Metrics Section */}
        <section>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-4">Key Performance Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {topStatCards.map((stat, index) => (
              <StatCard key={index} {...stat} className="glow-primary" valueClassName="text-primary dark:text-indigo-300" />
            ))}
          </div>
        </section>

        {/* Productivity Analysis Section */}
        <section>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-4">Productivity Analysis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark">Productivity Trend</h3>
                {renderChartToggle(showProductivityTrendAsChart, () => setShowProductivityTrendAsChart(p => !p))}
              </div>
              {showProductivityTrendAsChart ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={productivityTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={isDarkMode ? 0.2 : 0.4} />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 11, fill: isDarkMode ? '#D1D5DB' : '#374151' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: isDarkMode ? '#D1D5DB' : '#374151' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: isDarkMode ? '#D1D5DB' : '#374151' }} />
                    <Tooltip 
                      contentStyle={getThemeAwareTooltipStyle()}
                      labelStyle={getThemeAwareLabelStyle()}
                      itemStyle={getThemeAwareLabelStyle()}
                    />
                    <Legend wrapperStyle={{fontSize: '12px'}} />
                    <Bar yAxisId="left" dataKey="tasksCompleted" name="Tasks Completed" fill={ANALYTICS_CHART_COLORS[0]} radius={[2, 2, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency" name="Efficiency Score" stroke={ANALYTICS_CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
                    <Area yAxisId="right" type="monotone" dataKey="focusHours" name="Focus Hours" fill={ANALYTICS_CHART_COLORS[1]} fillOpacity={0.3} stroke={ANALYTICS_CHART_COLORS[1]} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ProductivityTrendTable data={productivityTrendData} />
              )}
            </Card>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark">Task Tags</h3>
                {renderChartToggle(showTagDistributionAsChart, () => setShowTagDistributionAsChart(p => !p))}
              </div>
              {tagDistributionData.length > 0 ? (
                showTagDistributionAsChart ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={tagDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={85}
                        dataKey="value"
                        nameKey="name"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 1.25; 
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const fill = getThemeAwareLabelStyle().color;
                          return (
                            <text x={x} y={y} fill={fill} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="11px" fontWeight="500">
                              {`${name} (${(percent * 100).toFixed(0)}%)`}
                            </text>
                          );
                        }}
                      >
                        {tagDistributionData.map((entry, index) => (
                          <Cell key={`cell-tag-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={getThemeAwareTooltipStyle()}
                        labelStyle={getThemeAwareLabelStyle()}
                        itemStyle={getThemeAwareLabelStyle()}
                      />
                      <Legend wrapperStyle={{fontSize: '12px', color: isDarkMode ? '#D1D5DB' : '#374151', paddingTop: '10px'}}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <TagDistributionTable data={tagDistributionData} />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted dark:text-muted-dark">
                  <TagIcon className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">No tag data available</p>
                  <p className="text-xs">Add tags to your tasks to see distribution</p>
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* Task & Project Overview */}
        <section>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-4">Task & Project Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-3">Priority Distribution</h3>
              <div className="space-y-3">
                {Object.values(TaskPriority).map(priority => {
                  const count = appTasks.filter(t => t.priority === priority).length;
                  const percentage = appTasks.length > 0 ? (count / appTasks.length) * 100 : 0;
                  const color = priority === TaskPriority.HIGH ? 'bg-red-500' : 
                               priority === TaskPriority.MEDIUM ? 'bg-yellow-500' : 'bg-green-500';
                  return (
                    <div key={priority}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{priority.toLowerCase()} Priority</span>
                        <span className="font-semibold">{count} tasks</span>
                      </div>
                      <ProgressBar progress={percentage} color={color} />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-3">Goals Progress</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Weekly Tasks</span>
                    <span className="font-semibold text-text dark:text-text-dark">
                      {weeklyTasksCompleted}/50 tasks
                    </span>
                  </div>
                  <ProgressBar 
                    progress={(weeklyTasksCompleted / 50) * 100} 
                    color="bg-primary" 
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Daily Focus</span>
                    <span className="font-semibold text-text dark:text-text-dark">
                      {averageFocusHours.toFixed(1)}h/8h
                    </span>
                  </div>
                  <ProgressBar 
                    progress={(averageFocusHours / 8) * 100} 
                    color="bg-secondary" 
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Projects</span>
                    <span className="font-semibold text-text dark:text-text-dark">
                      {appProjects.filter(p => p.progress === 100).length}/{appProjects.length} completed
                    </span>
                  </div>
                  <ProgressBar 
                    progress={appProjects.length > 0 ? (appProjects.filter(p => p.progress === 100).length / appProjects.length) * 100 : 0} 
                    color="bg-amber-500" 
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-3">Task Complexity</h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary dark:text-indigo-300">
                    {complexityStats.average}
                  </div>
                  <p className="text-sm text-muted dark:text-muted-dark">Average Complexity</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {complexityStats.completed}
                    </div>
                    <p className="text-xs text-muted dark:text-muted-dark">Completed</p>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600">
                      {complexityStats.highest}
                    </div>
                    <p className="text-xs text-muted dark:text-muted-dark">Highest</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Insights & Recommendations */}
        <section>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-4">Smart Insights & Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generateInsights().map((insight, index) => (
              <Card key={index} className={`p-4 border-l-4 border-${insight.color}-500 bg-${insight.color}-50 dark:bg-${insight.color}-900/20`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {insight.type === 'danger' && (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {insight.type === 'success' && (
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {insight.type === 'warning' && (
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    {insight.type === 'info' && (
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium text-${insight.color}-800 dark:text-${insight.color}-200`}>
                      {insight.title}
                    </p>
                    <p className={`text-xs text-${insight.color}-600 dark:text-${insight.color}-300 mt-1`}>
                      {insight.message}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Additional Statistics */}
        <section>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-4">Additional Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-primary dark:text-indigo-300">
                {appTasks.length}
              </div>
              <p className="text-sm text-muted dark:text-muted-dark">Total Tasks</p>
              <p className="text-xs text-muted dark:text-muted-dark mt-1">
                {appTasks.filter(t => t.status === TaskStatus.COMPLETED).length} completed
              </p>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-secondary dark:text-secondary-dark">
                {appProjects.length}
              </div>
              <p className="text-sm text-muted dark:text-muted-dark">Active Projects</p>
              <p className="text-xs text-muted dark:text-muted-dark mt-1">
                {Math.round(appProjects.reduce((sum, p) => sum + p.progress, 0) / (appProjects.length || 1))}% avg progress
              </p>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {appTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.COMPLETED).length}
              </div>
              <p className="text-sm text-muted dark:text-muted-dark">Overdue Tasks</p>
              <p className="text-xs text-muted dark:text-muted-dark mt-1">
                Needs attention
              </p>
            </Card>

            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(burnoutRisk)}%
              </div>
              <p className="text-sm text-muted dark:text-muted-dark">Burnout Risk</p>
              <p className="text-xs text-muted dark:text-muted-dark mt-1">
                {burnoutRisk < 30 ? 'Low risk' : burnoutRisk < 70 ? 'Moderate' : 'High risk'}
              </p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};