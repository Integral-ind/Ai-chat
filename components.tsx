import React, { ReactNode, useRef, useEffect, useState, useCallback, useContext } from 'react'; // Added useContext
import { Task, TaskPriority, TaskStatus, Note, NoteCategory, DarkModeContextType, StatCardData, User as FrontendUser, GlobalSearchResults, GlobalSearchResultItem, ResourceItemType } from './types';
import { 
    EllipsisHorizontalIcon, PaperClipIcon, ChatBubbleLeftIcon, PRIORITY_STYLES, 
    TAG_COLORS, StarIcon, CheckIcon as GlobalCheckIcon,
    BookOpenIcon, ClipboardDocumentListIcon, EyeIcon, TrendingUpIcon, TrendingDownIcon, Trash2Icon, UserCircleIcon as EditIcon, 
    SearchIcon as GlobalSearchIcon, XMarkIcon as GlobalXMarkIcon, TeamIcon, FolderIcon, DocumentTextIcon, CalendarDaysIcon, UserCircleIcon,
    BriefcaseIcon, ChartPieIcon // Added BriefcaseIcon and ChartPieIcon
} from './constants';
import { DarkModeContext } from './App'; 
import { TaskDropContext } from './pages/TasksPage'; 

// Theme Toggle Button Component
export const ThemeToggleButton: React.FC = () => {
  const context = React.useContext(DarkModeContext);
  if (!context) {
    return null; 
  }
  const { isDarkMode, toggleDarkMode } = context;
  const [tooltipText, setTooltipText] = useState('');

  useEffect(() => {
    setTooltipText(isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  }, [isDarkMode]);
  
  const handleToggleTheme = () => {
    toggleDarkMode();
  };

  return (
    <button
      id="theme-toggle-react-button"
      className="theme-toggle-button" 
      aria-label={tooltipText}
      onClick={handleToggleTheme}
      data-tooltip={tooltipText}
    >
      {isDarkMode 
        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2"/><path d="m12 1 0 2M12 21l0 2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12l2 0M21 12l2 0M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      }
    </button>
  );
};

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      className={`bg-card dark:bg-card-dark rounded-xl shadow-sm border border-border/50 dark:border-border-dark/50 ${className} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const StatCard: React.FC<StatCardData & { className?: string; valueClassName?: string; iconContainerClassName?: string; }> = ({ title, value, change, icon: Icon, iconBgColor = "bg-primary/10", className, valueClassName, footerText, trendIcon: TrendIcon, iconContainerClassName }) => (
    <Card className={`p-5 flex flex-col justify-between ${className || ''}`}>
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-muted dark:text-muted-dark text-sm">{title}</h3>
            <div className={`p-2 rounded-full ${iconBgColor} ${iconContainerClassName || ''}`}>
                <Icon className={`w-5 h-5 ${valueClassName || 'text-primary'}`} />
            </div>
        </div>
        
        <div>
            <p className={`text-3xl font-bold text-text dark:text-text-dark ${valueClassName}`}>{value}</p>
            <div className="flex items-center text-xs text-muted dark:text-muted-dark mt-1">
                {change && TrendIcon && (
                    <div className={`flex items-center mr-2 ${change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        <TrendIcon className="w-4 h-4" />
                        <span className="ml-1 font-medium">{change}</span>
                    </div>
                )}
                {footerText && <span>{footerText}</span>}
            </div>
        </div>
    </Card>
);

export const TeamStatCard: React.FC<StatCardData> = ({ title, value, icon: Icon, onClick }) => (
    <Card onClick={onClick} className="p-4 flex items-center justify-between transition-all hover:border-primary/50 dark:hover:border-primary-light/50 hover:bg-surface dark:hover:bg-surface-dark">
        <div>
            <h3 className="text-sm font-medium text-muted dark:text-muted-dark">{title}</h3>
            <p className="text-4xl font-bold text-text dark:text-text-dark mt-1">{value}</p>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary dark:text-primary-light" />
        </div>
    </Card>
);


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  leftIcon, 
  rightIcon, 
  className = '', 
  loading = false,
  disabled,
  ...props 
}) => {
  const baseStyles = 'font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-background-dark transition-colors duration-150 inline-flex items-center justify-center';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary-light dark:hover:bg-primary-light focus:ring-primary',
    secondary: 'bg-secondary text-white hover:bg-emerald-600 dark:hover:bg-emerald-400 focus:ring-secondary',
    outline: 'border border-gray-300 dark:border-border-dark text-text dark:text-text-dark hover:bg-gray-100 dark:hover:bg-surface-dark focus:ring-primary-light',
    ghost: 'text-text dark:text-text-dark hover:bg-gray-100 dark:hover:bg-surface-dark focus:ring-primary-light',
    danger: 'bg-red-500 text-white hover:bg-red-600 dark:hover:bg-red-400 focus:ring-red-500',
    dangerOutline: 'border border-red-500 text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 focus:ring-red-500',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

// ==============================================================
// === NEW COMPONENTS ADDED HERE ================================
// ==============================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, error, ...props }) => {
  const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
        {label}
      </label>
      <input
        id={inputId}
        // NOTE: Your original TaskCard uses a global 'input-style' class. I am reusing it here for consistency.
        // If it doesn't exist, you can replace it with: 'w-full px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary'
        className="input-style w-full"
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, error, ...props }) => {
  const textareaId = id || props.name || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <label htmlFor={textareaId} className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">
        {label}
      </label>
      <textarea
        id={textareaId}
        className="input-style w-full"
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ options, value, onChange, disabled }) => {
  return (
    <div className="flex items-center space-x-3">
      {options.map((option) => (
        <label key={option.value} className={`flex items-center space-x-1.5 text-sm ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="radio-group" // This should be unique if multiple radio groups are in one form
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
};

// ==============================================================
// === END OF NEW COMPONENTS ====================================
// ==============================================================

interface ProgressBarProps {
  progress: number;
  className?: string;
  color?: string;
  barStyle?: React.CSSProperties;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className = 'h-2', color = 'bg-primary', barStyle }) => {
  const cappedProgress = Math.min(100, Math.max(0, progress));
  return (
    <div className={`w-full bg-surface dark:bg-surface-dark rounded-full ${className}`}>
      <div
        className={`${color} h-full rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${cappedProgress}%`, ...barStyle }}
      ></div>
    </div>
  );
};

interface TaskCardProps {
  task: Task;
  currentUser?: FrontendUser | null;
  onClick?: (task: Task) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, task: Task) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean; 
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<Task | void>;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  showProject?: boolean;
}


const triggerHapticFeedback = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(50); 
  }
};

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  currentUser,
  onClick, 
  onDragStart,
  onDragEnd,
  isDragging: isParentDragging = false,
  onUpdateTask,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const taskDropCtx = useContext(TaskDropContext); 
  
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false); 
  const [dragOffset, setDragOffset] = useState<{x: number, y: number}>({x: 0, y: 0});

  const priorityStyle = task.priority ? PRIORITY_STYLES[task.priority] : { border: 'border-gray-300 dark:border-gray-500' };
  const isCompleted = task.status === TaskStatus.COMPLETED;

  const handleDragStartInternal = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      taskId: task.id,
      taskData: task, 
      sourceStatus: task.status 
    }));
    e.dataTransfer.effectAllowed = 'move';
    
    if (onDragStart) {
      onDragStart(e, task);
    }
  };

  const handleDragEndInternal = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if(isUpdating) return;
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false); 
    setDragOffset({x:0, y:0});
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPos || isUpdating) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.x;
    const deltaY = touch.clientY - touchStartPos.y;
    
    if (!isTouchDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      setIsTouchDragging(true);
      triggerHapticFeedback(); 
      setDragOffset({ x: deltaX, y: deltaY }); 
      document.body.classList.add('dragging-active'); 
      document.body.classList.add('mobile-drag-active'); 
      
      if (onDragStart) { 
        const syntheticEvent = {
          dataTransfer: { setData: () => {}, effectAllowed: 'move' },
        } as unknown as React.DragEvent<HTMLDivElement>; 
        onDragStart(syntheticEvent, task);
      }
    }
    
    if (isTouchDragging) {
      e.preventDefault(); 
      setDragOffset({ x: deltaX, y: deltaY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    document.body.classList.remove('dragging-active');
    document.body.classList.remove('mobile-drag-active');

    if (!isTouchDragging || !touchStartPos || isUpdating) {
      setTouchStartPos(null);
      setIsTouchDragging(false);
      setDragOffset({ x: 0, y: 0 });
      if (onDragEnd && !isTouchDragging && touchStartPos) { 
          const syntheticEvent = {} as React.DragEvent<HTMLDivElement>;
          onDragEnd(syntheticEvent);
      }
      return;
    }
    
    const touch = e.changedTouches[0];
    const draggedElement = e.currentTarget;
    let dropZoneElement: HTMLElement | null = null;

    draggedElement.style.pointerEvents = 'none'; 
    let elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    draggedElement.style.pointerEvents = ''; 

    if (elementBelow) {
        dropZoneElement = elementBelow.closest('[data-drop-zone="true"]') as HTMLElement | null;
    }

    if (!dropZoneElement) {
        const allDropZones = document.querySelectorAll<HTMLElement>('[data-drop-zone="true"]');
        for (let i = 0; i < allDropZones.length; i++) {
            const zone = allDropZones[i];
            const rect = zone.getBoundingClientRect();
            if (
                touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom
            ) {
                dropZoneElement = zone;
                break; 
            }
        }
    }

    if (dropZoneElement && taskDropCtx) {
      const targetStatus = dropZoneElement.getAttribute('data-target-status') as TaskStatus | null;
      if (targetStatus && targetStatus !== task.status) {
        taskDropCtx.performMobileDrop(task.id, targetStatus, task.status)
          .catch(err => console.error("Error during mobile drop context call:", err));
      }
    }
    
    setTouchStartPos(null);
    setIsTouchDragging(false);
    setDragOffset({ x: 0, y: 0 });
    
    if (onDragEnd) {
      const syntheticEvent = {} as React.DragEvent<HTMLDivElement>;
      onDragEnd(syntheticEvent); 
    }
  };

  const handleQuickStatusChange = async (newStatus: TaskStatus) => {
    if (onUpdateTask && task.status !== newStatus) {
      setIsUpdating(true);
      try {
        const updates: Partial<Task> = { 
          status: newStatus,
          ...(newStatus === TaskStatus.COMPLETED && { completedAt: new Date().toISOString() }),
          ...(newStatus !== TaskStatus.COMPLETED && task.status === TaskStatus.COMPLETED && { completedAt: undefined })
        };
        await onUpdateTask(task.id, updates);
      } catch (error) {
        console.error('Failed to update task status via quick change:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const cardIsEffectivelyDragging = isParentDragging || isTouchDragging;

  let assignmentText = null;
  if (currentUser && task.assignedTo === currentUser.id && task.assignedBy && task.assignedBy !== currentUser.id && task.assignerName) {
    assignmentText = `From: ${task.assignerName}`;
  } else if (currentUser && task.assignedBy === currentUser.id && task.assignedTo && task.assignedTo !== currentUser.id && task.assigneeName) {
    assignmentText = `To: ${task.assigneeName}`;
  }

  const handleCardClick = () => {
    if (onEdit) {
      onEdit(task);
    } else if (onClick) {
      onClick(task);
    }
  };
  
  const hasActions = onUpdateTask || (canDelete && onDelete);

  return (
    <div
      draggable={!isUpdating && !isTouchDragging && onDragStart !== undefined}
      onDragStart={onDragStart ? handleDragStartInternal : undefined}
      onDragEnd={onDragStart ? handleDragEndInternal : undefined}
      onTouchStart={onDragStart ? handleTouchStart : undefined}
      onTouchMove={onDragStart ? handleTouchMove : undefined}
      onTouchEnd={onDragStart ? handleTouchEnd : undefined}
      className={`mb-2.5 ${isCompleted ? 'opacity-70' : ''} ${
        cardIsEffectivelyDragging ? 'opacity-50 transform rotate-1 scale-105 shadow-2xl z-50' : ''
      } ${isUpdating ? 'opacity-75 cursor-wait' : (onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')} transition-all duration-150 ease-in-out ${isTouchDragging ? 'mobile-drag-item' : ''}`}
      style={isTouchDragging ? {
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(1deg) scale(1.05)`,
        position: 'relative',
        zIndex: 50 
      } : {}}
      role="listitem"
      aria-label={`Task: ${task.title}, Status: ${task.status}`}
    >
      <Card 
        className={`border-l-4 ${priorityStyle.border} hover:shadow-lg ${isUpdating ? 'ring-2 ring-primary-light dark:ring-primary-dark' : ''} !p-3`} 
        onClick={handleCardClick}
      >
        <div className="flex justify-between items-start mb-1.5">
          <h4 className={`text-sm font-semibold ${isCompleted ? 'line-through text-muted dark:text-muted-dark' : 'text-text dark:text-text-dark'} line-clamp-2`}>
            {task.title}
          </h4>
          {hasActions && (
            <div className="relative group flex-shrink-0">
              <button 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -m-1"
                onClick={(e) => { e.stopPropagation(); }}
                aria-label="Task options"
                aria-haspopup="true"
              >
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
              <div className="absolute top-full right-0 mt-1 hidden group-hover:flex flex-col items-center bg-card dark:bg-card-dark border dark:border-border-dark rounded-md shadow-lg z-30 p-0.5 min-w-[100px]">
                {onUpdateTask && Object.values(TaskStatus).filter(s => s !== task.status).map(s => (
                  <button 
                    key={s} 
                    onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(s);}}
                    disabled={isUpdating}
                    className="w-full text-left px-2 py-0.5 text-[11px] text-text dark:text-text-dark hover:bg-surface dark:hover:bg-surface-dark rounded disabled:opacity-50"
                  >
                    Move to {s}
                  </button>
                ))}
                {onUpdateTask && onDelete && <div className="w-full h-px bg-border dark:border-border-dark my-0.5"></div>}
                {canDelete && onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    disabled={isUpdating}
                    className="w-full text-left px-2 py-0.5 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/20 rounded disabled:opacity-50"
                  >
                    Delete Task
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
                
        <p className="text-xs text-muted dark:text-muted-dark mb-1.5">
          Due: <span className="font-semibold text-text/90 dark:text-text-dark/90">{new Date(task.dueDate).toLocaleDateString()}</span>
        </p>
        
        {assignmentText && (
          <p className="text-xs text-muted dark:text-muted-dark mb-1.5 truncate">
            {assignmentText.startsWith('From:') ? 'From: ' : 'To: '}
            <span className="font-semibold text-text/90 dark:text-text-dark/90">
              {assignmentText.substring(assignmentText.indexOf(':') + 2)}
            </span>
          </p>
        )}
        
        {task.tags && task.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {task.tags.slice(0, 2).map((tag, index) => ( 
              <span
                key={index}
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${TAG_COLORS[index % TAG_COLORS.length]}`}
              >
                {tag}
              </span>
            ))}
             {task.tags.length > 2 && (
                <span className="text-[10px] text-muted dark:text-muted-dark px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                    +{task.tags.length - 2}
                </span>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-1.5 text-muted dark:text-muted-dark">
            {task.description && task.description.length > 10 && <ChatBubbleLeftIcon className="w-3.5 h-3.5" title="Has description"/>}
          </div>
        </div>
      </Card>
    </div>
  );
};


interface TaskInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateStatus?: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskInfoModal: React.FC<TaskInfoModalProps> = ({ isOpen, onClose, task, onEdit, onDelete, onUpdateStatus }) => {
  if (!task) return null;

  const priorityStyle = task.priority ? PRIORITY_STYLES[task.priority] : { border: 'border-gray-300 dark:border-gray-500' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Details" size="md" showSaveButton={false}>
        <div className={`p-1 mb-4 border-l-4 ${priorityStyle.border} rounded-r-md`}>
            <h3 className="text-xl font-semibold text-text dark:text-text-dark mb-1 ml-2">{task.title}</h3>
        </div>
      
      <div className="space-y-3 text-sm">
        {task.description && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Description:</p>
            <p className="text-text dark:text-text-dark whitespace-pre-wrap">{task.description}</p>
          </div>
        )}
        <div>
          <p className="font-medium text-muted dark:text-muted-dark">Due Date:</p>
          <p className="font-semibold text-text dark:text-text-dark">{new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
            <div>
                <p className="font-medium text-muted dark:text-muted-dark">Status:</p>
                <p className="font-semibold text-text dark:text-text-dark">{task.status}</p>
            </div>
            <div>
                <p className="font-medium text-muted dark:text-muted-dark">Priority:</p>
                <p className={`capitalize font-semibold text-text dark:text-text-dark`}>{task.priority || 'Not set'}</p>
            </div>
        </div>
        
        {task.tags && task.tags.length > 0 && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Tags:</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {task.tags.map((tag, index) => (
                <span key={index} className={`px-2 py-0.5 text-xs rounded-full ${TAG_COLORS[index % TAG_COLORS.length]}`}>{tag}</span>
              ))}
            </div>
          </div>
        )}
        
        {task.project && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Project:</p>
            <p className="font-semibold text-text dark:text-text-dark">{task.project}</p>
          </div>
        )}
        
        {task.assignerName && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Assigned By:</p>
            <p className="font-semibold text-text dark:text-text-dark">{task.assignerName}</p>
          </div>
        )}
        {task.assigneeName && task.assigneeName !== task.assignerName && (
          <div>
            <p className="font-medium text-muted dark:text-muted-dark">Assigned To:</p>
            <p className="font-semibold text-text dark:text-text-dark">{task.assigneeName}</p>
          </div>
        )}

        {task.completedAt && (
             <div>
                <p className="font-medium text-muted dark:text-muted-dark">Completed At:</p>
                <p className="font-semibold text-text dark:text-text-dark">{new Date(task.completedAt).toLocaleString()}</p>
            </div>
        )}
      </div>
      
      <div className="mt-6 flex justify-end space-x-3">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={() => onEdit(task)} leftIcon={<EditIcon className="w-4 h-4"/>}>Edit</Button>
        <Button variant="danger" onClick={() => onDelete(task.id)} leftIcon={<Trash2Icon className="w-4 h-4"/>}>Delete</Button>
      </div>
    </Modal>
  );
};


interface DropZoneProps {
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => void;
  targetStatus: TaskStatus;
  children: ReactNode;
  className?: string;
  title?: string;
  isLoading?: boolean; 
  taskCount?: number; 
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  onDrop, 
  targetStatus, 
  children, 
  className = '',
  title,
  isLoading = false, 
  taskCount = 0,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false); 
  const [dropErrorMessage, setDropErrorMessage] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    setDropErrorMessage(null);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
      setIsDragOver(false);
      setDropErrorMessage(null);
    }
  };
  

  const handleDropInternal = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsProcessingDrop(true); 
    setDropErrorMessage(null);
    
    try {
      const dragDataString = e.dataTransfer.getData('application/json');
      if (!dragDataString) {
        setIsProcessingDrop(false);
        return;
      }
      const { taskId, sourceStatus } = JSON.parse(dragDataString);
      
      if (taskId && sourceStatus !== targetStatus) {
        await onDrop(e, targetStatus); 
      } else if (sourceStatus === targetStatus) {
        setDropErrorMessage('Task is already in this status');
        setTimeout(() => setDropErrorMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      setDropErrorMessage('Failed to move task. Please try again.');
      setTimeout(() => setDropErrorMessage(null), 3000);
    } finally {
      setIsProcessingDrop(false); 
    }
  };

  const showDropEffect = isDragOver && !isProcessingDrop && !isLoading;
  const showProcessingIndicator = isProcessingDrop || isLoading;

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDropInternal}
      data-drop-zone="true" 
      data-target-status={targetStatus} 
      className={`
        relative min-h-[200px] p-3 rounded-lg transition-all duration-150 ease-in-out flex flex-col
        ${className} 
        ${showDropEffect ? 'bg-primary-light/20 dark:bg-primary-dark/30 border-2 border-dashed border-primary dark:border-primary-light' : 'border border-gray-200 dark:border-border-dark'}
        ${showProcessingIndicator ? 'opacity-70 cursor-wait' : ''}
      `}
      style={{ zIndex: isDragOver ? 10 : 1, position: 'relative' }} 
      aria-label={`Drop zone for ${title} tasks`}
    >
      {title && (
        <div className="flex justify-between items-center mb-3 px-1 flex-shrink-0">
            <h3 className="font-semibold text-text dark:text-text-dark">{title}</h3>
            <span className="text-sm text-muted dark:text-muted-dark bg-gray-200 dark:bg-gray-700/80 px-2 py-0.5 rounded-full">
                {taskCount}
            </span>
        </div>
      )}
      
      <div className="flex-grow overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {children}
         {React.Children.count(children) === 0 && !showProcessingIndicator && (
             <div className="flex flex-col items-center justify-center h-full text-muted dark:text-muted-dark p-4 text-center">
                <EyeIcon className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No tasks here yet.</p>
            </div>
         )}
      </div>
      
      {showDropEffect && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary-light/30 dark:bg-primary-dark/40 rounded-lg pointer-events-none border-2 border-dashed border-primary dark:border-primary-light">
          <p className="text-primary dark:text-primary-light font-semibold">Drop here</p>
        </div>
      )}
      
      {showProcessingIndicator && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/70 dark:bg-card-dark/70 rounded-lg pointer-events-none">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      
      {dropErrorMessage && (
        <div className="absolute bottom-2 left-2 right-2 p-2 bg-red-100 text-red-700 dark:bg-red-800/80 dark:text-red-200 text-xs rounded shadow-md z-10">
            {dropErrorMessage}
        </div>
      )}
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl'; // Added 4xl
  onSave?: () => Promise<void> | void;
  saveLabel?: string;
  isSaving?: boolean;
  showSaveButton?: boolean;
  saveDisabled?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
  preventCloseOnSave?: boolean;
  saveButtonText?: string;
  saveButtonVariant?: ButtonProps['variant'];
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  onSave,
  saveLabel = 'Save Changes',
  isSaving: parentIsSaving = false,
  showSaveButton = !!onSave,
  saveDisabled: parentSaveDisabled = false,
  onSaveSuccess,
  onSaveError,
  preventCloseOnSave = false,
  saveButtonText,
  saveButtonVariant
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [localIsSaving, setLocalIsSaving] = useState(false);

  const effectiveIsSaving = parentIsSaving || localIsSaving;
  const effectiveSaveDisabled = parentSaveDisabled || effectiveIsSaving;

  const handleClose = useCallback(() => {
    if (effectiveIsSaving) return; 
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150); 
  }, [effectiveIsSaving, onClose]);

  const handleSave = async () => {
    if (!onSave || effectiveIsSaving || effectiveSaveDisabled) return;
    
    setLocalIsSaving(true);
    try {
      await onSave();
      if (onSaveSuccess) onSaveSuccess();
      if (!preventCloseOnSave) {
        handleClose();
      }
    } catch (err) {
      console.error("Error in modal save:", err);
      if (onSaveError && err instanceof Error) {
        onSaveError(err);
      }
    } finally {
      setLocalIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  if (!isOpen && !isClosing) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ease-in-out ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true"></div>
      <div
        className={`relative bg-card dark:bg-card-dark rounded-xl shadow-2xl m-4 p-6 w-full ${sizeClasses[size]} transition-transform duration-150 ease-out ${isOpen && !isClosing ? 'scale-100' : 'scale-95'}`}
        onClick={e => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="modal-title" className="text-lg font-semibold text-text dark:text-text-dark">{title}</h3>
          <button onClick={handleClose} className="text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark p-1 -m-1 rounded-full focus:outline-none focus:ring-2 focus:ring-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {children}
        </div>

        {showSaveButton && onSave && (
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={handleClose} disabled={effectiveIsSaving}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              loading={effectiveIsSaving} 
              disabled={effectiveSaveDisabled}
              variant={saveButtonVariant || 'primary'}
            >
              {saveButtonText || saveLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};


export const useDragAndDrop = (
  onDropUpdate: (taskId: string, newStatus: TaskStatus, oldStatus?: TaskStatus) => Promise<void>,
  onDragVisualStart?: (task: Task) => void,
  onDropError?: (error: Error, taskId: string) => void
) => {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    if (onDragVisualStart) {
      onDragVisualStart(task);
    }
    if (e.dataTransfer && typeof e.dataTransfer.setData === 'function') {
      e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, sourceStatus: task.status, taskData: task }));
      e.dataTransfer.effectAllowed = 'move';
    }
  };
  
  const handleDragEnd = () => { 
    setDraggedTask(null);
  };


  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask) return;

    const taskId = draggedTask.id;
    const oldStatus = draggedTask.status;

    if (oldStatus === targetStatus) {
      setDraggedTask(null); 
      return;
    }

    setIsUpdating(prev => ({ ...prev, [taskId]: true }));
    try {
      await onDropUpdate(taskId, targetStatus, oldStatus);
    } catch (error: any) {
      if (onDropError) {
        onDropError(error, taskId);
      } else {
        console.error(`Error updating task ${taskId} after drop:`, error);
      }
    } finally {
      setIsUpdating(prev => ({ ...prev, [taskId]: false }));
      setDraggedTask(null);
    }
  };

  const isTaskUpdating = (taskId: string) => !!isUpdating[taskId];

  return { draggedTask, handleDragStart, handleDrop, handleDragEnd, isTaskUpdating };
};

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  id,
  name,
  disabled = false,
  className = '',
  description,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  return (
    <label htmlFor={id} className={`flex items-start cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="flex items-center h-5">
        <input
          id={id}
          name={name}
          type="checkbox"
          className="sr-only" 
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-checked={checked}
          aria-describedby={description ? `${id}-description` : undefined}
        />
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150
                      ${checked 
                        ? 'bg-primary border-primary dark:bg-primary-dark dark:border-primary-dark' 
                        : 'bg-transparent border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500'
                      }`}
          role="checkbox"
          aria-hidden="true" 
        >
          {checked && (
            <GlobalCheckIcon className="w-3 h-3 text-white" />
          )}
        </span>
      </div>
      {(label || description) && (
        <div className="ml-3 text-sm">
          {label && <span className="font-medium text-text dark:text-text-dark">{label}</span>}
          {description && <p id={`${id}-description`} className="text-xs text-muted dark:text-muted-dark">{description}</p>}
        </div>
      )}
    </label>
  );
};


interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  name,
  size = 'md',
  className = ''
}) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const sizeClasses = {
    sm: { track: 'w-9 h-5', thumb: 'w-3.5 h-3.5', checkedTranslate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-4 h-4', checkedTranslate: 'translate-x-5' },
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      name={name}
      onClick={handleToggle}
      disabled={disabled}
      className={`relative inline-flex items-center ${sizeClasses[size].track} rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-background-dark focus:ring-primary
                  ${checked ? 'bg-primary dark:bg-primary-dark' : 'bg-gray-300 dark:bg-gray-600'}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span
        className={`inline-block ${sizeClasses[size].thumb} bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out
                    ${checked ? sizeClasses[size].checkedTranslate : 'translate-x-0.5'}`}
      />
    </button>
  );
};

interface FloatingActionButtonProps {
    onClick: () => void;
    icon: ReactNode;
    tooltip?: string;
    className?: string;
}
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, icon, tooltip, className }) => (
    <button
        onClick={onClick}
        className={`fixed bottom-8 right-8 bg-primary hover:bg-primary-dark text-white rounded-full p-4 shadow-lg transition-transform duration-150 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-light ${className}`}
        aria-label={tooltip || "Floating Action Button"}
        title={tooltip}
    >
        {icon}
    </button>
);

interface SearchResultsDropdownProps {
  results: GlobalSearchResults | null;
  isLoading: boolean;
  onClose: () => void;
  onNavigate: (path: string, state?: any) => void;
  className?: string;
}

export const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({ results, isLoading, onClose, onNavigate, className = '' }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const renderCategory = (title: string, items: GlobalSearchResultItem[], defaultIcon: React.FC<{ className?: string }> = DocumentTextIcon) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={title}>
        <h4 className="text-xs font-semibold uppercase text-muted dark:text-muted-dark px-4 pt-3 pb-1">{title}</h4>
        <ul className="divide-y divide-border dark:divide-border-dark">
          {items.map(item => {
            const ItemIcon = item.icon || defaultIcon;
            return (
              <li key={`${item.type}-${item.id}`} 
                  onClick={() => onNavigate(item.path, item.state)}
                  className="px-4 py-2.5 hover:bg-surface dark:hover:bg-surface-dark cursor-pointer flex items-center space-x-3"
              >
                <ItemIcon className="w-5 h-5 text-primary dark:text-primary-light flex-shrink-0"/>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text dark:text-text-dark truncate">{item.title}</p>
                  {item.description && <p className="text-xs text-muted dark:text-muted-dark truncate">{item.description}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const noResultsFound = !results || 
    (results.tasks.length === 0 && 
     results.projects.length === 0 && 
     results.notes.length === 0 &&
     results.teams.length === 0 &&
     results.resources.length === 0 &&
     results.users.length === 0 &&
     results.calendarEvents.length === 0
    );

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-1.5 w-full max-w-lg bg-card dark:bg-card-dark rounded-lg shadow-xl border border-border dark:border-border-dark overflow-hidden z-50 ${className}`}
    >
      {isLoading && (
        <div className="p-6 text-center text-muted dark:text-muted-dark">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2"></div>
          Searching...
        </div>
      )}
      {!isLoading && noResultsFound && (
        <div className="p-6 text-center text-muted dark:text-muted-dark">
            <GlobalSearchIcon className="w-8 h-8 mx-auto mb-2 opacity-50"/>
            <p className="text-sm">No results found.</p>
            <p className="text-xs">Try a different search term.</p>
        </div>
      )}
      {!isLoading && !noResultsFound && results && (
        <div className="max-h-[60vh] overflow-y-auto">
          {renderCategory('Tasks', results.tasks, EditIcon)}
          {renderCategory('Projects', results.projects, BriefcaseIcon)}
          {renderCategory('Notes', results.notes, DocumentTextIcon)}
          {renderCategory('Teams', results.teams, TeamIcon)}
          {renderCategory('Resources', results.resources, FolderIcon)}
          {renderCategory('Users', results.users, UserCircleIcon)}
          {renderCategory('Calendar Events', results.calendarEvents, CalendarDaysIcon)}
        </div>
      )}
      <div className="p-2 bg-surface dark:bg-surface-dark/50 border-t border-border dark:border-border-dark text-right">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">Close</Button>
      </div>
    </div>
  );
};
