

import { Task, TaskPriority, TaskStatus, Project, Note, CalendarEvent, QuickStatsData, ResourceItem, ResourceItemType, NoteCategory, TeamType, DailyPerformance, TaskDistributionItem, ProjectMember, UserRole, TeamIconName } from './types';

export const MOCK_USER = {
  id: 'd932fe39-119a-4048-9f99-efe37e596rk9',
  name: "Alex Johnson",
  avatar_url: "https://picsum.photos/seed/alex/100/100", // Fixed to avatar_url
  plan: "Premium Plan",
  email: "alex@company.com"
};


export const MOCK_PROJECT_DATA_OLD: Project[] = [
  { id: 'proj_mock_1', name: 'Legacy Alpha Project', progress: 75, totalTasks: 20, completedTasks: 15, userId: MOCK_USER.id, ownerId: MOCK_USER.id, description: "An old project for dashboard display.", members: [], createdAt: '2023-01-15T10:00:00Z' },
  { id: 'proj_mock_2', name: 'Archived Beta Initiative', progress: 40, totalTasks: 10, completedTasks: 4, userId: MOCK_USER.id, ownerId: MOCK_USER.id, description: "Another mock project for the dashboard.", members: [], createdAt: '2023-02-20T12:30:00Z' },
];


export const MOCK_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'Key Takeaways from Q2 Planning',
    category: NoteCategory.MEETING_NOTE,
    content: 'Discussed goals and objectives for Q2. Key focus areas: product development, market expansion, team growth.',
    attendees: ['Alex J.', 'Sarah K.', 'Mike L.'],
    actionItems: ['Finalize budget by EOW.', 'Hire 2 new developers.', 'Launch marketing campaign by mid-May.'],
    date: '2025-05-20',
    tags: ['Work', 'Planning'],
    isFavorite: true,
  },
  {
    id: 'n2',
    title: 'Brainstorm: New App Features',
    category: NoteCategory.GENERAL,
    content: '<p>Ideas for next development cycle:</p><ul><li>AI integration for task prioritization.</li><li>Better UX for mobile app.</li><li>Integration with popular tools like Slack and Notion.</li><li>Advanced analytics dashboard.</li></ul>',
    date: '2025-05-19',
    tags: ['Ideas', 'Brainstorm', 'Product'],
    isFavorite: false
  },
  {
    id: 'n3',
    title: 'Client Feedback Summary - May',
    category: NoteCategory.GENERAL,
    content: '<p>Client X is happy with progress, minor UI tweaks requested. Client Y needs more frequent updates. Client Z interested in new AI features.</p>',
    date: '2025-05-18',
    tags: ['Client', 'Feedback', 'Work']
  },
  {
    id: 'n4',
    title: 'Article: "The Future of Remote Work"',
    category: NoteCategory.READING_LIST,
    content: 'Interesting insights on hybrid models and asynchronous communication. Key points: Flexibility is paramount. Tooling for async work. Company culture in remote settings.',
    url: 'https://example.com/future-remote-work',
    author: 'Example.com Blog',
    date: '2025-05-21',
    tags: ['Future-of-Work', 'Article'],
    isFavorite: true,
  },
  {
    id: 'n5',
    title: 'Book: "Atomic Habits" by James Clear',
    category: NoteCategory.READING_LIST,
    content: 'Main Concepts: Make it obvious. Make it attractive. Make it easy. Make it satisfying. Focus on small improvements and system building rather than just goals.',
    author: 'James Clear',
    date: '2025-05-15',
    tags: ['Productivity', 'Self-Help', 'Book'],
    isFavorite: false,
  },
  {
    id: 'n6',
    title: 'Project Phoenix Kick-off Meeting',
    category: NoteCategory.MEETING_NOTE,
    content: 'Project goals discussion. Timeline overview. Team roles and responsibilities.',
    attendees: ['David Lee', 'Emily Carter', 'Alex Johnson'],
    actionItems: ['Schedule requirement gathering workshop (David).', 'Set up project Slack channel (Emily).'],
    date: '2025-05-22',
    tags: ['Project-Phoenix', 'Kickoff', 'Work'],
  },
  {
    id: 'n7',
    title: 'Weekly Goals',
    category: NoteCategory.GENERAL,
    content: '<h2>This Week:</h2><ul><li>Exercise 3 times.</li><li>Finish reading "The Pragmatic Programmer".</li><li>Call parents.</li><li>Outline blog post on new JS features.</li></ul>',
    date: '2025-05-23',
    tags: ['Personal', 'Goals'],
    isFavorite: true,
  }
];


export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'Project Alpha Sync', date: '2025-05-26', startTime: '10:00', endTime: '11:00', color: 'blue-500', calendarType: 'work' },
  { id: 'e2', title: 'Dentist Appointment', date: '2025-05-27', startTime: '14:00', endTime: '15:00', color: 'green-500', calendarType: 'personal' },
  { id: 'e3', title: 'Complete project proposal (Task)', date: '2025-05-25', color: 'red-400', calendarType: 'tasks' },
  { id: 'e4', title: 'Review marketing campaign (Task)', date: '2025-05-26', color: 'red-400', calendarType: 'tasks' },
  { id: 'e5', title: 'Team Lunch', date: '2025-05-28', startTime: '12:30', endTime: '13:30', color: 'purple-500', calendarType: 'work' },
  { id: 'e6', title: 'Gym Session', date: '2025-05-29', startTime: '18:00', endTime: '19:00', color: 'yellow-500', calendarType: 'personal' },
  { id: 'e7', title: 'Family Dinner', date: '2025-05-30', startTime: '19:00', endTime: '21:00', color: 'pink-500', calendarType: 'family' },
];


export const getMockQuickStats = (tasks: Task[]): QuickStatsData => {
  const today = new Date().toISOString().split('T')[0];

  return {
    tasksToday: tasks.filter(task => task.dueDate === today && task.status !== TaskStatus.COMPLETED).length,
    completed: tasks.filter(task => task.status === TaskStatus.COMPLETED && task.completedAt?.startsWith(today)).length,
    inProgress: tasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
  };
};

/*
// MOCK_RESOURCE_ITEMS is now commented out as live data will be fetched from Supabase.
// If you need example structure for ResourceItem, refer to types.ts.
// The actual publicUrl will be generated dynamically based on your Supabase project URL and the filePath.
export const MOCK_RESOURCE_ITEMS_EXAMPLE: ResourceItem[] = [
  {
    id: 'res-doc-1a',
    name: 'Proposal_V1.docx',
    type: ResourceItemType.DOCUMENT,
    sizeBytes: 1200000,
    createdAt: '2025-05-18T14:30:00Z',
    uploadedBy: 'user-id-1',
    filePath: 'public/user-id-1/project-documents/Proposal_V1.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    publicUrl: 'https://your-supabase-id.supabase.co/storage/v1/object/public/resources/public/user-id-1/project-documents/Proposal_V1.docx'
  },
  {
    id: 'res-img-2b',
    name: 'Team_Photo.jpg',
    type: ResourceItemType.IMAGE,
    sizeBytes: 850000,
    createdAt: '2025-05-19T10:15:00Z',
    uploadedBy: 'user-id-2',
    filePath: 'public/user-id-2/team-photos/Team_Photo.jpg',
    mimeType: 'image/jpeg',
    publicUrl: 'https://your-supabase-id.supabase.co/storage/v1/object/public/resources/public/user-id-2/team-photos/Team_Photo.jpg'
  },
];
*/


export const MOCK_TEAMS_DATA: TeamType[] = [
    {
        id: 'team1',
        name: 'Product Development',
        description: 'Main product development team, focusing on core features and innovation.',
        iconSeed: 'RocketLaunch',
        ownerId: MOCK_USER.id,
        ownerName: MOCK_USER.name,
        members: [],
        departments: [],
        efficiency: 94,
        membersCount: 5,
        projectsCount: 3,
        completedTasksCount: 100, // Added mock value
        tasksCount: 127,
    },
    {
        id: 'team2',
        name: 'Design Team',
        description: 'UI/UX and Visual Design for all company products and marketing materials.',
        iconSeed: 'LightBulbCreative',
        ownerId: MOCK_USER.id,
        ownerName: MOCK_USER.name,
        members: [],
        departments: [],
        efficiency: 96,
        membersCount: 4,
        projectsCount: 2,
        completedTasksCount: 70, // Added mock value
        tasksCount: 89,
    },
    {
        id: 'team3',
        name: 'Marketing and Growth',
        description: 'Driving customer acquisition, brand awareness, and market expansion.',
        iconSeed: 'PuzzlePiece',
        ownerId: MOCK_USER.id,
        ownerName: MOCK_USER.name,
        members: [],
        departments: [],
        efficiency: 91,
        membersCount: 6,
        projectsCount: 4,
        completedTasksCount: 120, // Added mock value
        tasksCount: 156,
    },
    {
        id: 'team4',
        name: 'Engineering',
        description: 'Backend and infrastructure management, ensuring stability and scalability.',
        iconSeed: 'Users',
        ownerId: MOCK_USER.id,
        ownerName: MOCK_USER.name,
        members: [],
        departments: [],
        efficiency: 89,
        membersCount: 8,
        projectsCount: 5,
        completedTasksCount: 180, // Added mock value
        tasksCount: 203,
    }
];

export const MOCK_DAILY_PERFORMANCE_DATA: DailyPerformance[] = [
    { day: 'Mon', tasksCompleted: 7, tasksTotal: 8, focusHours: 4.5 },
    { day: 'Tue', tasksCompleted: 5, tasksTotal: 6, focusHours: 5.2 },
    { day: 'Wed', tasksCompleted: 6, tasksTotal: 7, focusHours: 3.8 },
    { day: 'Thu', tasksCompleted: 8, tasksTotal: 9, focusHours: 4.8 },
    { day: 'Fri', tasksCompleted: 3, tasksTotal: 3, focusHours: 2.1 },
    { day: 'Sat', tasksCompleted: 2, tasksTotal: 2, focusHours: 1.5 },
    { day: 'Sun', tasksCompleted: 0, tasksTotal: 0, focusHours: 0 },
];

// Removed MOCK_TASK_DISTRIBUTION_DATA
// export const MOCK_TASK_DISTRIBUTION_DATA: TaskDistributionItem[] = [
//     { name: 'Development', value: 33 },
//     { name: 'Design', value: 18 },
//     { name: 'Meetings', value: 27 },
//     { name: 'Review', value: 9 },
//     { name: 'Planning', value: 13 },
// ];
