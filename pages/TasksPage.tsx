import React, { useState, useMemo, useEffect, useCallback, FormEvent, createContext } from 'react';
import { Card, Button, Modal, DropZone, useDragAndDrop, ProgressBar, TaskInfoModal } from '../components';
import { Task, TaskStatus, TaskPriority, Project as ProjectType, User as FrontendUser } from '../types';
import { PlusIcon, EyeIcon, XMarkIcon, ExclamationTriangleIcon, CheckIcon, CalendarIcon, UserIcon } from '../constants';
import { taskService } from '../taskService';
import { useLocation, useNavigate } from 'react-router-dom';

// Define the context
export const TaskDropContext = createContext<{
  performMobileDrop: (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus) => Promise<void>;
} | null>(null);

interface TaskFormDialogState {
  title: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  tags?: string;
  projectId?: string;
  assigneeIds?: string[];
}

interface TasksPageProps {
  appTasks: Task[];
  setAppTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  appProjects: ProjectType[];
  currentUser: FrontendUser | null;
}

type ViewType = 'board' | 'list' | 'timeline';

interface FilterState {
  priority: TaskPriority | 'all';
  tag: string;
  assignee: string;
  dueDate: 'all' | 'overdue' | 'today' | 'this_week' | 'next_week' | 'this_month' | 'next_month';
}

interface SortState {
  field: 'priority' | 'dueDate' | 'assignee' | 'createdAt' | 'status' | 'title';
  direction: 'asc' | 'desc';
}

export const TasksPage: React.FC<TasksPageProps> = ({ appTasks, setAppTasks, appProjects, currentUser }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // View states
  const [currentView, setCurrentView] = useState<ViewType>('board');
  const [timelineStartDate, setTimelineStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Start 1 week ago
    return date;
  });

  // Filter and sort states
  const [filters, setFilters] = useState<FilterState>({
    priority: 'all',
    tag: 'all',
    assignee: 'all',
    dueDate: 'all'
  });

  const [sorting, setSorting] = useState<SortState>({
    field: 'dueDate',
    direction: 'asc'
  });

  const [isTaskFormModalOpen, setIsTaskFormModalOpen] = useState(false);
  const [isTaskInfoModalOpen, setIsTaskInfoModalOpen] = useState(false);
  const [taskForInfoModal, setTaskForInfoModal] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [connections, setConnections] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'assignment'>('basic');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMultiAssignment, setIsMultiAssignment] = useState(false);
  
  const [newTaskForm, setNewTaskForm] = useState<TaskFormDialogState>({
    title: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TODO,
    description: '',
    tags: '',
    projectId: '',
    assigneeIds: [],
  });
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);

  const fetchTasksForPage = useCallback(async () => {
    if (!currentUser) return;
    setIsLoadingTasks(true);
    try {
      const tasks = await taskService.getAllTasks();
      setAppTasks(tasks);
    } catch (error) {
      console.error("Error fetching tasks for TasksPage:", error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [setAppTasks, currentUser]);

  useEffect(() => {
    if (currentUser) {
        const loadConnections = async () => {
            setIsLoadingConnections(true);
            try {
                const connectionsData = await taskService.getConnections();
                setConnections(connectionsData);
            } catch (error) {
                console.error('Error loading connections for TasksPage:', error);
            } finally {
                setIsLoadingConnections(false);
            }
        };
        loadConnections();
        fetchTasksForPage();

    } else {
        setConnections([]);
        setIsLoadingConnections(false);
        setIsLoadingTasks(false);
    }
  }, [currentUser, fetchTasksForPage]);

  const handleTaskDropUpdate = useCallback(
    async (taskId: string, newStatus: TaskStatus, oldStatus?: TaskStatus) => {
      try {
        const updatedTask = await taskService.updateTaskStatus(taskId, newStatus, oldStatus);
        setAppTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? updatedTask : t)));
      } catch (error) {
        console.error("Error updating task status on drop:", error);
        alert(`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`);
        fetchTasksForPage();
      }
    },
    [setAppTasks, fetchTasksForPage]
  );
  
  const { draggedTask, handleDragStart, handleDrop, handleDragEnd, isTaskUpdating } = useDragAndDrop(
    handleTaskDropUpdate,
    undefined,
    (error, taskId) => console.error(`Error updating task ${taskId} after drop:`, error)
  );

  const performMobileDrop = async (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus) => {
    await handleTaskDropUpdate(taskId, newStatus, oldStatus);
  };
  const taskDropContextValue = { performMobileDrop };

  const myActiveTasks = useMemo(() => {
    if (!currentUser) return [];
    return appTasks.filter(task =>
        (task.userId === currentUser.id && (!task.assignedTo || task.assignedTo === currentUser.id)) ||
        (task.assignedTo === currentUser.id && task.userId === currentUser.id)
    );
  }, [appTasks, currentUser]);

  const tasksReceived = useMemo(() => {
    if (!currentUser) return [];
    return appTasks.filter(task => task.assignedTo === currentUser.id && task.userId !== currentUser.id);
  }, [appTasks, currentUser]);

  const tasksAssignedByMe = useMemo(() => {
    if (!currentUser) return [];
    return appTasks.filter(task => task.assignedBy === currentUser.id && task.assignedTo !== currentUser.id);
  }, [appTasks, currentUser]);

  const memberLookup = useMemo(() => {
    const allMembers = new Map<string, string>();
    if (currentUser) {
        allMembers.set(currentUser.id, currentUser.full_name || 'You');
    }
    connections.forEach(conn => {
        if (!allMembers.has(conn.id)) {
            allMembers.set(conn.id, conn.name);
        }
    });
    appProjects.forEach(proj => {
        proj.members?.forEach(member => {
            if (!allMembers.has(member.id)) {
                allMembers.set(member.id, member.full_name);
            }
        });
    });
    return allMembers;
  }, [connections, appProjects, currentUser]);

  // All tasks for list and timeline views
  const allUserTasks = useMemo(() => {
    return [...myActiveTasks, ...tasksReceived, ...tasksAssignedByMe];
  }, [myActiveTasks, tasksReceived, tasksAssignedByMe]);

  // Get unique tags from all tasks
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    allUserTasks.forEach(task => {
      task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allUserTasks]);

  // Get unique assignees
  const availableAssignees = useMemo(() => {
    const assignees = new Set<string>();
    allUserTasks.forEach(task => {
      if (task.assignedTo) assignees.add(task.assignedTo);
      if (task.userId) assignees.add(task.userId);
    });
    return Array.from(assignees).map(id => ({
      id,
      name: memberLookup.get(id) || 'Unknown User'
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUserTasks, memberLookup]);

  // Filter and sort tasks
  const filteredAndSortedTasks = useMemo(() => {
    let tasks = [...allUserTasks];

    // Apply filters
    if (filters.priority !== 'all') {
      tasks = tasks.filter(task => task.priority === filters.priority);
    }

    if (filters.tag !== 'all') {
      tasks = tasks.filter(task => task.tags?.includes(filters.tag));
    }

    if (filters.assignee !== 'all') {
      tasks = tasks.filter(task => 
        task.assignedTo === filters.assignee || task.userId === filters.assignee
      );
    }

    if (filters.dueDate !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      tasks = tasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        const dueDateStr = task.dueDate;
        
        switch (filters.dueDate) {
          case 'overdue':
            return dueDateStr < todayStr;
          case 'today':
            return dueDateStr === todayStr;
          case 'this_week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return dueDate >= weekStart && dueDate <= weekEnd;
          case 'next_week':
            const nextWeekStart = new Date(today);
            nextWeekStart.setDate(today.getDate() - today.getDay() + 7);
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            return dueDate >= nextWeekStart && dueDate <= nextWeekEnd;
          case 'this_month':
            return dueDate.getMonth() === today.getMonth() && 
                   dueDate.getFullYear() === today.getFullYear();
          case 'next_month':
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            return dueDate.getMonth() === nextMonth.getMonth() && 
                   dueDate.getFullYear() === nextMonth.getFullYear();
          default:
            return true;
        }
      });
    }

    // Apply sorting
    tasks.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (sorting.field) {
        case 'priority':
          const priorityOrder = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
          valueA = priorityOrder[a.priority];
          valueB = priorityOrder[b.priority];
          break;
        case 'dueDate':
          valueA = new Date(a.dueDate);
          valueB = new Date(b.dueDate);
          break;
        case 'assignee':
          valueA = memberLookup.get(a.assignedTo || a.userId || '') || '';
          valueB = memberLookup.get(b.assignedTo || b.userId || '') || '';
          break;
        case 'createdAt':
          valueA = new Date(a.createdAt);
          valueB = new Date(b.createdAt);
          break;
        case 'status':
          const statusOrder = { 
            [TaskStatus.TODO]: 1, 
            [TaskStatus.IN_PROGRESS]: 2, 
            [TaskStatus.REVIEW]: 3, 
            [TaskStatus.COMPLETED]: 4 
          };
          valueA = statusOrder[a.status];
          valueB = statusOrder[b.status];
          break;
        case 'title':
          valueA = a.title.toLowerCase();
          valueB = b.title.toLowerCase();
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sorting.direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return sorting.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return tasks;
  }, [allUserTasks, filters, sorting, memberLookup]);

  // Organize filtered tasks by status for board view
  const tasksByStatus = useMemo(() => {
    const filtered = filteredAndSortedTasks.filter(task => 
      myActiveTasks.some(activeTask => activeTask.id === task.id)
    );
    return filtered.reduce((acc, task) => {
      (acc[task.status] = acc[task.status] || []).push(task);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [filteredAndSortedTasks, myActiveTasks]);

  // Timeline date utilities
  const getTimelineDays = (startDate: Date, numDays: number = 35) => {
    const days = [];
    for (let i = 0; i < numDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const navigateTimeline = (direction: 'prev' | 'next') => {
    setTimelineStartDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    setTimelineStartDate(today);
  };

  const completionRate = useMemo(() => {
    const relevantTasks = appTasks.filter(t => t.userId === currentUser?.id || t.assignedTo === currentUser?.id);
    return relevantTasks.length > 0
      ? Math.round((relevantTasks.filter(t => t.status === TaskStatus.COMPLETED).length / relevantTasks.length) * 100)
      : 0;
  }, [appTasks, currentUser]);

  // Handle filter and sort changes
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      priority: 'all',
      tag: 'all',
      assignee: 'all',
      dueDate: 'all'
    });
  };

  // Rest of the component methods remain the same...
  const handleOpenTaskInfoModal = (task: Task) => {
    setTaskForInfoModal(task);
    setIsTaskInfoModalOpen(true);
  };
  
  const handleEditFromInfoModal = (task: Task) => {
    setEditingTask(task);
    setIsMultiAssignment(false);
    
    let validAssigneeIds = task.assignedTo ? [task.assignedTo] : [currentUser?.id || ''];
    if (task.projectId) {
      const taskProject = appProjects.find(proj => proj.id === task.projectId);
      if (taskProject) {
        const isAssigneeInProject = taskProject.members?.some(member => member.id === task.assignedTo);
        if (!isAssigneeInProject && task.assignedTo !== currentUser?.id) {
          validAssigneeIds = [currentUser?.id || ''];
        }
      }
    }
    
    setNewTaskForm({
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority || TaskPriority.MEDIUM,
      status: task.status,
      description: task.description || '',
      tags: task.tags ? task.tags.join(', ') : '',
      projectId: task.projectId || '',
      assigneeIds: validAssigneeIds,
    });
    setIsTaskInfoModalOpen(false);
    setIsTaskFormModalOpen(true);
    setActiveTab('basic');
    setErrorMessage(null);
  };

  const handleOpenNewTaskModal = useCallback((initialStatus?: TaskStatus, isAssignment: boolean = false) => {
    setEditingTask(null);
    setIsMultiAssignment(isAssignment);
    setNewTaskForm({
        title: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: TaskPriority.MEDIUM,
        status: initialStatus || TaskStatus.TODO,
        description: '',
        tags: '',
        projectId: '',
        assigneeIds: isAssignment ? [] : [currentUser?.id || ''],
    });
    setActiveTab('basic');
    setErrorMessage(null);
    setIsTaskFormModalOpen(true);
  }, [currentUser]);

  const handleCreateTaskInColumn = (status: TaskStatus) => {
    handleOpenNewTaskModal(status, false);
  };

  const handleCreateAssignedTask = () => {
    handleOpenNewTaskModal(TaskStatus.TODO, true);
    setActiveTab('assignment');
  };

  useEffect(() => {
    if (location.state?.openNewTaskModal) {
      handleOpenNewTaskModal();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, handleOpenNewTaskModal, navigate]);

  const handleSaveTask = async () => {
    setIsSavingTask(true);
    setErrorMessage(null);
    
    if (!currentUser) {
      setErrorMessage("Error: Current user not identified. Please re-login.");
      setIsSavingTask(false);
      return;
    }

    if (newTaskForm.projectId && newTaskForm.assigneeIds && newTaskForm.assigneeIds.length > 0) {
      const selectedProject = appProjects.find(proj => proj.id === newTaskForm.projectId);
      if (selectedProject) {
        const invalidAssignees = newTaskForm.assigneeIds.filter(assigneeId => {
          const isValidAssignee = selectedProject.members?.some(member => member.id === assigneeId);
          return !isValidAssignee && assigneeId !== currentUser.id;
        });
        
        if (invalidAssignees.length > 0) {
          setErrorMessage("Some selected assignees are not members of the chosen project. Please select valid project members.");
          setIsSavingTask(false);
          setActiveTab('assignment');
          return;
        }
      }
    }
    
    const tagsArray = newTaskForm.tags
      ? newTaskForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];
  
    let finalAssigneeIds = newTaskForm.assigneeIds && newTaskForm.assigneeIds.length > 0
      ? newTaskForm.assigneeIds
      : [currentUser.id];
    
    const taskPayload: Partial<Task> & { projectId?: string; assigneeIds?: string[] } = {
      title: newTaskForm.title,
      dueDate: newTaskForm.dueDate,
      priority: newTaskForm.priority,
      status: newTaskForm.status,
      description: newTaskForm.description,
      tags: tagsArray,
      projectId: newTaskForm.projectId || undefined,
      assigneeIds: finalAssigneeIds,
    };
  
    try {
      if (editingTask) {
        const updatedTask = await taskService.updateTask(editingTask.id, {
          ...taskPayload,
          assignedTo: finalAssigneeIds[0]
        });
        setAppTasks(prevTasks => prevTasks.map(t => t.id === editingTask.id ? updatedTask : t));
      } else {
        const savedTasks = await taskService.createTask(taskPayload);
        setAppTasks(prevTasks => [...savedTasks, ...prevTasks]);
      }
      setIsTaskFormModalOpen(false);
      setEditingTask(null);
      setIsMultiAssignment(false);
    } catch (error) {
      console.error("Error saving task:", error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleTaskFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
  
    if (errorMessage) {
      setErrorMessage(null);
    }
  
    if (name === 'priority') {
      setNewTaskForm(prev => ({ ...prev, priority: value as TaskPriority }));
    } else if (name === 'status') {
      setNewTaskForm(prev => ({ ...prev, status: value as TaskStatus }));
    } else if (name === 'projectId') {
      const selectedProject = appProjects.find(proj => proj.id === value);
      const currentAssigneeIds = newTaskForm.assigneeIds || [];
      
      let newAssigneeIds = [currentUser?.id || ''];
      
      if (value && selectedProject) {
        const validAssigneeIds = currentAssigneeIds.filter(assigneeId =>
          selectedProject.members?.some(member => member.id === assigneeId) || assigneeId === currentUser?.id
        );
        newAssigneeIds = validAssigneeIds.length > 0 ? validAssigneeIds : [currentUser?.id || ''];
      } else {
        const validAssigneeIds = currentAssigneeIds.filter(assigneeId =>
          connections.some(conn => conn.id === assigneeId) || assigneeId === currentUser?.id
        );
        newAssigneeIds = validAssigneeIds.length > 0 ? validAssigneeIds : [currentUser?.id || ''];
      }
      
      setNewTaskForm(prev => ({
        ...prev,
        projectId: value,
        assigneeIds: newAssigneeIds
      }));
    } else {
      setNewTaskForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAssigneeToggle = (assigneeId: string) => {
    setNewTaskForm(prev => {
      const currentAssigneeIds = prev.assigneeIds || [];
      const isSelected = currentAssigneeIds.includes(assigneeId);
      
      if (isMultiAssignment) {
        if (isSelected) {
          return { ...prev, assigneeIds: currentAssigneeIds.filter(id => id !== assigneeId) };
        } else {
          return { ...prev, assigneeIds: [...currentAssigneeIds, assigneeId] };
        }
      } else {
        return { ...prev, assigneeIds: [assigneeId] };
      }
    });
  };

  const requestDeleteTask = (taskId: string) => {
    setTaskToDeleteId(taskId);
    setIsDeleteConfirmModalOpen(true);
    setIsTaskInfoModalOpen(false);
  };

  const confirmDeleteTask = async () => {
    if (taskToDeleteId) {
      try {
        await taskService.deleteTask(taskToDeleteId);
        setAppTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDeleteId));
        
        if (editingTask?.id === taskToDeleteId) {
            setIsTaskFormModalOpen(false);
            setEditingTask(null);
        }
        if (taskForInfoModal?.id === taskToDeleteId) {
            setIsTaskInfoModalOpen(false);
            setTaskForInfoModal(null);
        }
        setIsDeleteConfirmModalOpen(false);
        setTaskToDeleteId(null);
      } catch (error) {
        console.error("Error deleting task:", error);
        alert(`Error deleting task: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsDeleteConfirmModalOpen(false);
      }
    }
  };

  const handleTaskUpdateFromCard = async (taskId: string, updates: Partial<Task>) => {
    try {
        const updatedTask = await taskService.updateTask(taskId, updates);
        setAppTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        return updatedTask;
    } catch (error) {
        console.error("Error updating task from card quick action:", error);
        alert(`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`);
        fetchTasksForPage();
        throw error;
    }
  };

  const handleNextTab = () => {
    if (activeTab === 'basic') setActiveTab('details');
    else if (activeTab === 'details') setActiveTab('assignment');
  };

  const handlePrevTab = () => {
    if (activeTab === 'assignment') setActiveTab('details');
    else if (activeTab === 'details') setActiveTab('basic');
  };

  const canProceedToNext = () => {
    if (activeTab === 'basic') {
      return newTaskForm.title.trim() !== '';
    }
    return true;
  };

  if (isLoadingTasks && !currentUser) {
    return <div className="p-6 text-center text-muted dark:text-muted-dark">Loading tasks...</div>;
  }

  const taskStatusColumns = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.COMPLETED];
  
  const columnColors = {
    [TaskStatus.TODO]: "bg-gray-50 dark:bg-surface-dark",
    [TaskStatus.IN_PROGRESS]: "bg-sky-50 dark:bg-sky-900/40",
    [TaskStatus.REVIEW]: "bg-orange-50 dark:bg-orange-900/40",
    [TaskStatus.COMPLETED]: "bg-green-50 dark:bg-green-900/40",
  };

  const getColumnDisplayName = (status: TaskStatus) => {
    const displayNames = {
      [TaskStatus.TODO]: "To Do",
      [TaskStatus.IN_PROGRESS]: "In Progress",
      [TaskStatus.REVIEW]: "Review",
      [TaskStatus.COMPLETED]: "Completed"
    };
    return displayNames[status] || status;
  };

  const getAvailableAssignees = () => {
    if (newTaskForm.projectId) {
      const selectedProject = appProjects.find(proj => proj.id === newTaskForm.projectId);
      return selectedProject?.members || [];
    }
    return [
      { id: currentUser?.id || '', full_name: currentUser?.full_name || 'You' },
      ...connections.map(conn => ({ id: conn.id, full_name: conn.name }))
    ];
  };

  // Renders a generic task card for board view
  const renderTaskCard = (task: Task, options: { showAssignee?: boolean; showAssigner?: boolean } = {}) => {
    const isDragging = draggedTask?.id === task.id;
    const formattedDate = new Date(task.dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  
    const priorityBorderColor = {
      [TaskPriority.HIGH]: 'border-l-red-500 dark:border-l-red-400',
      [TaskPriority.MEDIUM]: 'border-l-orange-500 dark:border-l-orange-400',
      [TaskPriority.LOW]: 'border-l-green-500 dark:border-l-green-400',
    };
    const borderClass = priorityBorderColor[task.priority] || 'border-l-gray-300 dark:border-l-gray-600';
    
    const assigneeName = options.showAssignee && task.assignedTo
      ? memberLookup.get(task.assignedTo) || 'Unknown User'
      : null;
      
    const assignerName = options.showAssigner && task.userId
      ? memberLookup.get(task.userId) || 'Unknown User'
      : null;
      
    const titleClass = task.status === TaskStatus.COMPLETED
      ? 'line-through text-muted dark:text-muted-dark'
      : 'text-text dark:text-text-dark';
  
    return (
      <div
        key={task.id}
        onClick={() => handleOpenTaskInfoModal(task)}
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        draggable
        className={`p-3 mb-3 rounded-lg shadow-sm bg-card dark:bg-card-dark border border-border dark:border-border-dark/50 border-l-4 ${borderClass} cursor-pointer transition-shadow hover:shadow-lg ${
          isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''
        }`}
      >
        <h4 className={`text-sm font-semibold truncate mb-1 ${titleClass}`}>
          {task.title}
        </h4>
  
        {assigneeName && (
          <p className="text-xs text-muted dark:text-muted-dark mt-1 truncate">
            To: <strong className="font-semibold text-text dark:text-text-dark">{assigneeName}</strong>
          </p>
        )}
        
        {assignerName && (
          <p className="text-xs text-muted dark:text-muted-dark mt-1 truncate">
            From: <strong className="font-semibold text-text dark:text-text-dark">{assignerName}</strong>
          </p>
        )}
  
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted dark:text-muted-dark">{formattedDate}</p>
          {task.tags && task.tags[0] && (
            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-2 py-0.5 rounded-full">
              {task.tags[0]}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Filter and Sort Bar Component
  const renderFilterSortBar = () => (
    <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left & Center: Filters and Sorters */}
        <div className="flex items-center gap-3 flex-grow min-w-0">
          <span className="text-sm font-medium text-text dark:text-text-dark flex-shrink-0">Filter:</span>
          
          {/* Priority Filter */}
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="text-sm border border-border dark:border-border-dark rounded-md px-2 py-1 bg-card dark:bg-surface-dark text-text dark:text-text-dark"
          >
            <option value="all">All Priorities</option>
            <option value={TaskPriority.HIGH}>High</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.LOW}>Low</option>
          </select>

          {/* Tag Filter */}
          <select
            value={filters.tag}
            onChange={(e) => handleFilterChange('tag', e.target.value)}
            className="text-sm border border-border dark:border-border-dark rounded-md px-2 py-1 bg-card dark:bg-surface-dark text-text dark:text-text-dark"
          >
            <option value="all">All Tags</option>
            {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={filters.assignee}
            onChange={(e) => handleFilterChange('assignee', e.target.value)}
            className="text-sm border border-border dark:border-border-dark rounded-md px-2 py-1 bg-card dark:bg-surface-dark text-text dark:text-text-dark"
          >
            <option value="all">All Assignees</option>
            {availableAssignees.map(assignee => (
              <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
            ))}
          </select>

          {/* Due Date Filter */}
          <select
            value={filters.dueDate}
            onChange={(e) => handleFilterChange('dueDate', e.target.value)}
            className="text-sm border border-border dark:border-border-dark rounded-md px-2 py-1 bg-card dark:bg-surface-dark text-text dark:text-text-dark"
          >
            <option value="all">All Due Dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="next_week">Next Week</option>
            <option value="this_month">This Month</option>
            <option value="next_month">Next Month</option>
          </select>

          <div className="w-px h-5 bg-border dark:bg-border-dark mx-1"></div>
          
          <span className="text-sm font-medium text-text dark:text-text-dark flex-shrink-0">Sort:</span>
          
          {/* Combined sort control */}
          <div className="flex items-center border border-border dark:border-border-dark rounded-md">
            <select
              value={sorting.field}
              onChange={(e) => setSorting(prev => ({ ...prev, field: e.target.value as SortState['field'] }))}
              className="text-sm border-0 rounded-l-md pl-2 pr-1 py-1 bg-card dark:bg-surface-dark text-text dark:text-text-dark focus:ring-0"
            >
              {['priority', 'dueDate', 'assignee', 'createdAt', 'status', 'title'].map(field => (
                <option key={field} value={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSorting(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
              title="Toggle sort direction"
              className="px-2 py-1 border-l border-border dark:border-border-dark text-muted hover:bg-surface dark:text-muted-dark dark:hover:bg-card-dark rounded-r-md"
            >
              {sorting.direction === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Right side: Clear button and count */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={clearFilters}
            className="text-sm px-3 py-1 text-muted hover:text-text dark:text-muted-dark dark:hover:text-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface dark:hover:bg-surface-dark transition-colors"
          >
            Clear Filters
          </button>
          <div className="text-sm text-muted dark:text-muted-dark">
            {filteredAndSortedTasks.length} of {allUserTasks.length} tasks
          </div>
        </div>
      </div>
    </div>
  );

  const renderViewTabs = () => (
    <div className="flex space-x-1 border-b border-border dark:border-border-dark">
      {[
        { id: 'list', label: 'Tasks', icon: '☰' },
        { id: 'board', label: 'Board', icon: '⁚' },
        { id: 'timeline', label: 'Timeline', icon: '📅' }
      ].map((view) => (
        <button
          key={view.id}
          onClick={() => setCurrentView(view.id as ViewType)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            currentView === view.id
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark hover:border-gray-300 dark:hover:border-border-dark'
          }`}
        >
          <span className="mr-2">{view.icon}</span>
          {view.label}
        </button>
      ))}
    </div>
  );

  const renderBoardView = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 flex-shrink-0" style={{ minHeight: '300px' }}>
        {taskStatusColumns.map(status => (
          <div key={status} className="relative">
            <DropZone
              targetStatus={status}
              onDrop={handleDrop}
              title={getColumnDisplayName(status)}
              className={`${columnColors[status]} rounded-xl p-2 sm:p-4`}
              taskCount={(tasksByStatus[status] || []).length}
              isLoading={isTaskUpdating(draggedTask?.id || '') && draggedTask?.status !== status}
            >
              {(tasksByStatus[status] || []).map(task => renderTaskCard(task))}
              
              {!isLoadingTasks && tasksByStatus[status] && (tasksByStatus[status] || []).length > 0 && (
                <div
                  className="flex items-center justify-center p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-surface-dark/50 rounded-lg transition-colors"
                  onClick={() => handleCreateTaskInColumn(status)}
                >
                  <PlusIcon className="w-8 h-8 opacity-30 text-muted dark:text-muted-dark" />
                </div>
              )}
              
              {isLoadingTasks && (!tasksByStatus[status] || (tasksByStatus[status] || []).length === 0) && (
                  <div className="p-4 text-center text-sm text-muted dark:text-muted-dark">Loading...</div>
              )}
              
              {!isLoadingTasks && (!tasksByStatus[status] || (tasksByStatus[status] || []).length === 0) && (
                  <div
                    className="flex flex-col items-center justify-center h-full text-muted dark:text-muted-dark p-4 text-center cursor-pointer hover:bg-black/5 dark:hover:bg-surface-dark/50 rounded-lg transition-colors"
                    onClick={() => handleCreateTaskInColumn(status)}
                  >
                      <PlusIcon className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm opacity-70">Click to add task</p>
                  </div>
              )}
            </DropZone>
          </div>
        ))}
      </div>
    </>
  );

  const renderListView = () => (
    <div className="bg-card dark:bg-card-dark rounded-lg border border-border dark:border-border-dark overflow-hidden text-xs">
      {/* Table Header */}
      <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark font-medium text-text dark:text-text-dark">
        <div>Task name</div>
        <div>Priority</div>
        <div>Due</div>
        <div>Tag</div>
        <div>Status</div>
        <div>Assign</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border dark:divide-border-dark">
        {filteredAndSortedTasks.map((task) => {
          const assigneeName = task.assignedTo ? memberLookup.get(task.assignedTo) || 'Unassigned' : 'Unassigned';
          const formattedDate = new Date(task.dueDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });

          const priorityColors = {
            [TaskPriority.HIGH]: 'text-red-600 dark:text-red-400',
            [TaskPriority.MEDIUM]: 'text-orange-600 dark:text-orange-400',
            [TaskPriority.LOW]: 'text-green-600 dark:text-green-400',
          };

          const statusBadge = {
            [TaskStatus.TODO]: 'bg-gray-100 text-gray-800 dark:bg-surface-dark dark:text-text-dark',
            [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            [TaskStatus.REVIEW]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
            [TaskStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          };

          return (
            <div
              key={task.id}
              onClick={() => handleOpenTaskInfoModal(task)}
              className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-surface dark:hover:bg-surface-dark cursor-pointer transition-colors"
            >
              <div className="flex items-center">
                <span className={`font-medium ${task.status === TaskStatus.COMPLETED ? 'line-through text-muted dark:text-muted-dark' : 'text-text dark:text-text-dark'}`}>
                  {task.title}
                </span>
              </div>
              
              <div className="flex items-center">
                <span className={`font-medium ${priorityColors[task.priority]}`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              </div>
              
              <div className="flex items-center text-text dark:text-text-dark">
                {formattedDate}
              </div>
              
              <div className="flex items-center">
                {task.tags && task.tags.length > 0 ? (
                  <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 px-2 py-1 rounded">
                    {task.tags[0]}
                  </span>
                ) : (
                  <span className="text-muted dark:text-muted-dark">-</span>
                )}
              </div>
              
              <div className="flex items-center">
                <span className={`px-2 py-1 rounded-full ${statusBadge[task.status]}`}>
                  {getColumnDisplayName(task.status)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-border dark:bg-border-dark rounded-full flex items-center justify-center font-medium">
                  {assigneeName.charAt(0).toUpperCase()}
                </div>
                <span className="text-text dark:text-text-dark truncate">{assigneeName}</span>
              </div>
            </div>
          );
        })}
        
        {/* Add New Task Row */}
        <div
          onClick={() => handleOpenNewTaskModal()}
          className="grid grid-cols-6 gap-4 px-4 py-3 text-muted dark:text-muted-dark hover:bg-surface dark:hover:bg-surface-dark cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-2">
            <PlusIcon className="w-4 h-4" />
            <span>New task</span>
          </div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    </div>
  );

  const renderTimelineView = () => {
    const timelineDays = getTimelineDays(timelineStartDate);
    
    // Group days by month name, preserving order
    const groupedTimelineDays = timelineDays.reduce<Array<{ monthName: string; days: Date[] }>>((acc, day) => {
      const monthName = day.toLocaleString('default', { month: 'long' });
      const lastGroup = acc[acc.length - 1];
      
      if (lastGroup && lastGroup.monthName === monthName) {
        lastGroup.days.push(day);
      } else {
        acc.push({ monthName, days: [day] });
      }
      
      return acc;
    }, []);

    // Group tasks by status for timeline sections
    const taskGroups = {
      'To Do': filteredAndSortedTasks.filter(task => task.status === TaskStatus.TODO),
      'In Progress': filteredAndSortedTasks.filter(task => task.status === TaskStatus.IN_PROGRESS),
      'Review': filteredAndSortedTasks.filter(task => task.status === TaskStatus.REVIEW),
      'Completed': filteredAndSortedTasks.filter(task => task.status === TaskStatus.COMPLETED),
    };
    
    // Task colors by priority
    const taskColors = {
      [TaskPriority.HIGH]: 'bg-red-400',
      [TaskPriority.MEDIUM]: 'bg-orange-400', 
      [TaskPriority.LOW]: 'bg-green-400',
    };
    
    const getTaskPosition = (task: Task) => {
      const taskDate = new Date(task.dueDate);
      const dayIndex = timelineDays.findIndex(day => 
        day.toDateString() === taskDate.toDateString()
      );
      return dayIndex >= 0 ? dayIndex : null;
    };

    const formatTimelineDate = (date: Date) => {
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    };

    return (
      <div className="space-y-4">
        {/* Timeline Navigation */}
        <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateTimeline('prev')}
                className="px-3 py-2 text-sm bg-surface hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-card-dark rounded-md transition-colors"
              >
                ← Previous Week
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 rounded-md transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateTimeline('next')}
                className="px-3 py-2 text-sm bg-surface hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-card-dark rounded-md transition-colors"
              >
                Next Week →
              </button>
            </div>
            <div className="text-sm text-muted dark:text-muted-dark">
              {formatTimelineDate(timelineDays[0])} - {formatTimelineDate(timelineDays[timelineDays.length - 1])}
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <div className="bg-card dark:bg-card-dark rounded-lg border border-border dark:border-border-dark">
          <div className="min-w-[800px] overflow-x-auto" style={{scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc'}}>
            {/* Timeline Header */}
            <div className="sticky top-0 z-10 bg-card dark:bg-card-dark">
              <div className="grid grid-cols-[200px_1fr] gap-0">
                <div className="p-3 bg-surface dark:bg-surface-dark border-r border-b border-border dark:border-border-dark flex items-end">
                  <h3 className="text-sm font-medium text-text dark:text-text-dark">Tasks</h3>
                </div>
                <div>
                  {/* Row 1: Months */}
                  <div className="grid bg-surface dark:bg-surface-dark" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)` }}>
                    {groupedTimelineDays.map(({ monthName, days }, index) => (
                      <div
                        key={monthName + index}
                        className={`p-2 text-center text-sm font-medium text-text dark:text-text-dark border-b border-border dark:border-border-dark ${index < groupedTimelineDays.length - 1 ? 'border-r' : ''}`}
                        style={{ gridColumn: `span ${days.length}` }}
                      >
                        {monthName.toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {/* Row 2: Days */}
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)` }}>
                    {timelineDays.map((day, index) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      
                      return (
                        <div
                          key={index}
                          className={`p-2 text-center border-r border-b border-border dark:border-border-dark text-xs ${
                            isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 
                            isWeekend ? 'bg-surface dark:bg-surface-dark' : 'bg-card dark:bg-card-dark'
                          }`}
                        >
                          <div className={`font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-text dark:text-text-dark'}`}>
                            {day.getDate()}
                          </div>
                          <div className="text-muted dark:text-muted-dark">
                            {day.toLocaleDateString(undefined, { weekday: 'short' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Body */}
            <div className="divide-y divide-border dark:divide-border-dark">
              {Object.entries(taskGroups).map(([groupName, tasks]) => (
                <div key={groupName}>
                  {/* Section Header */}
                  <div className="grid grid-cols-[200px_1fr] gap-0 bg-surface/50 dark:bg-surface-dark/50">
                    <div className="p-3 border-r border-border dark:border-border-dark">
                      <h4 className="text-sm font-medium text-text dark:text-text-dark">
                        {groupName} ({tasks.length})
                      </h4>
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)` }}>
                      {timelineDays.map((_, index) => (
                        <div key={index} className="border-r border-border dark:border-border-dark h-8"></div>
                      ))}
                    </div>
                  </div>

                  {/* Tasks in this group */}
                  {tasks.map((task) => {
                    const position = getTaskPosition(task);
                    const assigneeName = task.assignedTo ? memberLookup.get(task.assignedTo) : 'Unassigned';
                    
                    return (
                      <div key={task.id} className="grid grid-cols-[200px_1fr] gap-0 hover:bg-surface/50 dark:hover:bg-surface-dark/50">
                        <div className="p-3 border-r border-border dark:border-border-dark">
                          <div 
                            className="cursor-pointer"
                            onClick={() => handleOpenTaskInfoModal(task)}
                          >
                            <div className={`text-xs font-medium truncate ${
                              task.status === TaskStatus.COMPLETED ? 'line-through text-muted dark:text-muted-dark' : 'text-text dark:text-text-dark'
                            }`}>
                              {task.title}
                            </div>
                            <div className="text-xs text-muted dark:text-muted-dark mt-1">
                              {assigneeName}
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)` }}>
                          {timelineDays.map((day, index) => {
                            const isTaskDay = position === index;
                            
                            return (
                              <div 
                                key={index} 
                                className="border-r border-border dark:border-border-dark h-12 flex items-center px-1"
                              >
                                {isTaskDay && (
                                  <div
                                    className={`w-full h-6 rounded text-white text-xs flex items-center justify-center cursor-pointer ${taskColors[task.priority]}`}
                                    onClick={() => handleOpenTaskInfoModal(task)}
                                    title={`${task.title} - ${task.dueDate}`}
                                  >
                                    <span className="truncate px-2">{task.title}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Today indicator line */}
            <div className="relative pointer-events-none">
              {(() => {
                const todayIndex = timelineDays.findIndex(day => 
                  day.toDateString() === new Date().toDateString()
                );
                if (todayIndex >= 0) {
                  const leftOffset = 200 + (todayIndex * (100 / timelineDays.length));
                  return (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                      style={{ left: `calc(${leftOffset}px + ${(100 / timelineDays.length) / 2}%)` }}
                    />
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderTaskForm = () => {
    const tabs = [
      { id: 'basic', label: 'Basics', icon: '📝' },
      { id: 'details', label: 'Details', icon: '📋' },
      { id: 'assignment', label: 'Assignment', icon: '👥' }
    ];

    return (
      <div className="space-y-6">
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Unable to save task
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  {errorMessage}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center border-b border-border dark:border-border-dark">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-muted hover:text-text dark:text-muted-dark dark:hover:text-text-dark'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[300px]">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-sm font-bold text-text dark:text-text-dark">What's the task about?</p>
              </div>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={newTaskForm.title}
                  onChange={handleTaskFormChange}
                  className="input-style"
                  placeholder="e.g., Review project proposal"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    id="dueDate"
                    value={newTaskForm.dueDate}
                    onChange={handleTaskFormChange}
                    className="input-style"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">Priority</label>
                  <div className="flex space-x-3">
                    {[
                      { value: TaskPriority.LOW, label: 'Low', color: 'green' },
                      { value: TaskPriority.MEDIUM, label: 'Medium', color: 'orange' },
                      { value: TaskPriority.HIGH, label: 'High', color: 'red' }
                    ].map((priority) => (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() => setNewTaskForm(prev => ({ ...prev, priority: priority.value }))}
                        className={`flex-1 p-3 rounded-lg border transition-all ${
                          newTaskForm.priority === priority.value
                            ? priority.color === 'green'
                              ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-200'
                              : priority.color === 'orange'
                              ? 'bg-orange-100 border-orange-500 text-orange-800 dark:bg-orange-900/30 dark:border-orange-400 dark:text-orange-200'
                              : 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-200'
                            : 'bg-surface border-border text-text hover:bg-gray-100 dark:bg-surface-dark dark:border-border-dark dark:text-text-dark dark:hover:bg-card-dark'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-sm font-medium">{priority.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Status</label>
                <select name="status" id="status" value={newTaskForm.status} onChange={handleTaskFormChange} className="input-style">
                  <option value={TaskStatus.TODO}>{getColumnDisplayName(TaskStatus.TODO)}</option>
                  <option value={TaskStatus.IN_PROGRESS}>{getColumnDisplayName(TaskStatus.IN_PROGRESS)}</option>
                  <option value={TaskStatus.REVIEW}>{getColumnDisplayName(TaskStatus.REVIEW)}</option>
                  <option value={TaskStatus.COMPLETED}>{getColumnDisplayName(TaskStatus.COMPLETED)}</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-sm font-bold text-text dark:text-text-dark">Optional information to help organize your task</p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Description</label>
                <textarea
                  name="description"
                  id="description"
                  value={newTaskForm.description}
                  onChange={handleTaskFormChange}
                  rows={4}
                  className="input-style"
                  placeholder="Add any additional details about this task..."
                />
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Tags</label>
                <input
                  type="text"
                  name="tags"
                  id="tags"
                  value={newTaskForm.tags}
                  onChange={handleTaskFormChange}
                  className="input-style"
                  placeholder="e.g., work, urgent, design"
                />
                <p className="text-xs text-muted dark:text-muted-dark mt-1">Separate tags with commas</p>
              </div>

              <div>
                <label htmlFor="projectId" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Project</label>
                <select name="projectId" id="projectId" value={newTaskForm.projectId} onChange={handleTaskFormChange} className="input-style">
                  <option value="">📂 No Project</option>
                  {appProjects.map(proj => (
                    <option key={proj.id} value={proj.id}>📁 {proj.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          {activeTab === 'assignment' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-text dark:text-text-dark mb-2">Who's responsible?</h3>
                <p className="text-sm text-muted dark:text-muted-dark">
                  {newTaskForm.projectId
                    ? "Assign this task to project members"
                    : "Assign this task to yourself or someone from your connections"
                  }
                </p>
              </div>

              {/* Multi-select dropdown in top-left */}
              {!editingTask && (
                <div className="flex justify-start mb-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMultiAssignment(!isMultiAssignment)}
                      className={`flex items-center space-x-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                        isMultiAssignment
                          ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                          : 'bg-surface border-border text-text hover:bg-gray-100 dark:bg-surface-dark dark:border-border-dark dark:text-text-dark dark:hover:bg-card-dark'
                      }`}
                    >
                      <span className="text-sm">👥</span>
                      <span>Multiple Assignees</span>
                      {isMultiAssignment && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {newTaskForm.assigneeIds?.length || 0}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="assigneeId" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Assign To</label>
                {!isMultiAssignment ? (
                  <select
                    name="assigneeId"
                    id="assigneeId"
                    value={newTaskForm.assigneeIds?.[0] || ''}
                    onChange={(e) => setNewTaskForm(prev => ({ ...prev, assigneeIds: [e.target.value] }))}
                    className="input-style"
                    disabled={isLoadingConnections}
                  >
                    <option value={currentUser?.id || ''}>👤 Assign to Myself</option>
                    
                    {newTaskForm.projectId ? (
                      appProjects
                        .find(proj => proj.id === newTaskForm.projectId)
                        ?.members?.filter(member => member.id !== currentUser?.id)
                        .map(member => (
                          <option key={member.id} value={member.id}>
                            👥 {member.full_name}
                          </option>
                        ))
                    ) : (
                      connections.map(conn => (
                        <option key={conn.id} value={conn.id}>👥 {conn.name}</option>
                      ))
                    )}
                  </select>
                ) : (
                  <div className="relative">
                    <div className="input-style min-h-[42px] max-h-48 overflow-y-auto p-2 space-y-1" style={{scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 #f7fafc'}}>
                      <label className="flex items-center space-x-2 p-1 hover:bg-surface dark:hover:bg-surface-dark rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTaskForm.assigneeIds?.includes(currentUser?.id || '') || false}
                          onChange={() => handleAssigneeToggle(currentUser?.id || '')}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">👤 Assign to Myself</span>
                      </label>
                      
                      {newTaskForm.projectId ? (
                        appProjects
                          .find(proj => proj.id === newTaskForm.projectId)
                          ?.members?.filter(member => member.id !== currentUser?.id)
                          .map(member => (
                            <label key={member.id} className="flex items-center space-x-2 p-1 hover:bg-surface dark:hover:bg-surface-dark rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newTaskForm.assigneeIds?.includes(member.id) || false}
                                onChange={() => handleAssigneeToggle(member.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm">👥 {member.full_name}</span>
                            </label>
                          ))
                      ) : (
                        connections.map(conn => (
                          <label key={conn.id} className="flex items-center space-x-2 p-1 hover:bg-surface dark:hover:bg-surface-dark rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newTaskForm.assigneeIds?.includes(conn.id) || false}
                              onChange={() => handleAssigneeToggle(conn.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm">👥 {conn.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {isLoadingConnections && (
                  <p className="text-xs text-muted dark:text-muted-dark mt-1">Loading connections...</p>
                )}
                
                {newTaskForm.projectId && (
                  appProjects.find(proj => proj.id === newTaskForm.projectId)?.members?.length === 1 ? (
                    <p className="text-xs text-muted dark:text-muted-dark mt-1">
                      Only you are in this project. Add more members to assign tasks to others.
                    </p>
                  ) : (
                    <p className="text-xs text-muted dark:text-muted-dark mt-1">
                      Showing members from: <strong>{appProjects.find(proj => proj.id === newTaskForm.projectId)?.name}</strong>
                    </p>
                  )
                )}
                
                {!newTaskForm.projectId && connections.length === 0 && !isLoadingConnections && (
                  <p className="text-xs text-muted dark:text-muted-dark mt-1">
                    No connections available. Connect with people to assign tasks to them.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-border dark:border-border-dark">
          <button
            type="button"
            onClick={handlePrevTab}
            disabled={activeTab === 'basic'}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'basic'
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-text hover:text-gray-900 dark:text-text-dark dark:hover:text-white'
            }`}
          >
            ← Previous
          </button>

          <div className="flex space-x-2">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-500'
                    : index < tabs.findIndex(t => t.id === activeTab)
                    ? 'bg-green-500'
                    : 'bg-border dark:bg-border-dark'
                }`}
              />
            ))}
          </div>

          {activeTab !== 'assignment' ? (
            <button
              type="button"
              onClick={handleNextTab}
              disabled={!canProceedToNext()}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                canProceedToNext()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-surface-dark dark:text-muted-dark'
              }`}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveTask}
              disabled={isSavingTask || !canProceedToNext()}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                canProceedToNext() && !isSavingTask
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-surface-dark dark:text-muted-dark'
              }`}
            >
              {isSavingTask ? 'Saving...' : editingTask ? 'Update Task' :
                (isMultiAssignment && newTaskForm.assigneeIds && newTaskForm.assigneeIds.length > 1
                  ? `Create ${newTaskForm.assigneeIds.length} Tasks`
                  : 'Create Task')
              }
            </button>
          )}
        </div>

        {editingTask && (
          <div className="pt-4 border-t border-border dark:border-border-dark">
            <Button
              type="button"
              variant="danger"
              onClick={() => requestDeleteTask(editingTask.id)}
              className="w-full"
            >
              Delete Task
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <TaskDropContext.Provider value={taskDropContextValue}>
      <div className="h-full flex flex-col p-4 sm:p-6 bg-background dark:bg-background-dark">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-text dark:text-text-dark">Taskboard</h1>
            <Button onClick={() => handleOpenNewTaskModal()} leftIcon={<PlusIcon />}>
                New Task
            </Button>
        </div>

        {/* View Tabs */}
        {renderViewTabs()}

        {/* Filter and Sort Bar */}
        {renderFilterSortBar()}

        <div className="flex-1">
          {/* Render different views based on current selection */}
          {currentView === 'board' && renderBoardView()}
          {currentView === 'list' && renderListView()}
          {currentView === 'timeline' && renderTimelineView()}
        </div>
        
        {/* Tasks Received and Assigned sections - only show in board view to avoid duplication */}
        {currentView === 'board' && (
          <>
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-text dark:text-text-dark">
                  Tasks Received <span className="text-base font-normal text-muted dark:text-muted-dark">({tasksReceived.length})</span>
                </h2>
              </div>
              {tasksReceived.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tasksReceived.map(task => renderTaskCard(task, { showAssigner: true }))}
                </div>
              ) : (
                <Card className="p-6 text-center text-muted dark:text-muted-dark">
                  You haven't received any tasks from others yet.
                </Card>
              )}
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-text dark:text-text-dark">
                  Tasks Assigned <span className="text-base font-normal text-muted dark:text-muted-dark">({tasksAssignedByMe.length})</span>
                </h2>
                <Button onClick={handleCreateAssignedTask} leftIcon={<PlusIcon />} size="sm">
                  Assign Task
                </Button>
              </div>
              {tasksAssignedByMe.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tasksAssignedByMe.map(task => renderTaskCard(task, { showAssignee: true }))}
                </div>
              ) : (
                <Card
                  className="p-6 text-center text-muted dark:text-muted-dark cursor-pointer hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                  onClick={handleCreateAssignedTask}
                >
                  <PlusIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Click to assign your first task to someone</p>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Statistics - always show */}
        <div className="mt-auto pt-4 border-t border-border dark:border-border-dark grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold text-text dark:text-text-dark">{myActiveTasks.length + tasksReceived.length + tasksAssignedByMe.length}</p>
                        <p className="text-sm text-muted dark:text-muted-dark">Total Tasks</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text dark:text-text-dark">{tasksReceived.length}</p>
                        <p className="text-sm text-muted dark:text-muted-dark">Received</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text dark:text-text-dark">{tasksAssignedByMe.length}</p>
                        <p className="text-sm text-muted dark:text-muted-dark">Assigned</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text dark:text-text-dark">{completionRate}%</p>
                        <p className="text-sm text-muted dark:text-muted-dark">Completion Rate</p>
                    </div>
                </div>

        {isTaskInfoModalOpen && taskForInfoModal && (
          <TaskInfoModal
            isOpen={isTaskInfoModalOpen}
            onClose={() => setIsTaskInfoModalOpen(false)}
            task={taskForInfoModal}
            onEdit={() => handleEditFromInfoModal(taskForInfoModal)}
            onDelete={() => requestDeleteTask(taskForInfoModal.id)}
          />
        )}

        {isTaskFormModalOpen && (
          <Modal
            isOpen={isTaskFormModalOpen}
            onClose={() => {setIsTaskFormModalOpen(false); setEditingTask(null); setActiveTab('basic'); setErrorMessage(null); setIsMultiAssignment(false);}}
            title={editingTask ? "Edit Task" : (isMultiAssignment ? "Create New Tasks" : "Create New Task")}
            size="lg"
          >
            {renderTaskForm()}
          </Modal>
        )}

        {isDeleteConfirmModalOpen && (
          <Modal
            isOpen={isDeleteConfirmModalOpen}
            onClose={() => setIsDeleteConfirmModalOpen(false)}
            title="Confirm Delete Task"
            onSave={confirmDeleteTask}
            saveLabel="Delete"
            size="sm"
          >
            <p className="text-sm text-text dark:text-text-dark">
                Are you sure you want to delete this task? This action cannot be undone.
            </p>
          </Modal>
        )}
      </div>
    </TaskDropContext.Provider>
  );
};