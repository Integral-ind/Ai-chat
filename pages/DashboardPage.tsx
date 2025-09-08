import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { Card, Checkbox, Button, StatCard, ProgressBar } from '../components';
import { Task, TaskStatus, Project as ProjectType, AIInsight, User as FrontendUser, StatCardData, FocusSession, TeamType, TaskPriority, NoteCategory, CalendarEvent } from '../types';
import {
    CheckBadgeIcon, ClockIcon, SparklesIcon, BoltIcon, TargetIcon,
    PlusIcon, DocumentPlusIcon, UploadCloudIcon,
    TrendingUpIcon, TrendingDownIcon, ChartPieIcon, CalendarDaysIcon
} from '../constants';
import { taskService } from '../taskService';
import { noteService } from '../noteService';
import { analyticsService } from '../analyticsService';
import { calendarService } from '../calendarService';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FocusModeContext } from '../App';

type EnergyInput = {
  taskCompletionRate: number;
  avgFocusTime: number;
  interruptions: number;
  delayRatio: number;
};

type EnergyOutput = {
  energyScore: number;
  energyLevel: 'High' | 'Moderate' | 'Low';
};

// Helper function to get local date string (not UTC)
const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function calculateEnergyLevel(input: EnergyInput): EnergyOutput {
  const { taskCompletionRate, avgFocusTime, interruptions, delayRatio } = input;

  const TCR_norm = Math.min(taskCompletionRate, 1);
  const AFT_norm = Math.min(avgFocusTime / 120, 1);
  const INT_norm = 1 - Math.min(interruptions / 20, 1);
  const DLT_norm = 1 - Math.min(delayRatio, 1);

  const energyScore = 0.30 * TCR_norm + 0.30 * AFT_norm + 0.20 * INT_norm + 0.20 * DLT_norm;

  let energyLevel: EnergyOutput['energyLevel'];
  if (energyScore > 0.8) energyLevel = 'High';
  else if (energyScore > 0.5) energyLevel = 'Moderate';
  else energyLevel = 'Low';

  return { energyScore: parseFloat(energyScore.toFixed(2)), energyLevel };
}

// Analytics helper functions from analytics page
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
    const dateStr = getLocalDateString(date);
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

const TodayFocusTaskItem: React.FC<{ task: Task, onToggleComplete: (taskId: string, currentStatus: TaskStatus) => void }> = ({ task, onToggleComplete }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-border-dark/50 last:border-b-0">
        <div className="flex items-center">
            <Checkbox
                checked={task.status === TaskStatus.COMPLETED}
                onChange={() => onToggleComplete(task.id, task.status)}
            />
            <div className="ml-4">
                <p className={`text-sm font-medium text-text dark:text-text-dark ${task.status === TaskStatus.COMPLETED ? 'line-through text-muted dark:text-muted-dark' : ''}`}>{task.title}</p>
                {task.project && <p className="text-xs text-muted dark:text-muted-dark">{task.project}</p>}
            </div>
        </div>
        <div className="flex items-center text-xs text-muted dark:text-muted-dark">
            <CheckBadgeIcon className="w-4 h-4 mr-1" />
            Task
        </div>
    </div>
);

const TodayFocusEventItem: React.FC<{ event: CalendarEvent }> = ({ event }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-border-dark/50 last:border-b-0">
        <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full bg-${event.color} flex-shrink-0`}></div>
            <div className="ml-4">
                <p className="text-sm font-medium text-text dark:text-text-dark">{event.title}</p>
                <p className="text-xs text-muted dark:text-muted-dark">
                    {event.startTime && event.endTime 
                        ? `${event.startTime} - ${event.endTime}`
                        : event.startTime 
                            ? `At ${event.startTime}`
                            : 'All day'
                    }
                </p>
            </div>
        </div>
        <div className="flex items-center text-xs text-muted dark:text-muted-dark">
            <CalendarDaysIcon className="w-4 h-4 mr-1" />
            Event
        </div>
    </div>
);

const ProjectProgressItem: React.FC<ProjectType> = ({ name, progress, completedTasks, totalTasks }) => (
    <div className="mb-4 last:mb-0">
        <div className="flex justify-between items-center mb-1.5">
            <p className="text-sm font-medium text-text dark:text-text-dark">{name}</p>
            <p className="text-sm font-semibold text-text dark:text-text-dark">{progress}%</p>
        </div>
        <ProgressBar progress={progress} />
        <p className="text-xs text-muted dark:text-muted-dark mt-1.5"><span className="font-semibold text-text/90 dark:text-text-dark/90">{completedTasks}/{totalTasks}</span> tasks completed</p>
    </div>
);

const QuickActionItem: React.FC<{ 
    label: string; 
    icon: React.ReactNode; 
    onClick?: () => void;
    disabled?: boolean;
}> = ({ label, icon, onClick, disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center p-4 space-y-2 bg-gray-50 dark:bg-surface-dark rounded-xl transition-colors duration-150 ${
            disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/80 cursor-pointer'
        }`}
    >
        <div className={`p-2 bg-gray-200 dark:bg-gray-700 rounded-full ${
            disabled ? 'text-gray-400' : 'text-primary dark:text-indigo-400'
        }`}>
            {icon}
        </div>
        <p className={`text-xs font-medium ${
            disabled ? 'text-gray-400' : 'text-text dark:text-text-dark'
        }`}>
            {label}
        </p>
    </button>
);

export const DashboardPage: React.FC<{
    appTasks: Task[];
    setAppTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    appProjects: ProjectType[];
    appTeams: TeamType[];
    currentUser: FrontendUser | null;
}> = ({ appTasks, setAppTasks, appProjects, appTeams, currentUser }) => {
    const navigate = useNavigate();
    const [time, setTime] = useState(new Date());
    const [allFocusSessions, setAllFocusSessions] = useState<FocusSession[]>([]);
    const [todaysEvents, setTodaysEvents] = useState<CalendarEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [isProcessingNote, setIsProcessingNote] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const focusModeContext = useContext(FocusModeContext);
    if (!focusModeContext) {
      throw new Error("DashboardPage must be used within a FocusModeProvider");
    }
    const { isFocusModeActive, timeRemaining, startFocusSession, stopFocusSession, totalFocusTimeTodayMs } = focusModeContext;
    
    // Fetch focus sessions for insights
    useEffect(() => {
        const fetchFocusSessions = async () => {
            try {
                if (currentUser?.id) {
                    const sessions = await analyticsService.getFocusSessionsForUser(currentUser.id);
                    setAllFocusSessions(sessions || []);
                }
            } catch (error) {
                console.error("Error fetching focus sessions:", error);
                setAllFocusSessions([]);
            }
        };
        fetchFocusSessions();
    }, [currentUser?.id]);

    // Fetch today's calendar events
    const fetchTodaysEvents = useCallback(async () => {
        if (!currentUser) {
            setTodaysEvents([]);
            setIsLoadingEvents(false);
            return;
        }
        
        setIsLoadingEvents(true);
        try {
            const today = getLocalDateString();
            const events = await calendarService.getEventsForDateRange(today, today);
            setTodaysEvents(events);
        } catch (error) {
            console.error("Error fetching today's events:", error);
            setTodaysEvents([]);
        } finally {
            setIsLoadingEvents(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchTodaysEvents();
    }, [fetchTodaysEvents]);

    // Clock and Date
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const formattedDate = time.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour >= 5 && hour < 12) return "Good morning";
        if (hour >= 12 && hour < 17) return "Good afternoon";
        if (hour >= 17 && hour < 22) return "Good evening";
        return "Good night";
    };
    
    const greeting = getGreeting();
    const isGoodNight = greeting === "Good night";
    const userName = currentUser?.name?.split(' ')[0] || "there";
    const pendingTasksCount = appTasks.filter(t => t.status !== TaskStatus.COMPLETED).length;

    // Analytics calculations for insights
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

        return { completionRate, onTimeDeliveryRate };
    }, [appTasks]);

    // Generate insights from analytics
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

        if (productivityScore > 85) {
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

        if (burnoutRisk <= 30 && productivityScore > 70 && velocityMetrics.trend > 0) {
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

        return insights.slice(0, 3); // Limit to 3 insights for dashboard
    };

    // Calculations
    const productivityScore = useMemo(() => {
        const PRIORITY_POINTS = { [TaskPriority.HIGH]: 10, [TaskPriority.MEDIUM]: 5, [TaskPriority.LOW]: 2 };
        const getBaseTaskValue = (task: Task): number => {
            const priorityPoints = PRIORITY_POINTS[task.priority || TaskPriority.MEDIUM];
            const effortMultiplier = 1 + ((task.estimatedHours || 1) / 4);
            return priorityPoints * effortMultiplier;
        };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const now = new Date();
        const relevantTasks = appTasks.filter(task => new Date(task.dueDate) >= thirtyDaysAgo);

        let yourAchievedScore = 0, potentialScore = 0, penalty = 0;

        relevantTasks.forEach(task => {
            const btv = getBaseTaskValue(task);
            const dueDate = new Date(task.dueDate);
            potentialScore += btv * 1.2;

            if (task.status === TaskStatus.COMPLETED && task.completedAt) {
                const completedAt = new Date(task.completedAt);
                const hoursDifference = (dueDate.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
                let timelinessModifier = 1.0;
                if (hoursDifference > 24) timelinessModifier = 1.2;
                else if (hoursDifference < 0) timelinessModifier = 0.6;
                yourAchievedScore += btv * timelinessModifier;
            } else if (task.status !== TaskStatus.COMPLETED && dueDate < now) {
                penalty += btv * 0.25;
            }
        });

        if (potentialScore === 0) return 100;
        const rawScore = ((yourAchievedScore - penalty) / potentialScore) * 100;
        return Math.max(0, Math.min(100, Math.round(rawScore)));
    }, [appTasks]);
    
    const tasksCompletedToday = useMemo(() => {
        const todayStr = getLocalDateString();
        return appTasks.filter(t => t.completedAt?.startsWith(todayStr)).length;
    }, [appTasks]);

    const energyLevelData = useMemo(() => {
        const todayStr = getLocalDateString();
        const tasksDueToday = appTasks.filter(task => task.dueDate === todayStr);
        const tasksCompletedThatWereDueToday = tasksDueToday.filter(t => t.status === TaskStatus.COMPLETED).length;
        const taskCompletionRate = tasksDueToday.length > 0 ? tasksCompletedThatWereDueToday / tasksDueToday.length : 1;
        const avgFocusTime = totalFocusTimeTodayMs / (1000 * 60);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCompletedTasks = appTasks.filter(t => 
            t.status === TaskStatus.COMPLETED && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo
        );
        const delayedTasks = recentCompletedTasks.filter(t => 
            t.completedAt && t.dueDate && new Date(t.completedAt) > new Date(t.dueDate + 'T23:59:59.999')
        ).length;
        const delayRatio = recentCompletedTasks.length > 0 ? delayedTasks / recentCompletedTasks.length : 0;
        
        return calculateEnergyLevel({ taskCompletionRate, avgFocusTime, interruptions: 5, delayRatio });
    }, [appTasks, totalFocusTimeTodayMs]);

    const energyLevelStyles = useMemo(() => {
        const styles = {
            'High': { iconBgColor: "bg-amber-100 dark:bg-amber-900/30", valueClassName: "text-amber-500 dark:text-amber-400" },
            'Moderate': { iconBgColor: "bg-orange-100 dark:bg-orange-900/30", valueClassName: "text-orange-500 dark:text-orange-400" },
            'Low': { iconBgColor: "bg-pink-100 dark:bg-pink-900/30", valueClassName: "text-pink-500 dark:text-pink-400" }
        };
        return styles[energyLevelData.energyLevel] || { iconBgColor: "bg-gray-100 dark:bg-gray-800/30", valueClassName: "text-gray-600 dark:text-gray-400" };
    }, [energyLevelData.energyLevel]);

    const formatFocusTime = (ms: number) => {
        const totalMinutes = Math.floor(ms / (1000 * 60));
        if (totalMinutes < 1) return "0m";
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    };

    const statCards: StatCardData[] = [
        { 
            title: "Tasks Completed Today", 
            value: tasksCompletedToday, 
            icon: CheckBadgeIcon, 
            footerText: "Total for today",
            iconBgColor: "bg-green-100 dark:bg-green-800/30", 
            valueClassName: "text-green-600 dark:text-green-400" 
        },
        { 
            title: "Focus Time", 
            value: formatFocusTime(totalFocusTimeTodayMs), 
            icon: ClockIcon, 
            footerText: "Total for today", 
            iconBgColor: "bg-blue-100 dark:bg-blue-800/30", 
            valueClassName: "text-blue-600 dark:text-blue-400" 
        },
        { 
            title: "Productivity Score", 
            value: `${productivityScore}%`, 
            icon: ChartPieIcon, 
            footerText: "Overall performance", 
            iconBgColor: "bg-purple-100 dark:bg-purple-800/30", 
            valueClassName: "text-purple-600 dark:text-purple-400" 
        },
        { 
            title: "Energy Level", 
            value: energyLevelData.energyLevel, 
            icon: BoltIcon, 
            footerText: `Score: ${Math.round(energyLevelData.energyScore * 100)}`, 
            iconBgColor: energyLevelStyles.iconBgColor, 
            valueClassName: energyLevelStyles.valueClassName 
        },
    ];

    const todaysFocusTasks = useMemo(() => {
        const todayStr = getLocalDateString();
        return appTasks
            .filter(task => task.dueDate === todayStr && task.status !== TaskStatus.COMPLETED)
            .slice(0, 3); // Limit to 3 to make room for events
    }, [appTasks]);

    // Sort today's events by start time
    const sortedTodaysEvents = useMemo(() => {
        return todaysEvents
            .sort((a, b) => {
                // Events with start time first, then all-day events
                if (a.startTime && !b.startTime) return -1;
                if (!a.startTime && b.startTime) return 1;
                if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
                return 0;
            })
            .slice(0, 2); // Limit to 2 events to keep the section compact
    }, [todaysEvents]);

    const projectsForDashboard = useMemo(() => appProjects.filter(p => p.progress < 100).slice(0, 4), [appProjects]);

    const handleToggleTaskComplete = useCallback(async (taskId: string, currentStatus: TaskStatus) => {
        const newStatus = currentStatus === TaskStatus.COMPLETED ? TaskStatus.IN_PROGRESS : TaskStatus.COMPLETED;
        try {
            const updatedTask = await taskService.updateTask(taskId, { status: newStatus });
            setAppTasks(prevTasks => prevTasks.map(t => t.id === taskId ? updatedTask : t));
        } catch (error) {
            console.error("Error updating task status:", error);
        }
    }, [setAppTasks]);

    // Function to create a new general note directly
    const handleNewNoteDirect = async () => {
        if (!currentUser) {
            alert("Please log in to create notes.");
            return;
        }

        setIsProcessingNote(true);
        try {
            const newNote = await noteService.createNote({
                title: "New Note",
                content: "<p><br></p>",
                category: NoteCategory.GENERAL,
                userId: currentUser.id,
            });
            
            // Navigate to notes page with the new note data and editor mode
            navigate('/app/notes', { 
                state: { 
                    openEditor: true, 
                    newNote: newNote  // Pass the complete note object
                } 
            });
        } catch (error: any) {
            alert(`Failed to create note: ${error.message}`);
        } finally {
            setIsProcessingNote(false);
        }
    };

    // Function to trigger file upload directly
    const handleNewFileDirect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // Function to handle file selection
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            // Navigate to resources page with the file ready for upload
            navigate('/app/resources', { 
                state: { 
                    triggerDirectUpload: true,
                    selectedFile: file
                } 
            });
        }
    };

    const insights = generateInsights();

    // Check if we have any focus items to show
    const hasFocusItems = todaysFocusTasks.length > 0 || sortedTodaysEvents.length > 0;

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-background dark:bg-background-dark">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-[2.125rem] font-display font-normal text-text dark:text-text-dark">{greeting}, {userName}! {isGoodNight ? '😴' : '✏️'}</h1>
                    <p className="text-muted dark:text-muted-dark mt-1">Ready to make {isGoodNight ? 'tomorrow' : 'today'} productive? You have {pendingTasksCount} tasks pending.</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-3xl font-semibold text-text dark:text-text-dark">{formattedTime}</p>
                    <p className="text-sm text-muted dark:text-muted-dark">{formattedDate}</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map(stat => <StatCard key={stat.title} {...stat} />)}
            </div>

            {/* AI Insights */}
            <Card className="p-6">
                <div className="flex items-center mb-4">
                    <SparklesIcon className="w-6 h-6 text-primary dark:text-indigo-300 mr-2" />
                    <h3 className="text-lg font-semibold text-text dark:text-text-dark">AI Insights & Recommendations</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {insights.map((insight, index) => (
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
            </Card>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6">
                    <h3 className="text-lg font-semibold mb-3 text-text dark:text-text-dark">Today's Focus</h3>
                    {hasFocusItems ? (
                        <div className="space-y-0">
                            {/* Show today's tasks */}
                            {todaysFocusTasks.map(task => (
                                <TodayFocusTaskItem key={task.id} task={task} onToggleComplete={handleToggleTaskComplete} />
                            ))}
                            
                            {/* Show today's events */}
                            {isLoadingEvents && (
                                <div className="py-3 border-b border-gray-100 dark:border-border-dark/50 last:border-b-0">
                                    <p className="text-sm text-muted dark:text-muted-dark">Loading today's events...</p>
                                </div>
                            )}
                            
                            {!isLoadingEvents && sortedTodaysEvents.map(event => (
                                <TodayFocusEventItem key={event.id} event={event} />
                            ))}
                            
                            {/* Show "View all" links if there are more items */}
                            {(todaysFocusTasks.length >= 3 || sortedTodaysEvents.length >= 2) && (
                                <div className="pt-3 flex justify-between text-xs">
                                    {todaysFocusTasks.length >= 3 && (
                                        <button 
                                            onClick={() => navigate('/app/tasks')}
                                            className="text-primary hover:text-primary-dark dark:text-indigo-400 dark:hover:text-indigo-300"
                                        >
                                            View all tasks →
                                        </button>
                                    )}
                                    {sortedTodaysEvents.length >= 2 && (
                                        <button 
                                            onClick={() => navigate('/app/calendar')}
                                            className="text-primary hover:text-primary-dark dark:text-indigo-400 dark:hover:text-indigo-300"
                                        >
                                            View calendar →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted dark:text-muted-dark text-center py-8">
                            {isLoadingEvents 
                                ? "Loading today's schedule..." 
                                : "No tasks or events for today. Enjoy your day or add new items!"
                            }
                        </p>
                    )}
                </Card>

                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4 text-text dark:text-text-dark">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <QuickActionItem 
                                label="New Task" 
                                icon={<PlusIcon className="w-5 h-5"/>} 
                                onClick={() => navigate('/app/tasks', { state: { openNewTaskModal: true } })} 
                            />
                            <QuickActionItem 
                                label="New Note" 
                                icon={<DocumentPlusIcon className="w-5 h-5"/>} 
                                onClick={handleNewNoteDirect}
                                disabled={isProcessingNote}
                            />
                            <QuickActionItem 
                                label="New File" 
                                icon={<UploadCloudIcon className="w-5 h-5"/>} 
                                onClick={handleNewFileDirect}
                            />
                            {isFocusModeActive ? (
                                <div className="flex flex-col items-center justify-center p-4 space-y-2 bg-primary/20 dark:bg-primary-dark/30 rounded-xl transition-colors duration-150 ring-2 ring-primary animate-pulse">
                                    <p className="text-2xl font-bold font-mono text-primary dark:text-primary-light">
                                        {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:{String(timeRemaining % 60).padStart(2, '0')}
                                    </p>
                                    <Button variant="dangerOutline" size="sm" onClick={stopFocusSession} className="!px-3 !py-1 text-xs">
                                        Stop Focus
                                    </Button>
                                </div>
                            ) : (
                                <QuickActionItem 
                                    label="Start Focus" 
                                    icon={<TargetIcon className="w-5 h-5"/>} 
                                    onClick={() => startFocusSession()} 
                                />
                            )}
                        </div>
                        
                        {/* Hidden file input for direct file upload */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,.zip,.rar,.tar,.gz" 
                        />
                    </Card>
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4 text-text dark:text-text-dark">Project Progress</h3>
                        {projectsForDashboard.length > 0 ? (
                            projectsForDashboard.map(proj => <ProjectProgressItem key={proj.id} {...proj} />)
                        ) : (
                            <p className="text-sm text-muted dark:text-muted-dark text-center py-4">No active projects.</p>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};