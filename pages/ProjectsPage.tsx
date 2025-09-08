import React, { useState, useMemo, useEffect, useCallback, FormEvent } from 'react';
import { Card, ProgressBar, Button, Modal, TaskCard as GlobalTaskCard, Checkbox } from '../components'; // Added Checkbox
import { Task, Project as ProjectType, User as FrontendUser, TaskPriority, TaskStatus, UserPublicProfile, UserRole, TeamType as AppTeamType, UserSearchResult, ProjectUpdate, ProjectResource, ProjectMetrics, ConnectedUser, ProjectMember, TeamMember } from '../types'; // Added TeamMember
import { PlusIcon, BriefcaseIcon, CalendarDaysIcon, UsersIcon as MembersIcon, CogIcon as SettingsIcon, Trash2Icon, UserPlusIcon, XMarkIcon, PRIORITY_STYLES, EllipsisHorizontalIcon as OptionsIcon, EyeIcon, ArrowLeftIcon, TASK_EVENT_COLOR, ChatBubbleLeftIcon, DocumentIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, FolderIcon, LinkIcon, PaperClipIcon, BellIcon, StarIcon, FilterIcon, MagnifyingGlassIcon, ArrowDownTrayIcon, ShareIcon, VideoCameraIcon, CalendarIcon, ChartBarIcon, ClipboardDocumentListIcon } from '../constants';
import { projectService } from '../projectService';
import { taskService } from '../taskService';
import { connectService } from '../connectService';
import { calendarService } from '../calendarService';
import { teamService } from '../teamService'; // Added teamService

// =============================================
// CHANGES TO MAKE TO YOUR EXISTING PROJECTS PAGE
// =============================================

// 1. ADD THESE TO YOUR EXISTING IMPORTS
import { Building2Icon } from '../constants';
import { DepartmentType, DepartmentMemberRole } from '../types';

// 2. ADD THESE INTERFACE DEFINITIONS (after your existing imports)
interface ProjectScope {
  type: 'individual' | 'department' | 'team' | 'cross_department';
  teamId?: string;
  departmentIds?: string[];
  visibility: 'private' | 'team_visible' | 'department_visible' | 'public';
}

interface EnhancedProject extends ProjectType {
  scope?: ProjectScope;
  assignedDepartments?: Array<{
    id: string;
    name: string;
  }>;
  teamInfo?: {
    teamId: string;
    teamName: string;
  };
}


// ... (All sub-components like TaskFormModal, ProjectActivityFeed, etc., remain the same)

interface TaskFormDialogState {
  title: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  tags?: string;
  projectId?: string;
  assigneeId?: string;
  dependencies?: string[];
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  onSave: (taskData: Partial<Task> & { assigneeId?: string }) => Promise<void>;
  initialProjectId?: string;
  availableProjects: ProjectType[];
  currentUser: FrontendUser | null;
  availableConnections: ConnectedUser[];
  isLoadingConnections: boolean;
  availableTasks?: Task[];
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen, onClose, taskToEdit, onSave, initialProjectId, availableProjects, currentUser, availableConnections, isLoadingConnections, availableTasks = []
}) => {
  const [formState, setFormState] = useState<TaskFormDialogState>({
    title: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TODO,
    description: '',
    tags: '',
    projectId: initialProjectId || '',
    assigneeId: currentUser?.id || '',
    dependencies: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'assignment'>('basic');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        setActiveTab('basic'); // Reset to first tab when modal opens
        setErrorMessage(null); // Clear any previous errors
        if (taskToEdit) {
            setFormState({
                title: taskToEdit.title,
                dueDate: taskToEdit.dueDate,
                priority: taskToEdit.priority || TaskPriority.MEDIUM,
                status: taskToEdit.status,
                description: taskToEdit.description || '',
                tags: taskToEdit.tags ? taskToEdit.tags.join(', ') : '',
                projectId: taskToEdit.projectId || initialProjectId || '',
                assigneeId: taskToEdit.assignedTo || currentUser?.id || '',
                dependencies: taskToEdit.dependencies || [],
            });
        } else {
            setFormState({
                title: '',
                dueDate: new Date().toISOString().split('T')[0],
                priority: TaskPriority.MEDIUM,
                status: TaskStatus.TODO,
                description: '',
                tags: '',
                projectId: initialProjectId || (availableProjects.length > 0 ? availableProjects[0].id : ''),
                assigneeId: currentUser?.id || '',
                dependencies: [],
            });
        }
    }
  }, [isOpen, taskToEdit, initialProjectId, currentUser, availableProjects]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumberInput = type === 'number';

    // Clear error when user makes changes
    if (errorMessage) {
      setErrorMessage(null);
    }

    if (name === 'priority') {
      setFormState(prev => ({ ...prev, priority: value as TaskPriority }));
    } else if (name === 'status') {
      let progressUpdate = {};
      if (value === TaskStatus.COMPLETED) progressUpdate = { progress: 100 };
      else if (value === TaskStatus.TODO) progressUpdate = { progress: 0 };
      setFormState(prev => ({ ...prev, status: value as TaskStatus, ...progressUpdate }));
    } else {
      setFormState(prev => ({ ...prev, [name]: isNumberInput && value !== '' ? parseInt(value, 10) : value }));
    }
  };

  const handleDependencyChange = (taskId: string, checked: boolean) => {
    // Clear error when user makes changes
    if (errorMessage) {
      setErrorMessage(null);
    }
    
    setFormState(prev => ({
      ...prev,
      dependencies: checked
        ? [...(prev.dependencies || []), taskId]
        : (prev.dependencies || []).filter(id => id !== taskId)
    }));
  };

  const handleFormSubmitLogic = async () => {
    setIsSaving(true);
    setErrorMessage(null); // Clear any previous errors
    
    const tagsArray = formState.tags ? formState.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const payload = {
      ...formState,
      tags: tagsArray,
      assigneeId: formState.assigneeId || currentUser?.id,
      dependencies: formState.dependencies || [],
    };
    
    try {
        await onSave(payload);
        // If successful, the modal will close from the parent component
    } catch (error: any) {
        // Instead of showing alert, display error in the modal
        const errorMsg = error.message || 'Failed to save task';
        setErrorMessage(errorMsg);
        console.error('Error saving task:', error);
    } finally {
        setIsSaving(false);
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
      return formState.title.trim() !== '';
    }
    return true;
  };

  const availableTasksForDependencies = availableTasks.filter(task =>
    task.id !== taskToEdit?.id && task.projectId === formState.projectId
  );

  const tabs = [
    { id: 'basic', label: 'Basics', icon: '📝' },
    { id: 'details', label: 'Details', icon: '📋' },
    { id: 'assignment', label: 'Assignment', icon: '👥' }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={taskToEdit ? "Edit Task" : "Create New Task"} size="lg" showSaveButton={false}>
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

        <div className="flex justify-center border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[350px]">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-text dark:text-text-dark mb-2">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" name="title" id="title" value={formState.title} onChange={handleChange} 
                  className="input-style" placeholder="e.g., Review project proposal" required 
                />
              </div>

              <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Due Date</label>
                  <input type="date" name="dueDate" id="dueDate" value={formState.dueDate} onChange={handleChange} className="input-style" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">Priority</label>
                <div className="flex space-x-3">
                  {[
                    { value: TaskPriority.LOW, label: 'Low', color: 'green' },
                    { value: TaskPriority.MEDIUM, label: 'Medium', color: 'yellow' },
                    { value: TaskPriority.HIGH, label: 'High', color: 'red' }
                  ].map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, priority: priority.value }))}
                      className={`flex-1 p-3 rounded-lg border transition-all ${
                        formState.priority === priority.value
                          ? priority.color === 'green'
                            ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-200'
                            : priority.color === 'yellow'
                            ? 'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-400 dark:text-yellow-200'
                            : 'bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-200'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-medium">{priority.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Status</label>
                <select name="status" id="status" value={formState.status} onChange={handleChange} className="input-style">
                  {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <label htmlFor="taskFormDescription" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Description</label>
                <textarea name="description" id="taskFormDescription" value={formState.description} onChange={handleChange} rows={4} className="input-style" placeholder="Describe the task in detail..."></textarea>
              </div>

              <div>
                <label htmlFor="taskFormTags" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Tags</label>
                <input type="text" name="tags" id="taskFormTags" value={formState.tags} onChange={handleChange} className="input-style" placeholder="e.g., frontend, urgent, bug-fix" />
                <p className="text-xs text-muted dark:text-muted-dark mt-1">Separate tags with commas</p>
              </div>
              
              {availableTasksForDependencies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-text dark:text-text-dark mb-2">Dependencies</label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1 bg-gray-50 dark:bg-gray-700/30">
                    {availableTasksForDependencies.map(task => (
                      <label key={task.id} className="flex items-center space-x-2 text-sm py-1 px-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600/50">
                        <input type="checkbox" checked={(formState.dependencies || []).includes(task.id)} onChange={(e) => handleDependencyChange(task.id, e.target.checked)} className="rounded border-gray-300 dark:border-gray-500 text-primary focus:ring-primary"/>
                        <span className="truncate text-text dark:text-text-dark">{task.title}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted dark:text-muted-dark mt-1">Select tasks that must be completed before this one</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assignment' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Who's responsible?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Assign this task to yourself or someone else</p>
              </div>

              <div>
                <label htmlFor="taskFormAssigneeId" className="block text-sm font-medium text-text dark:text-text-dark mb-2">Assign To</label>
                <select name="assigneeId" id="taskFormAssigneeId" value={formState.assigneeId} onChange={handleChange} className="input-style" disabled={isLoadingConnections}>
                    <option value={currentUser?.id || ''}>👤 Assign to Myself</option>
                    {availableConnections.map(conn => <option key={conn.id} value={conn.id}>👥 {(conn.full_name || conn.email.split('@')[0] || 'User')} ({conn.email})</option>)}
                </select>
                {isLoadingConnections && <p className="text-xs text-muted dark:text-muted-dark mt-1">Loading connections...</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
                type="button"
                onClick={handlePrevTab}
                disabled={activeTab === 'basic'}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'basic'
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
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
                        : 'bg-gray-300 dark:bg-gray-600'
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
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                >
                Next →
                </button>
            ) : (
                <button
                type="button"
                onClick={handleFormSubmitLogic}
                disabled={isSaving || !canProceedToNext()}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                    canProceedToNext() && !isSaving
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                >
                {isSaving ? 'Saving...' : taskToEdit ? 'Update Task' : 'Create Task'}
                </button>
            )}
        </div>
      </div>
    </Modal>
  );
};

interface ProjectActivityFeedProps {
  projectId: string;
  updates: ProjectUpdate[];
  onAddUpdate: (content: string, type: ProjectUpdate['type'], relatedTaskId?: string, relatedTaskTitle?: string) => Promise<void>;
  isLoading: boolean;
}

const ProjectActivityFeed: React.FC<ProjectActivityFeedProps> = ({ projectId, updates, onAddUpdate, isLoading }) => {
  const [newUpdate, setNewUpdate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUpdate.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddUpdate(newUpdate, 'general');
      setNewUpdate('');
    } catch (error) {
      console.error('Error adding update:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUpdateIcon = (type: ProjectUpdate['type']) => {
    switch (type) {
      case 'milestone': return <StarIcon className="w-4 h-4 text-yellow-500" />;
      case 'task_completion': return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'member_added': return <UserPlusIcon className="w-4 h-4 text-blue-500" />;
      case 'file_shared': return <DocumentIcon className="w-4 h-4 text-purple-500" />;
      default: return <ChatBubbleLeftIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmitUpdate} className="space-y-3">
        <textarea
          value={newUpdate}
          onChange={(e) => setNewUpdate(e.target.value)}
          placeholder="Share an update with your team..."
          className="input-style resize-none"
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} size="sm" disabled={!newUpdate.trim() || isSubmitting}>
            Post Update
          </Button>
        </div>
      </form>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {isLoading ? (
          <div className="text-center py-4 text-muted dark:text-muted-dark">Loading updates...</div>
        ) : updates.length === 0 ? (
          <div className="text-center py-8 text-muted dark:text-muted-dark">
            <ChatBubbleLeftIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No updates yet. Be the first to share!
          </div>
        ) : (
          updates.map(update => (
            <div key={update.id} className="flex space-x-3 p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50">
              <img
                src={update.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(update.authorName)}&background=random`}
                alt={update.authorName}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {getUpdateIcon(update.type)}
                  <span className="text-sm font-medium text-text dark:text-text-dark">{update.authorName}</span>
                  <span className="text-xs text-muted dark:text-muted-dark">
                    {new Date(update.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})} at {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-text dark:text-text-dark whitespace-pre-wrap">{update.content}</p>
                {update.relatedTaskTitle && (
                  <div className="mt-1 text-xs text-muted dark:text-muted-dark">
                    Related to task: <span className="font-medium">{update.relatedTaskTitle}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface ProjectResourcesProps {
  projectId: string;
  resources: ProjectResource[];
  onAddResource: (resourceData: {
    name: string;
    type: ProjectResource['type'];
    file?: File;
    url?: string;
    description?: string;
  }) => Promise<void>;
  onDeleteResource: (projectResourceId: string) => Promise<void>;
  canManage: boolean;
  canContribute: boolean;
  currentUserId: string;
  isLoading: boolean;
}

const ProjectResources: React.FC<ProjectResourcesProps> = ({
  projectId, resources, onAddResource, onDeleteResource, canManage, canContribute, currentUserId, isLoading
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResourceData, setNewResourceData] = useState<{
    name: string;
    type: ProjectResource['type'];
    url?: string;
    file?: File;
    description?: string;
  }>({ name: '', type: 'link', url: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewResourceData(prev => ({ ...prev, file: event.target.files![0], name: event.target.files![0].name }));
    }
  };

  const handleSubmitResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!newResourceData.name) { alert("Resource name is required."); return; }
    if (newResourceData.type === 'link' && !newResourceData.url?.trim()) { alert("URL is required for link type."); return; }
    if ((newResourceData.type === 'file' || newResourceData.type === 'document') && !newResourceData.file) { alert("File is required for file/document type."); return; }

    setIsSubmitting(true);
    try {
      await onAddResource({
        name: newResourceData.name,
        type: newResourceData.type,
        file: newResourceData.file,
        url: newResourceData.url,
        description: newResourceData.description,
      });
      setNewResourceData({ name: '', type: 'link', url: '', description: '', file: undefined });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding resource:', error);
      alert(`Error: ${ (error as Error).message }`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResourceIcon = (type: ProjectResource['type']) => {
    switch (type) {
      case 'file': return <DocumentIcon className="w-5 h-5 text-blue-500" />;
      case 'link': return <LinkIcon className="w-5 h-5 text-green-500" />;
      case 'document': return <ClipboardDocumentListIcon className="w-5 h-5 text-purple-500" />;
      default: return <FolderIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {canContribute && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) {
                setNewResourceData({ name: '', type: 'link', url: '', description: '', file: undefined });
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}
            leftIcon={<PlusIcon className="w-4 h-4" />}
            size="sm"
          >
            {showAddForm ? 'Cancel' : 'Add Resource'}
          </Button>
        </div>
      )}

      {showAddForm && (
        <Card className="p-4">
          <form onSubmit={handleSubmitResource} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newResourceData.name}
                  onChange={(e) => setNewResourceData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-style"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newResourceData.type}
                  onChange={(e) => {
                    setNewResourceData(prev => ({ ...prev, type: e.target.value as ProjectResource['type'], url: '', file: undefined }));
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="input-style"
                >
                  <option value="link">Link</option>
                  <option value="file">File Upload</option>
                </select>
              </div>
            </div>

            {(newResourceData.type === 'file' || newResourceData.type === 'document') ? (
              <div>
                <label className="block text-sm font-medium mb-1">Upload File *</label>
                <input type="file" onChange={handleFileChange} ref={fileInputRef} className="input-style" required />
                {newResourceData.file && <p className="text-xs text-muted dark:text-muted-dark mt-1">Selected: {newResourceData.file.name}</p>}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">URL *</label>
                <input
                  type="url"
                  value={newResourceData.url || ''}
                  onChange={(e) => setNewResourceData(prev => ({ ...prev, url: e.target.value }))}
                  className="input-style"
                  placeholder="https://..."
                  required={newResourceData.type === 'link'}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newResourceData.description || ''}
                onChange={(e) => setNewResourceData(prev => ({ ...prev, description: e.target.value }))}
                className="input-style"
                rows={2}
                placeholder="Brief description of the resource..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Add Resource
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-center py-4 text-muted dark:text-muted-dark">Loading resources...</div>
        ) : resources.length === 0 ? (
          <div className="text-center py-8 text-muted dark:text-muted-dark">
            <FolderIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No resources shared yet.
          </div>
        ) : (
          resources.map(resource => (
            <div key={resource.id} className="flex items-center justify-between p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getResourceIcon(resource.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary dark:text-primary-light hover:underline truncate"
                      title={resource.name}
                    >
                      {resource.name}
                    </a>
                    {(resource.type === 'file' || resource.type === 'document') && (
                      <ArrowDownTrayIcon className="w-4 h-4 text-muted dark:text-muted-dark flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted dark:text-muted-dark">
                    <span>by {resource.uploadedByName}</span>
                    <span>•</span>
                    <span>{new Date(resource.uploadedAt).toLocaleDateString()}</span>
                    {resource.size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(resource.size)}</span>
                      </>
                    )}
                  </div>
                  {resource.description && (
                    <p className="text-xs text-muted dark:text-muted-dark mt-1 line-clamp-1" title={resource.description}>
                      {resource.description}
                    </p>
                  )}
                </div>
              </div>
              {(canManage || resource.uploadedBy === currentUserId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteResource(resource.id)}
                  className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                  aria-label={`Delete resource ${resource.name}`}
                >
                  <Trash2Icon className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface ProjectAnalyticsProps {
  project: ProjectType;
  tasks: Task[];
  metrics: ProjectMetrics;
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({ project, tasks, metrics }) => {
  const completionRate = metrics.totalTasks > 0 ? (metrics.completedTasks / metrics.totalTasks * 100) : 0;

  const tasksByPriority = useMemo(() => tasks.reduce((acc, task) => {
    acc[task.priority || TaskPriority.MEDIUM] = (acc[task.priority || TaskPriority.MEDIUM] || 0) + 1;
    return acc;
  }, {} as Record<TaskPriority, number>), [tasks]);

  const tasksByStatus = useMemo(() => tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>), [tasks]);

  const averageProgress = useMemo(() => tasks.length > 0 ? tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / tasks.length : 0, [tasks]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Completion Rate</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completionRate.toFixed(1)}%</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Overdue Tasks</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.overdueTasks}</p>
            </div>
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Active Members</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.activeMembers}</p>
            </div>
            <MembersIcon className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted dark:text-muted-dark">Avg Progress</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{averageProgress.toFixed(1)}%</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h4 className="text-lg font-semibold mb-4 text-text dark:text-text-dark">Tasks by Priority</h4>
          <div className="space-y-3">
            {Object.entries(tasksByPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${PRIORITY_STYLES[priority as TaskPriority]?.bg || 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium capitalize">{priority}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold">{count}</span>
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div
                      className={`h-2 rounded-full ${PRIORITY_STYLES[priority as TaskPriority]?.bg || 'bg-gray-400'}`}
                      style={{ width: metrics.totalTasks > 0 ? `${(count / metrics.totalTasks) * 100}%` : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-lg font-semibold mb-4 text-text dark:text-text-dark">Tasks by Status</h4>
          <div className="space-y-3">
            {Object.entries(tasksByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status === TaskStatus.COMPLETED ? 'bg-green-500' :
                    status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                    status === TaskStatus.BLOCKED ? 'bg-red-500' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="text-sm font-medium">{status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold">{count}</span>
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div
                      className={`h-2 rounded-full ${
                        status === TaskStatus.COMPLETED ? 'bg-green-500' :
                        status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                        status === TaskStatus.BLOCKED ? 'bg-red-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: metrics.totalTasks > 0 ? `${(count / metrics.totalTasks) * 100}%` : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="text-lg font-semibold mb-4 text-text dark:text-text-dark">Project Timeline</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Project Progress</span>
            <span>{completionRate.toFixed(1)}%</span>
          </div>
          <ProgressBar progress={completionRate} />
          <div className="flex justify-between text-xs text-muted dark:text-muted-dark">
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            {project.dueDate && <span>Due: {new Date(project.dueDate).toLocaleDateString()}</span>}
          </div>
        </div>
      </Card>
    </div>
  );
};

interface ManageProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectType;
  currentUser: FrontendUser;
  onProjectDataRefresh: () => Promise<void>;
}

const ManageProjectMembersModal: React.FC<ManageProjectMembersModalProps> = ({
  isOpen, onClose, project, currentUser, onProjectDataRefresh
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [teamMembersForSelection, setTeamMembersForSelection] = useState<TeamMember[]>([]);

  useEffect(() => {
    const fetchTeamMembersIfLinked = async () => {
      if (project.teamId) {
        setIsLoading(true);
        try {
          const teamDetails = await teamService.getTeamById(project.teamId);
          if (teamDetails) {
            const projectMemberIds = new Set(project.members.map(m => m.id));
            setTeamMembersForSelection(teamDetails.members.filter(tm => !projectMemberIds.has(tm.id)));
          }
        } catch (e) {
          console.error("Error fetching team members for project member selection:", e);
          setError("Could not load team members.");
        } finally {
          setIsLoading(false);
        }
      }
    };
    if (isOpen) {
      fetchTeamMembersIfLinked();
      setSearchTerm('');
      setSearchResults([]);
      setError(null);
    }
  }, [isOpen, project.teamId, project.members]);

  const handleSearchUsers = async (term: string) => {
    if (project.teamId || !term.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const results = await connectService.searchUsersLegacy(term);
      const projectMemberIds = new Set(project.members.map(m => m.id));
      setSearchResults(results.filter(u => !projectMemberIds.has(u.id)));
    } catch (e: any) {
      setError(e.message || "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async (userId: string, role: UserRole = UserRole.MEMBER) => {
    setIsLoading(true);
    setError(null);
    try {
      await projectService.addProjectMember(project.id, userId, role);
      await onProjectDataRefresh();
      if(project.teamId) {
         const teamDetails = await teamService.getTeamById(project.teamId);
         if(teamDetails) {
            const updatedProjectDetails = await projectService.getProjectById(project.id);
            if (updatedProjectDetails) {
                const projectMemberIds = new Set(updatedProjectDetails.members.map(m => m.id));
                setTeamMembersForSelection(teamDetails.members.filter(tm => !projectMemberIds.has(tm.id)));
            }
         }
      } else {
        setSearchTerm('');
        setSearchResults([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to add member.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === project.ownerId) {
      alert("Cannot remove the project owner.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await projectService.removeProjectMember(project.id, memberId);
      await onProjectDataRefresh();
    } catch (e: any) {
      setError(e.message || "Failed to remove member.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: UserRole) => {
     if (memberId === project.ownerId && newRole !== UserRole.OWNER) {
      alert("Project owner's role cannot be changed from Owner.");
      return;
    }
    if (memberId !== project.ownerId && newRole === UserRole.OWNER) {
      alert("Cannot make another user an Owner. Transfer ownership separately.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await projectService.updateProjectMemberRole(project.id, memberId, newRole);
      await onProjectDataRefresh();
    } catch (e:any) {
      setError(e.message || "Failed to update role.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Members for "${project.name}"`} showSaveButton={false} size="xl">
      <div className="space-y-6">
        {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded">{error}</p>}
        
        <section>
          <h4 className="text-md font-semibold mb-2 text-text dark:text-text-dark">Add New Member</h4>
          {project.teamId ? (
            <div className="space-y-2">
              <p className="text-sm text-muted dark:text-muted-dark">This project is linked to team: <strong>{project.teamName || 'Unnamed Team'}</strong>. You can add members from this team.</p>
              {isLoading && teamMembersForSelection.length === 0 && <p className="text-sm text-muted dark:text-muted-dark">Loading team members...</p>}
              {!isLoading && teamMembersForSelection.length === 0 && <p className="text-sm text-muted dark:text-muted-dark">All team members are already in this project or no other team members found.</p>}
              {teamMembersForSelection.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-surface-dark rounded-md">
                   <div className="flex items-center space-x-2">
                    <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} alt={member.full_name || undefined} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="text-sm font-medium text-text dark:text-text-dark">{member.full_name}</p>
                      <p className="text-xs text-muted dark:text-muted-dark">{member.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddMember(member.id)} loading={isLoading}>Add to Project</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); if (e.target.value.length > 1 || e.target.value.length === 0) handleSearchUsers(e.target.value); }}
                placeholder="Search users by name or email..."
                className="input-style flex-grow"
              />
              <Button onClick={() => handleSearchUsers(searchTerm)} loading={isSearching}>Search</Button>
            </div>
          )}
          {!project.teamId && searchResults.map(user => (
            <div key={user.id} className="flex items-center justify-between p-2 mt-2 bg-gray-50 dark:bg-surface-dark rounded-md">
              <div className="flex items-center space-x-2">
                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}`} alt={user.full_name || undefined} className="w-8 h-8 rounded-full" />
                <div>
                  <p className="text-sm font-medium text-text dark:text-text-dark">{user.full_name}</p>
                  <p className="text-xs text-muted dark:text-muted-dark">{user.email}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleAddMember(user.id)} loading={isLoading}>Add to Project</Button>
            </div>
          ))}
        </section>

        <section>
          <h4 className="text-md font-semibold mb-2 text-text dark:text-text-dark">Current Members ({project.members.length})</h4>
          <div className="max-h-80 overflow-y-auto space-y-2 border dark:border-border-dark rounded-md p-2">
            {project.members.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-surface-dark rounded-lg shadow-sm">
                <div className="flex items-center space-x-3">
                  <img src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'U')}`} alt={member.full_name || undefined} className="w-9 h-9 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-text dark:text-text-dark">{member.full_name}</p>
                    <p className="text-xs text-muted dark:text-muted-dark">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value as UserRole)}
                    className="input-style !text-xs !py-1 !px-2 w-auto"
                    disabled={isLoading || member.id === project.ownerId || member.id === currentUser.id && currentUser.id !== project.ownerId && member.role === UserRole.ADMIN}
                  >
                    {member.id === project.ownerId ? <option value={UserRole.OWNER}>Owner</option> : 
                     Object.values(UserRole).filter(r => r !== UserRole.OWNER && r !== UserRole.VIEWER).map(role => (
                        <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                    ))}
                  </select>
                  {member.id !== project.ownerId && (
                    <Button size="sm" variant="dangerOutline" onClick={() => handleRemoveMember(member.id)} loading={isLoading} className="p-1.5">
                      <Trash2Icon className="w-4 h-4"/>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
};

interface ProjectDetailProps {
  projectProp: ProjectType; 
  currentUser: FrontendUser | null;
  appTasksGlobal: Task[];
  setAppTasksGlobal: React.Dispatch<React.SetStateAction<Task[]>>;
  onBack: () => void;
  onProjectUpdate: (updatedProject: ProjectType) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  projectProp, currentUser, appTasksGlobal, setAppTasksGlobal, onBack, onProjectUpdate
}) => {
  const [project, setProject] = useState<ProjectType>(projectProp);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'activity' | 'resources' | 'analytics' | 'settings'>('overview');
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [isLoadingProjectSpecificTasks, setIsLoadingProjectSpecificTasks] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([]);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics>({
    totalTasks: 0, completedTasks: 0, overdueTasks: 0, upcomingDeadlines: 0, activeMembers: 0, recentActivity: 0
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [availableConnections, setAvailableConnections] = useState<ConnectedUser[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProjectConfirmationInput, setDeleteProjectConfirmationInput] = useState('');
  const [showManageMembersModal, setShowManageMembersModal] = useState(false); 
  
  const [currentUserPermissions, setCurrentUserPermissions] = useState<{ hasAccess: boolean; userRole?: UserRole }>(() => {
    if (currentUser && project) {
      const isOwner = project.ownerId === currentUser.id;
      const memberInfo = project.members?.find(m => m.id === currentUser.id);
      return { 
        hasAccess: isOwner || !!memberInfo, 
        userRole: isOwner ? UserRole.OWNER : memberInfo?.role
      };
    }
    return { hasAccess: false };
  });
  
  useEffect(() => { setProject(projectProp); }, [projectProp]);

  useEffect(() => {
    const checkAccess = async () => {
      if (currentUser && project) {
        try {
          const { hasAccess, userRole } = await projectService.checkProjectAccess(project.id, currentUser.id);
          setCurrentUserPermissions({ hasAccess, userRole });
        } catch (e) {
          console.error("Permission check failed in ProjectDetail:", e);
          if (!currentUserPermissions.hasAccess) {
            setCurrentUserPermissions({ hasAccess: false });
          }
        }
      }
    };
    checkAccess();
  }, [project.id, currentUser]);

  useEffect(() => {
    const filteredTasks = appTasksGlobal.filter(task => task.projectId === project.id);
    setProjectTasks(filteredTasks);
    setIsLoadingProjectSpecificTasks(false);
  }, [appTasksGlobal, project.id]);

  useEffect(() => {
    const loadProjectSubData = async () => {
      if (!project || !project.id || !currentUserPermissions.hasAccess) return;
      try {
        const [updates, resources, members] = await Promise.all([
          projectService.getProjectUpdates(project.id),
          projectService.getProjectResources(project.id), 
          projectService.getProjectMembers(project.id) 
        ]);
        setProjectUpdates(updates);
        setProjectResources(resources);
        setProject(prev => ({...prev, members: members})); 
      } catch (error) { console.error('Error loading project sub-data (updates/resources/members):', error); }
    };
    if (currentUserPermissions.hasAccess) {
      loadProjectSubData();
    }
  }, [project.id, currentUserPermissions.hasAccess]);

  useEffect(() => {
    const loadConnections = async () => {
      if (!currentUser) return;
      setIsLoadingConnections(true);
      try {
        const connections = await connectService.getConnections(currentUser.id);
        setAvailableConnections(connections);
      } catch (error) { console.error('Error loading connections:', error); }
      finally { setIsLoadingConnections(false); }
    };
    loadConnections();
  }, [currentUser]);

  const updateMetrics = useCallback((tasksForMetrics: Task[], currentProject: ProjectType) => {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setProjectMetrics({
      totalTasks: tasksForMetrics.length,
      completedTasks: tasksForMetrics.filter(t => t.status === TaskStatus.COMPLETED).length,
      overdueTasks: tasksForMetrics.filter(t => new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED).length,
      upcomingDeadlines: tasksForMetrics.filter(t => new Date(t.dueDate) <= oneWeekFromNow && t.status !== TaskStatus.COMPLETED).length,
      activeMembers: currentProject.members.length,
      recentActivity: projectUpdates.filter(u => new Date(u.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    });
  }, [projectUpdates]);

  useEffect(() => { updateMetrics(projectTasks, project); }, [projectTasks, project, updateMetrics]);

  const handleProjectDataRefresh = useCallback(async () => {
    if(!project?.id) return;
    const updatedProjectData = await projectService.getProjectById(project.id);
    if (updatedProjectData) {
      setProject(updatedProjectData);
      onProjectUpdate(updatedProjectData);
    }
  }, [project?.id, onProjectUpdate]);

  const handleTaskSave = async (taskData: Partial<Task> & { assigneeId?: string }) => {
    if (!currentUser) { 
        throw new Error("User not authenticated."); 
    }
  
    let savedTask: Task;
    const payload = { ...taskData, projectId: project.id, createdBy: currentUser.id, userId: currentUser.id };
  
    if (taskToEdit) {
        savedTask = await taskService.updateTask(taskToEdit.id, payload);
        setAppTasksGlobal(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
    } else {
        savedTask = await taskService.createTask(payload);
        setAppTasksGlobal(prev => [savedTask, ...prev]);
    }
  
    const updateContent = taskToEdit 
        ? `Updated task: ${savedTask.title}` 
        : `Created new task: ${savedTask.title}`;

    await handleAddUpdate({ content: updateContent, type: 'general', relatedTaskId: savedTask.id, relatedTaskTitle: savedTask.title });
    setShowTaskModal(false);
    setTaskToEdit(null);
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      const deletedTask = projectTasks.find(t => t.id === taskId);
      await taskService.deleteTask(taskId);
      setAppTasksGlobal(prev => prev.filter(t => t.id !== taskId));
      if (deletedTask) await handleAddUpdate({ content: `Deleted task: ${deletedTask.title}`, type: 'general' });
    } catch (error) { console.error('Error deleting task:', error); alert("Failed to delete task."); }
  };

  const handleAddUpdate = async (updateData: Omit<Partial<ProjectUpdate>, 'id' | 'timestamp' | 'projectId' | 'authorName' | 'authorAvatar'>) => {
    if (!currentUser) return;
    try {
      const newUpdate = await projectService.addProjectUpdate(project.id, updateData);
      setProjectUpdates(prev => [newUpdate, ...prev]);
    } catch (error) { console.error('Error adding update:', error); throw error; }
  };

  const handleAddResource = async (resourceData: { name: string; type: ProjectResource['type']; file?: File; url?: string; description?: string; }) => {
    try {
      const newResource = await projectService.addProjectListedResource(project.id, resourceData);
      setProjectResources(prev => [newResource, ...prev]);
      await handleAddUpdate({ content: `Shared resource: ${newResource.name}`, type: 'file_shared' });
    } catch (error) { console.error('Error adding resource:', error); throw error; }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      const deletedResource = projectResources.find(r => r.id === resourceId);
      await projectService.deleteProjectListedResource(project.id, resourceId);
      setProjectResources(prev => prev.filter(r => r.id !== resourceId));
      if (deletedResource) await handleAddUpdate({ content: `Removed resource: ${deletedResource.name}`, type: 'general' });
    } catch (error) { console.error('Error deleting resource:', error); alert("Failed to delete resource."); }
  };

  const handleProjectDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await projectService.deleteProject(project.id);
      onBack(); 
    } catch (error) { console.error('Error deleting project:', error); alert("Failed to delete project."); }
    finally { setIsDeleting(false); setShowDeleteModal(false); }
  };
  
  const handleInternalProjectUpdate = (updatedDbProject: ProjectType) => {
    setProject(updatedDbProject); 
    onProjectUpdate(updatedDbProject); 
  };
  
  const canContributeToProject = currentUserPermissions.hasAccess && (currentUserPermissions.userRole === UserRole.OWNER || currentUserPermissions.userRole === UserRole.ADMIN || currentUserPermissions.userRole === UserRole.MEMBER);
  const canManageProject = currentUserPermissions.userRole === UserRole.OWNER || currentUserPermissions.userRole === UserRole.ADMIN;

  if (!currentUserPermissions.hasAccess && currentUser && project.members) {
    return <div className="p-6 text-center text-red-500">Error: You do not have access to this project.</div>;
  }
  
  if (!project || !currentUser) return <p>Error: Project data or user data is missing.</p>; 

  const tabContent = {
    overview: ( <div className="space-y-6"> <div className="flex items-center justify-between"> <div> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Overview</h3> <p className="text-sm text-muted dark:text-muted-dark"> {projectTasks.length} tasks • {projectMetrics.completedTasks} completed • {projectMetrics.overdueTasks} overdue </p> </div> {canContributeToProject && <Button onClick={() => setShowTaskModal(true)} leftIcon={<PlusIcon className="w-4 h-4" />}>Add Task</Button>} </div> <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"> <Card className="p-4"><div className="flex items-center space-x-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><ClipboardDocumentListIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div><div><p className="text-sm text-muted dark:text-muted-dark">Total Tasks</p><p className="text-xl font-bold text-text dark:text-text-dark">{projectMetrics.totalTasks}</p></div></div></Card> <Card className="p-4"><div className="flex items-center space-x-3"><div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" /></div><div><p className="text-sm text-muted dark:text-muted-dark">Completed</p><p className="text-xl font-bold text-text dark:text-text-dark">{projectMetrics.completedTasks}</p></div></div></Card> <Card className="p-4"><div className="flex items-center space-x-3"><div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" /></div><div><p className="text-sm text-muted dark:text-muted-dark">Overdue</p><p className="text-xl font-bold text-text dark:text-text-dark">{projectMetrics.overdueTasks}</p></div></div></Card> <Card className="p-4"><div className="flex items-center space-x-3"><div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><MembersIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div><div><p className="text-sm text-muted dark:text-muted-dark">Active Members</p><p className="text-xl font-bold text-text dark:text-text-dark">{projectMetrics.activeMembers}</p></div></div></Card> </div> <Card className="p-6"> <div className="flex items-center justify-between mb-4"> <h4 className="text-lg font-semibold text-text dark:text-text-dark">Recent Tasks</h4> <Button variant="outline" size="sm" onClick={() => setActiveTab('tasks')}>View All</Button> </div> {isLoadingProjectSpecificTasks ? <div className="text-center py-8 text-muted dark:text-muted-dark">Loading tasks...</div> : projectTasks.length === 0 ? ( <div className="text-center py-8 text-muted dark:text-muted-dark"> <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-4 opacity-50" /> <p>No tasks created yet</p> {canContributeToProject && <Button onClick={() => setShowTaskModal(true)} leftIcon={<PlusIcon className="w-4 h-4" />} className="mt-4">Create First Task</Button>} </div> ) : ( <div className="space-y-3"> {projectTasks.slice(0, 5).map(task => ( <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg dark:border-border-dark hover:bg-surface dark:hover:bg-surface-dark/50"> <div className="flex items-center space-x-3 flex-1 min-w-0"> <div className={`w-3 h-3 rounded-full ${PRIORITY_STYLES[task.priority || TaskPriority.MEDIUM]?.bg || 'bg-gray-400'}`}></div> <div className="flex-1 min-w-0"> <p className="text-sm font-medium text-text dark:text-text-dark truncate">{task.title}</p> <div className="flex items-center space-x-2 text-xs text-muted dark:text-muted-dark"> <span>{task.status.replace('_', ' ')}</span> <span>•</span> <span>Due {new Date(task.dueDate).toLocaleDateString()}</span> {task.progress !== undefined && ( <><span>•</span><span>{task.progress}%</span></> )} </div> </div> </div> <div className="flex items-center space-x-1"> <Button variant="ghost" size="sm" onClick={() => { setTaskToEdit(task); setShowTaskModal(true); }} className="p-1.5"><EyeIcon className="w-4 h-4" /></Button> <Button variant="ghost" size="sm" onClick={() => handleTaskDelete(task.id)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1.5"><Trash2Icon className="w-4 h-4" /></Button> </div> </div> ))} </div> )} </Card> </div> ),
    tasks: ( <div className="space-y-4"> <div className="flex items-center justify-between"> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Tasks</h3> {canContributeToProject && <Button onClick={() => { setTaskToEdit(null); setShowTaskModal(true); }} leftIcon={<PlusIcon className="w-4 h-4" />}>Add Task</Button>} </div> {isLoadingProjectSpecificTasks ? <div className="text-center py-8 text-muted dark:text-muted-dark">Loading tasks...</div> : projectTasks.length === 0 ? ( <div className="text-center py-12 text-muted dark:text-muted-dark"> <ClipboardDocumentListIcon className="w-16 h-16 mx-auto mb-4 opacity-50" /> <h4 className="text-lg font-medium mb-2">No tasks yet</h4> <p className="mb-4">Create your first task to get started</p> {canContributeToProject && <Button onClick={() => { setTaskToEdit(null); setShowTaskModal(true); }} leftIcon={<PlusIcon className="w-4 h-4" />}>Create First Task</Button>} </div> ) : ( <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"> {projectTasks.map(task => ( <GlobalTaskCard key={task.id} task={task} showProject={false} onEdit={() => { setTaskToEdit(task); setShowTaskModal(true); }} onDelete={() => handleTaskDelete(task.id)} canEdit={canManageProject} canDelete={canManageProject} /> ))} </div> )} </div> ),
    activity: ( <div className="space-y-4"> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Activity</h3> <ProjectActivityFeed projectId={project.id} updates={projectUpdates} onAddUpdate={(content, type, taskId, taskTitle) => handleAddUpdate({ content, type, relatedTaskId: taskId, relatedTaskTitle: taskTitle })} isLoading={false}/> </div> ),
    resources: ( <div className="space-y-4"> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Resources</h3> <ProjectResources projectId={project.id} resources={projectResources} onAddResource={handleAddResource} onDeleteResource={handleDeleteResource} canManage={canManageProject} canContribute={canContributeToProject} currentUserId={currentUser.id} isLoading={false}/> </div> ),
    analytics: ( <div className="space-y-4"> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Analytics</h3> <ProjectAnalytics project={project} tasks={projectTasks} metrics={projectMetrics}/> </div> ),
    settings: canManageProject ? ( <div className="space-y-6"> <h3 className="text-lg font-semibold text-text dark:text-text-dark">Project Settings</h3> <Card className="p-6"> <h4 className="text-lg font-medium mb-4 text-text dark:text-text-dark">Project Information</h4> <form onSubmit={async (e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); const priorityValue = formData.get('projectPriority') as string; const photoFile = (formData.get('projectPhoto') as File).size > 0 ? formData.get('projectPhoto') as File : undefined; const updatedProjectData: Partial<ProjectType> & { photoFile?: File } = { name: formData.get('projectName') as string, description: formData.get('projectDescription') as string, dueDate: formData.get('projectDueDate') as string || undefined, priority: priorityValue ? priorityValue as TaskPriority : undefined, photoFile, }; const result = await projectService.updateProject(project.id, updatedProjectData); handleInternalProjectUpdate(result); }} className="space-y-4"> <div><label className="block text-sm font-medium mb-2">Project Photo</label><input type="file" name="projectPhoto" className="input-style"/></div> <div><label className="block text-sm font-medium mb-2">Project Name</label><input type="text" name="projectName" defaultValue={project.name} className="input-style" placeholder="Enter project name"/></div> <div><label className="block text-sm font-medium mb-2">Description</label><textarea name="projectDescription" defaultValue={project.description} className="input-style" rows={4} placeholder="Enter project description"/></div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div><label className="block text-sm font-medium mb-2">Start Date</label><input type="date" name="projectStartDate" defaultValue={project.createdAt.split('T')[0]} className="input-style" readOnly disabled/></div> <div><label className="block text-sm font-medium mb-2">Due Date</label><input type="date" name="projectDueDate" defaultValue={project.dueDate?.split('T')[0] || ''} className="input-style"/></div> </div> <div><label className="block text-sm font-medium text-muted dark:text-muted-dark mb-1">Priority</label> <select name="projectPriority" defaultValue={project.priority || ''} className="input-style"> <option value="">Default (Medium)</option> {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)} </select> </div> <div className="flex justify-end"><Button type="submit">Save Changes</Button></div> </form> </Card> <Card className="p-6 border-red-200 dark:border-red-700/60"> <h4 className="text-lg font-medium mb-2 text-red-600 dark:text-red-400">Danger Zone</h4> <p className="text-sm text-muted dark:text-muted-dark mb-3">Once you delete a project, there is no going back. This will permanently delete all tasks, resources, and activity associated with this project.</p> <Button variant="dangerOutline" onClick={() => setShowDeleteModal(true)} data-delete-project-button>Delete Project</Button> </Card> </div> ) : ( <div className="text-center py-12 text-muted dark:text-muted-dark"><SettingsIcon className="w-16 h-16 mx-auto mb-4 opacity-50" /><h4 className="text-lg font-medium mb-2">Access Restricted</h4><p>Only project managers can access settings.</p></div> )
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 h-full flex flex-col">
      <header className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={onBack} leftIcon={<ArrowLeftIcon className="w-4 h-4" />} className="text-sm -ml-2"></Button>
          {project.photoUrl ? (
            <img src={project.photoUrl} alt={project.name} className="w-8 h-8 rounded-md object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <BriefcaseIcon className="w-5 h-5 text-gray-500" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-text dark:text-text-dark">{project.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          {canManageProject && <Button variant="outline" leftIcon={<MembersIcon className="w-4 h-4" />} size="sm" onClick={() => setShowManageMembersModal(true)}>Manage Members</Button>}
          {canManageProject && <Button variant="outline" leftIcon={<SettingsIcon className="w-4 h-4" />} onClick={() => setActiveTab('settings')} size="sm">Settings</Button>}
        </div>
      </header>

      <div className="border-b border-border dark:border-border-dark flex-shrink-0">
        <nav className="flex space-x-6 overflow-x-auto scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview', icon: EyeIcon },
            { id: 'tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
            { id: 'activity', label: 'Activity', icon: ChatBubbleLeftIcon },
            { id: 'resources', label: 'Resources', icon: FolderIcon },
            { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
            ...(canManageProject ? [{ id: 'settings', label: 'Settings', icon: SettingsIcon }] : [])
          ].map(tab => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary dark:text-primary-light' : 'border-transparent text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark hover:border-gray-300 dark:hover:border-gray-600'}`}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}<span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-grow overflow-y-auto min-h-0 py-4">
        {tabContent[activeTab]}
      </div>

      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setTaskToEdit(null); }}
        taskToEdit={taskToEdit}
        onSave={handleTaskSave}
        initialProjectId={project.id}
        availableProjects={[project]}
        currentUser={currentUser}
        availableConnections={availableConnections}
        isLoadingConnections={isLoadingConnections}
        availableTasks={projectTasks}
      />
      <ManageProjectMembersModal
        isOpen={showManageMembersModal}
        onClose={() => setShowManageMembersModal(false)}
        project={project}
        currentUser={currentUser}
        onProjectDataRefresh={handleProjectDataRefresh}
      />
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Project"
        saveButtonText="Delete"
        saveButtonVariant="danger"
        isSaving={isDeleting}
        onSave={handleProjectDeleteConfirm}
        saveDisabled={deleteProjectConfirmationInput.toLowerCase() !== project.name.toLowerCase()}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
            <div><h4 className="font-medium text-red-700 dark:text-red-200">This action cannot be undone</h4><p className="text-sm text-red-600 dark:text-red-300">This will permanently delete the project "{project.name}" and all associated data.</p></div>
          </div>
          <div className="space-y-2"><p className="text-sm text-text dark:text-text-dark">The following data will be permanently deleted:</p><ul className="text-sm text-muted dark:text-muted-dark space-y-1 ml-4"><li>• {projectMetrics.totalTasks} tasks</li><li>• {projectResources.length} resources</li><li>• {projectUpdates.length} activity updates</li><li>• All project settings and configurations</li></ul></div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg"><p className="text-sm text-yellow-700 dark:text-yellow-200"><strong>Tip:</strong> Consider archiving the project instead if you might need this data later.</p></div>
          <div className="pt-4">
            <label className="block text-sm font-medium mb-2 text-text dark:text-text-dark">Type "<strong className="text-primary dark:text-primary-light">{project.name}</strong>" to confirm deletion:</label>
            <input type="text" className="input-style" placeholder={`Type "${project.name}" here`} value={deleteProjectConfirmationInput} onChange={(e) => setDeleteProjectConfirmationInput(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

// 3. UPDATE YOUR EXISTING ProjectsPageProps INTERFACE
interface ProjectsPageProps {
  initialAppProjects: ProjectType[];
  setAppProjects: React.Dispatch<React.SetStateAction<ProjectType[]>>;
  appTasks: Task[];
  setAppTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentUser: FrontendUser | null;
  isLoadingParent?: boolean;
  onDataRefreshNeeded: () => Promise<void>;
  selectedProjectIdForDetailView?: string | null; 
  onReturnToDashboard?: () => void; 
  onViewProjectDetails?: (projectId: string) => void;
  // ADD THESE TWO NEW PROPS:
  userTeams?: AppTeamType[];
  teamContext?: { teamId: string; departmentId?: string };
}

export const ProjectsPage: React.FC<ProjectsPageProps> = (props) => {
  const {
    initialAppProjects, setAppProjects,
    appTasks, setAppTasks, 
    currentUser, isLoadingParent = false,
    onDataRefreshNeeded,
    selectedProjectIdForDetailView, 
    onReturnToDashboard, 
    onViewProjectDetails,
    userTeams,
    teamContext
  } = props;

  // 9. UPDATE YOUR COMPONENT STATE VARIABLE DECLARATIONS
  const [projects, setProjects] = useState<EnhancedProject[]>([]);
  const [projectForDetail, setProjectForDetail] = useState<ProjectType | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [projectPhotoFile, setProjectPhotoFile] = useState<File | null>(null);
  const [projectPhotoPreview, setProjectPhotoPreview] = useState<string | null>(null);
  
  // 4. ADD THESE STATE VARIABLES TO YOUR EXISTING ProjectsPage COMPONENT
  const [projectScope, setProjectScope] = useState<'my' | 'team' | 'department' | 'all'>('my');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProjects, setFilteredProjects] = useState<EnhancedProject[]>([]);
  
  // 5. ADD THIS HELPER FUNCTION (inside your ProjectsPage component)
  const convertToEnhancedProjects = useCallback((baseProjects: ProjectType[]): EnhancedProject[] => {
    return baseProjects.map(project => ({
      ...project,
      scope: project.scope || {
        type: project.teamId ? 'team' : 'individual',
        teamId: project.teamId,
        departmentIds: [],
        visibility: 'private'
      },
      assignedDepartments: project.assignedDepartments || [],
      teamInfo: project.teamId ? {
        teamId: project.teamId,
        teamName: project.teamName || 'Unknown Team'
      } : undefined
    }));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) {
        setProjects([]);
        setProjectForDetail(null);
        return;
      }
      
      setError(null);
      
      try {
        if (selectedProjectIdForDetailView) {
          const existingProject = initialAppProjects.find(p => p.id === selectedProjectIdForDetailView);
          
          if (existingProject) {
            setProjectForDetail(existingProject);
          } else {
            const detailProject = await projectService.getProjectById(selectedProjectIdForDetailView);
            setProjectForDetail(detailProject);
            if (!detailProject) setError("Project not found.");
          }
        } else {
          setProjects(convertToEnhancedProjects(initialAppProjects));
          setProjectForDetail(null); 
        }
      } catch (err) {
        setError((err as Error).message || "Failed to load project data.");
        setProjectForDetail(null);
      }
    };
    
    loadData();
  }, [currentUser, selectedProjectIdForDetailView, initialAppProjects, convertToEnhancedProjects]);

  // 6. ADD THIS useEffect FOR PROJECT CONVERSION AND FILTERING
  useEffect(() => {
    setProjects(convertToEnhancedProjects(initialAppProjects));
  }, [initialAppProjects, convertToEnhancedProjects]);

  useEffect(() => {
    let intermediateFiltered = [...projects];

    // Scope filter
    if (currentUser) {
        switch(projectScope) {
            case 'my':
                intermediateFiltered = intermediateFiltered.filter(p => p.ownerId === currentUser.id || p.members.some(m => m.id === currentUser.id));
                break;
            case 'team':
                const userTeamIds = new Set(userTeams?.map(t => t.id));
                intermediateFiltered = intermediateFiltered.filter(p => p.teamId && userTeamIds.has(p.teamId));
                break;
            case 'department':
                 intermediateFiltered = intermediateFiltered.filter(p => 
                    (p.scope?.type === 'department' || p.scope?.type === 'cross_department') && 
                    p.assignedDepartments && p.assignedDepartments.length > 0
                );
                break;
            case 'all':
                // No scope filter needed
                break;
        }
    }

    // Search filter
    if (searchTerm) {
        intermediateFiltered = intermediateFiltered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  
    setFilteredProjects(intermediateFiltered);
  }, [projects, searchTerm, projectScope, currentUser, userTeams]);

  const handleCreateOrUpdateProject = async (projectData: Partial<ProjectType> & { memberIds?: string[], teamId?: string, photoFile?: File }) => {
    if (!currentUser) { alert("User not authenticated."); return; }
    try {
      let savedProject: ProjectType;
      if (editingProject) {
        savedProject = await projectService.updateProject(editingProject.id, projectData);
      } else {
        savedProject = await projectService.createProject({ ...projectData, ownerId: currentUser.id });
      }
      await onDataRefreshNeeded(); 
      setIsCreateModalOpen(false);
      setEditingProject(null);
       if (projectForDetail && projectForDetail.id === savedProject.id) { 
        setProjectForDetail(savedProject);
      }
    } catch (error) {
      console.error("Error saving project:", error);
      alert("Failed to save project.");
    }
  };

  const handleDeleteProjectFromList = async (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project and all its tasks? This cannot be undone.")) {
        try {
            await projectService.deleteProject(projectId);
            await onDataRefreshNeeded();
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Failed to delete project.");
        }
    }
  };
  
  const handleOpenEditModal = (project: ProjectType) => {
    setEditingProject(project);
    setProjectPhotoPreview(project.photoUrl || null);
    setIsCreateModalOpen(true);
  };
  
  const handleProjectUpdateInDetailView = async (updatedProject: ProjectType) => {
    setProjectForDetail(updatedProject); 
    await onDataRefreshNeeded(); 
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProjectPhotoFile(file);
      setProjectPhotoPreview(URL.createObjectURL(file));
    }
  };
  
  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingProject(null);
    setProjectPhotoFile(null);
    setProjectPhotoPreview(null);
  };

  if (selectedProjectIdForDetailView && projectForDetail && currentUser) {
    return (
      <ProjectDetail
        projectProp={projectForDetail}
        currentUser={currentUser}
        appTasksGlobal={appTasks}
        setAppTasksGlobal={setAppTasks}
        onBack={() => {
            if (typeof onReturnToDashboard === 'function') {
                onReturnToDashboard();
            }
        }}
        onProjectUpdate={handleProjectUpdateInDetailView}
      />
    );
  }
  
  if (selectedProjectIdForDetailView && error) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>;
  }
  
  if (selectedProjectIdForDetailView && !projectForDetail && !error) {
    return <div className="p-6 text-center text-red-500">Project not found or access denied.</div>;
  }

  if (isLoadingParent && initialAppProjects.length === 0) {
    return <div className="p-6 text-center text-muted dark:text-muted-dark">Loading projects...</div>;
  }
  
  if (error && initialAppProjects.length === 0) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-0 sm:p-6 bg-transparent sm:bg-background dark:sm:bg-background-dark">
      {/* 7. REPLACE YOUR EXISTING HEADER SECTION WITH THIS: */}
      <div className="flex flex-col space-y-4 mb-6 px-4 sm:px-0">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-text dark:text-text-dark">Projects</h1>
            <p className="text-muted dark:text-muted-dark">Manage and organize your work across teams and departments.</p>
          </div>
          <Button 
            onClick={() => { 
              setEditingProject(null); 
              setIsCreateModalOpen(true); 
            }} 
            leftIcon={<PlusIcon />}
          >
            New Project
          </Button>
        </div>

        {/* Scope Navigation */}
        <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-gray-700">
          {[
            { key: 'my', label: 'My Projects' },
            { key: 'team', label: 'Team Projects' },
            { key: 'department', label: 'Department Projects' },
            { key: 'all', label: 'All Projects' }
          ].map(scope => (
            <button
              key={scope.key}
              onClick={() => setProjectScope(scope.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                projectScope === scope.key
                  ? 'border-primary text-primary dark:text-primary-light bg-primary/5 dark:bg-primary-dark/10'
                  : 'border-transparent text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted dark:text-muted-dark" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-style pl-10"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* 8. REPLACE YOUR EXISTING PROJECT GRID SECTION WITH THIS: */}
      {filteredProjects.length === 0 ? (
        <Card className="text-center p-10 mx-4 sm:mx-0">
          <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-text dark:text-text-dark">
            {searchTerm ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-muted dark:text-muted-dark mb-6">
            {searchTerm 
              ? 'Try adjusting your search to find what you\'re looking for.'
              : 'Create your first project to get started organizing your work.'
            }
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => { 
                setEditingProject(null); 
                setIsCreateModalOpen(true); 
              }} 
              leftIcon={<PlusIcon />}
            >
              Create Project
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-0">
          {filteredProjects.map(project => (
            <Card 
              key={project.id}
              className="p-4 flex flex-col h-full cursor-pointer hover:shadow-xl transition-shadow duration-150 ease-in-out group"
              onClick={() => { if (onViewProjectDetails) { onViewProjectDetails(project.id); }}}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {project.photoUrl ? (
                    <img src={project.photoUrl} alt={project.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                      <BriefcaseIcon className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-text dark:text-text-dark truncate" title={project.name}>
                      {project.name}
                    </h3>
                    {/* Scope indicators */}
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.scope?.type === 'team' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        project.scope?.type === 'department' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        project.scope?.type === 'cross_department' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                        'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                      }`}>
                        {project.scope?.type === 'team' ? 'Team' :
                         project.scope?.type === 'department' ? 'Department' :
                         project.scope?.type === 'cross_department' ? 'Multi-Dept' :
                         'Individual'}
                      </span>
                      {project.scope?.departmentIds && project.scope.departmentIds.length > 1 && (
                        <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                          {project.scope.departmentIds.length} Depts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Keep your existing options menu here */}
                <div className="relative group">
                  <button 
                    onClick={(e) => { e.stopPropagation(); }} 
                    className="p-1 text-muted dark:text-muted-dark hover:text-text dark:hover:text-text-dark"
                  >
                    <OptionsIcon className="w-5 h-5"/>
                  </button>
                  <div className="absolute top-full right-0 mt-1 hidden group-hover:block bg-card dark:bg-card-dark border dark:border-border-dark rounded-md shadow-lg z-10 py-1">
                    <button onClick={(e) => {e.stopPropagation(); handleOpenEditModal(project)}} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700">Edit</button>
                    <button onClick={(e) => {e.stopPropagation(); handleDeleteProjectFromList(project.id)}} className="block w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                  </div>
                </div>
              </div>

              {/* Enhanced project info */}
              <div className="flex-1 mb-3">
                <p className="text-xs text-muted dark:text-muted-dark mb-1">
                  <span className="font-semibold">Owner:</span> {project.ownerName || 'N/A'}
                </p>
                
                {project.teamInfo && (
                  <p className="text-xs text-muted dark:text-muted-dark mb-2 flex items-center space-x-1">
                    <Building2Icon className="w-3 h-3" />
                    <span className="font-semibold">Team:</span> 
                    <span>{project.teamInfo.teamName}</span>
                  </p>
                )}

                {project.assignedDepartments && project.assignedDepartments.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-muted dark:text-muted-dark mb-1">
                      <span className="font-semibold">Departments:</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {project.assignedDepartments.slice(0, 2).map(dept => (
                        <span key={dept.id} className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                          {dept.name}
                        </span>
                      ))}
                      {project.assignedDepartments.length > 2 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                          +{project.assignedDepartments.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {project.dueDate && (
                  <p className="text-xs text-muted dark:text-muted-dark mb-2">
                    <span className="font-semibold">Due:</span> {new Date(project.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="border-t dark:border-border-dark pt-2">
                <div className="flex items-center justify-between text-xs text-muted dark:text-muted-dark">
                  <div className="flex items-center space-x-2">
                    <MembersIcon className="w-3 h-3" />
                    <span>{project.members?.length || 0} members</span>
                  </div>
                  {project.dueDate && (
                    <div className="flex items-center space-x-1">
                      <CalendarDaysIcon className="w-3 h-3" />
                      <span>{new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={handleModalClose}
          title={editingProject ? "Edit Project" : "Create New Project"}
          onSave={() => { 
            const form = document.getElementById('projectForm') as HTMLFormElement;
            if(form) form.requestSubmit();
          }}
          saveLabel={editingProject ? "Save Changes" : "Create Project"}
        >
          <form id="projectForm" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name') as string;
            const description = formData.get('description') as string;
            const dueDateVal = formData.get('dueDate') as string;
            const priorityVal = formData.get('priority') as string;
            const photoFile = formData.get('photoFile') as File | null;

            const data: Partial<ProjectType> & { photoFile?: File } = {
              name: name,
              description: description,
              dueDate: dueDateVal || undefined,
              priority: priorityVal ? priorityVal as TaskPriority : undefined,
              photoFile: photoFile || undefined,
            };
            handleCreateOrUpdateProject(data);
          }} className="space-y-4">
             <div>
              <label htmlFor="projectPhoto" className="block text-sm font-medium text-muted dark:text-muted-dark">Project Photo</label>
              <div className="mt-1 flex items-center space-x-4">
                {projectPhotoPreview ? (
                  <img src={projectPhotoPreview} alt="Project preview" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <BriefcaseIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <input type="file" name="photoFile" id="projectPhoto" accept="image/*" onChange={handlePhotoChange} className="input-style text-sm"/>
              </div>
            </div>
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-muted dark:text-muted-dark">Project Name</label>
              <input type="text" name="name" id="projectName" defaultValue={editingProject?.name || ''} className="input-style" required/>
            </div>
            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium text-muted dark:text-muted-dark">Description (Optional)</label>
              <textarea name="description" id="projectDescription" defaultValue={editingProject?.description || ''} rows={3} className="input-style"></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="projectDueDate" className="block text-sm font-medium text-muted dark:text-muted-dark">Due Date (Optional)</label>
                    <input type="date" name="dueDate" id="projectDueDate" defaultValue={editingProject?.dueDate?.split('T')[0] || ''} className="input-style"/>
                </div>
                <div>
                    <label htmlFor="projectPriority" className="block text-sm font-medium text-muted dark:text-muted-dark">Priority (Optional)</label>
                    <select name="priority" id="projectPriority" defaultValue={editingProject?.priority || ''} className="input-style">
                        <option value="">Select Priority</option>
                        {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};