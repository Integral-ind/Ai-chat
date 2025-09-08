// Replace your types.ts with this corrected version:

import { ReactNode } from 'react';

// ===================================
// Core & User Types
// ===================================

export interface UserPublicProfile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

// Frontend User type (used in components)
export interface User extends UserPublicProfile {
  name: string; // This is used in your frontend components
  plan?: string;
  avatar_url: string | null; // Explicitly add avatar_url here for clarity
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

// ===================================
// UI & Context Types
// ===================================

export interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export interface NavItem {
  name: string;
  path: string;
  icon: (props: { className?: string }) => ReactNode;
  quickStatsKey?: keyof QuickStatsData;
  children?: NavItem[];
}

export interface NavLink {
    label: string;
    href: string;
}

export interface Feature {
    title: string;
    description: string;
    iconName?: string;
}

// ===================================
// Dashboard & Analytics Types
// ===================================

export interface QuickStatsData {
  tasksToday: number;
  completed: number;
  inProgress: number;
}

export interface StatCardData {
    title: string;
    value: string | number;
    icon: React.FC<{ className?: string }>;
    change?: string;
    trendIcon?: React.FC<{ className?: string }>;
    iconBgColor?: string;
    footerText?: string;
    onClick?: () => void;
    valueClassName?: string;
    isLoading?: boolean;
}

export interface AIInsight {
  id: string;
  type: 'suggestion' | 'observation' | 'warning';
  text: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DailyPerformance {
  day: string;
  tasksCompleted: number;
  tasksTotal: number;
  focusHours: number;
}

export interface TaskDistributionItem {
    name: string;
    value: number;
    fill?: string;
}

export interface FocusSession {
    userId: string;
    date: string;
    durationMs: number;
}

// ===================================
// Task Types
// ===================================

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Review',
  COMPLETED = 'Completed',
  BLOCKED = 'Blocked',
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  createdAt: string;
  progress?: number;
  priority?: TaskPriority;
  status: TaskStatus;
  tags?: string[];
  assigneeName?: string;
  assignerName?: string;
  assignedTo?: string;
  assignedBy?: string;
  description?: string;
  project?: string;
  projectId?: string;
  completedAt?: string;
  userId?: string;
  timeAllotted?: number;
  timeTaken?: number;
  extended?: boolean;
  estimatedHours?: number;
  dependencies?: string[];
  createdBy?: string;
  updatedAt?: string;
}

// ===================================
// Project Types
// ===================================
export interface ProjectScope {
  type: 'individual' | 'department' | 'team' | 'cross_department';
  teamId?: string;
  departmentIds?: string[];
  visibility: 'private' | 'team_visible' | 'department_visible' | 'public';
}
export interface ProjectMember extends UserPublicProfile {
  role: UserRole;
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  ownerId: string;
  ownerName?: string;
  members: ProjectMember[];
  teamId?: string;
  teamName?: string;
  dueDate?: string;
  priority?: TaskPriority;
  userId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  photoUrl?: string | null;
  department_id?: string;

  // Enhanced fields
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

export interface ProjectUpdate {
    id: string;
    projectId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    timestamp: string;
    type: 'general' | 'milestone' | 'task_completion' | 'member_added' | 'file_shared';
    relatedTaskId?: string;
    relatedTaskTitle?: string;
}

export interface ProjectResource {
    id: string;
    projectId: string;
    name: string;
    type: 'file' | 'link' | 'document';
    url: string;
    uploadedBy: string;
    uploadedByName: string;
    uploadedAt: string;
    description?: string;
    size?: number;
    originalResourceId?: string;
}

export interface ProjectMetrics {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    upcomingDeadlines: number;
    activeMembers: number;
    recentActivity: number;
}

// ===================================
// Note Types
// ===================================

export enum NoteCategory {
  GENERAL = 'General',
  READING_LIST = 'Reading List',
  MEETING_NOTE = 'Meeting Note',
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  category: NoteCategory;
  tags?: string[];
  isFavorite?: boolean;
  url?: string;
  author?: string;
  attendees?: string[];
  actionItems?: string[];
  userId?: string;
}

export type NoteSidebarFilterType = 'All Notes' | 'Favorites' | 'Work' | 'Personal';

export interface NoteSidebarFilterItem {
    id: NoteSidebarFilterType;
    label: string;
    icon: React.FC<{ className?: string }>;
}

export enum NoteFilterCategory {
  ALL = 'All',
  FAVORITES = 'Favorites',
  WORK = 'Work',
  PERSONAL = 'Personal',
}

export interface GeneralNoteFilterCategoryItem {
    id: NoteFilterCategory;
    name: string;
    icon: React.FC<{ className?: string }>;
    countKey: 'all' | 'favorites' | 'work' | 'personal';
}

export interface NoteCategoryTabItem {
    id: NoteCategory;
    label: string;
    icon: React.FC<{ className?: string }>;
}

export enum NoteSortOption {
    NEWEST = 'newest',
    OLDEST = 'oldest',
    TITLE_ASC = 'title_asc',
    TITLE_DESC = 'title_desc'
}

export interface NoteModalFormData {
    id?: string;
    title: string;
    content: string;
    category: NoteCategory;
    tags?: string;
    isFavorite?: boolean;
    url?: string;
    author?: string;
    attendees?: string;
    actionItems?: string;
}

// ===================================
// Team & Collaboration Types
// ===================================

export type TeamIconName = 'RocketLaunch' | 'LightBulbCreative' | 'PuzzlePiece' | 'Users' | 'CheckCircle2' | 'Building2';

export enum DepartmentMemberRole {
    MEMBER = 'MEMBER',
    ADMIN = 'ADMIN',
}

export interface TeamMember extends UserPublicProfile {
    role: UserRole;
    joinedAt: string;
    tags?: string[];
    permissions?: TeamPermission[];
}

export interface DepartmentMember extends TeamMember {
    departmentRole: DepartmentMemberRole;
}

export interface DepartmentType {
  id: string;
  name: string;
  teamId: string;
  description?: string;
  members: DepartmentMember[];
  admins: DepartmentMember[];
  projects: Project[];
}

export interface TeamType {
    id: string;
    name: string;
    description: string;
    iconSeed: TeamIconName;
    ownerId: string;
    ownerName: string;
    members: TeamMember[];
    departments: DepartmentType[];
    efficiency: number;
    membersCount: number;
    projectsCount: number;
    tasksCount: number;
    completedTasksCount: number;
    resourcesCount?: number;
    photoUrl?: string | null;
}

export enum TeamPermission {
    CAN_ADD_MEMBERS = 'CAN_ADD_MEMBERS',
    CAN_REMOVE_MEMBERS = 'CAN_REMOVE_MEMBERS',
    CAN_MANAGE_ROLES = 'CAN_MANAGE_ROLES',
    CAN_DELETE_TEAM = 'CAN_DELETE_TEAM',
    CAN_EDIT_TEAM_DETAILS = 'CAN_EDIT_TEAM_DETAILS',
    CAN_MANAGE_DEPARTMENTS = 'CAN_MANAGE_DEPARTMENTS',
    CAN_MANAGE_PROJECTS = 'CAN_MANAGE_PROJECTS',
}

export interface TeamUpdate {
    id: string;
    teamId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    createdAt: string;
}

export interface DepartmentUpdate {
    id: string;
    departmentId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    createdAt: string;
}

export interface TeamInviteWithTeamDetails {
  id: string;
  teamId: string;
  teamName: string;
  teamDescription: string;
  teamIconSeed: TeamIconName;
  teamPhotoUrl: string | null;
  teamMemberCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  isUsed: boolean;
}

// ===================================
// Resource Types
// ===================================

export enum ResourceItemType {
    FOLDER = 'folder',
    DOCUMENT = 'document',
    IMAGE = 'image',
    VIDEO = 'video',
    PDF = 'pdf',
    ARCHIVE = 'archive',
    OTHER = 'other',
}

export interface ResourceItem {
    id: string;
    name: string;
    type: ResourceItemType;
    sizeBytes: number;
    createdAt: string;
    uploadedBy: string;
    filePath: string;
    mimeType: string;
    publicUrl?: string;
    projectId?: string;
    teamId?: string;
    parentFolderId?: string;
    starred?: boolean;
    lastAccessedAt?: string;
    updatedAt?: string;
    sharedBy?: {
        id: string;
        name: string;
    };
}

// ===================================
// Connect & Chat Types
// ===================================

export type ConnectionStatus = 'connected' | 'pending_sent' | 'pending_received' | 'none';

export interface UserSearchResult extends UserPublicProfile {
    connection_status: ConnectionStatus;
    request_id?: string;
    connection_id?: string;
}

export interface ConnectionRequest {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: ConnectionStatus;
    created_at: string;
    updated_at: string;
}

export interface ConnectionRequestWithProfile extends ConnectionRequest {
    sender_profile?: UserPublicProfile;
    receiver_profile?: UserPublicProfile;
}

export interface ConnectedUser extends UserPublicProfile {
    connection_id: string;
}


// ===================================
// Calendar Types
// ===================================

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  color: string;
  calendarType: 'work' | 'personal' | 'family' | 'tasks';
  description?: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
}

// ===================================
// Global Search Types
// ===================================

export interface GlobalSearchResultItem {
  id: string;
  title: string;
  type: 'task' | 'project' | 'note' | 'team' | 'resource' | 'user' | 'calendarEvent';
  description?: string;
  icon?: React.FC<{ className?: string }>;
  path: string;
  state?: Record<string, any>;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface GlobalSearchResults {
  tasks: GlobalSearchResultItem[];
  projects: GlobalSearchResultItem[];
  notes: GlobalSearchResultItem[];
  teams: GlobalSearchResultItem[];
  resources: GlobalSearchResultItem[];
  users: GlobalSearchResultItem[];
  calendarEvents: GlobalSearchResultItem[];
}