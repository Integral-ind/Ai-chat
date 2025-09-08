import { supabase } from './supabaseClient';
import { Task, TaskPriority, TaskStatus, Project as ProjectType, UserPublicProfile, ProjectMember, UserRole, GlobalSearchResultItem } from './types';
import { Database } from './types_db';
import { CheckBadgeIcon } from './constants'; // For search result icon
import { notificationService } from './notificationService';

type DbTask = Database['public']['Tables']['tasks']['Row'];
type DbProject = Database['public']['Tables']['projects']['Row'];
type DbTaskTag = Database['public']['Tables']['task_tags']['Row'];
type DbUserProfile = Database['public']['Tables']['user_profiles']['Row'];

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated. Please sign in.");
  }
  return user;
};

const mapUserProfileToPublicProfile = (profile: DbUserProfile | UserPublicProfile): UserPublicProfile => ({
  id: profile.id,
  full_name: profile.full_name || (profile as DbUserProfile).email?.split('@')[0] || 'User',
  email: (profile as DbUserProfile).email || 'No email provided',
  avatar_url: profile.avatar_url || null,
});

const mapDbTaskToFrontend = (
  dbTask: DbTask & { 
    task_tags?: Pick<DbTaskTag, 'tag_name'>[], 
    projects?: Pick<DbProject, 'name' | 'team_id'> | null // Include team_id from project
  },
  profilesMap: Map<string, Pick<DbUserProfile, 'full_name' | 'email' | 'avatar_url'>>
): Task => {
  const assigneeProfile = dbTask.assigned_to ? profilesMap.get(dbTask.assigned_to) : null;
  const assignerProfile = dbTask.assigner_id ? profilesMap.get(dbTask.assigner_id) : null;

  return {
    id: String(dbTask.id),
    title: dbTask.title || '',
    description: dbTask.description || undefined,
    dueDate: dbTask.due_date || new Date().toISOString().split('T')[0],
    createdAt: dbTask.created_at || new Date().toISOString(), // Ensure createdAt is mapped
    priority: (dbTask.priority as TaskPriority) || TaskPriority.MEDIUM,
    status: (dbTask.status as TaskStatus) || TaskStatus.TODO,
    project: dbTask.projects?.name || undefined,
    assigneeName: assigneeProfile?.full_name || assigneeProfile?.email?.split('@')[0] || undefined,
    assignerName: assignerProfile?.full_name || assignerProfile?.email?.split('@')[0] || undefined,
    progress: dbTask.progress !== null && dbTask.progress !== undefined ? dbTask.progress : 0,
    tags: dbTask.task_tags?.map(t => t.tag_name).filter(Boolean) || [],
    completedAt: dbTask.completed_at || undefined,
    projectId: dbTask.project_id ? String(dbTask.project_id) : undefined,
    userId: dbTask.user_id || undefined,
    assignedTo: dbTask.assigned_to || undefined, 
    assignedBy: dbTask.assigner_id || undefined,
    updatedAt: dbTask.updated_at || dbTask.created_at,
    dependencies: dbTask.dependencies || [],
  };
};

const validateTaskData = (taskData: Partial<Task>) => {
  if (taskData.title !== undefined && !taskData.title?.trim()) {
    throw new Error("Task title is required if provided and cannot be empty.");
  }
  if (taskData.priority && !Object.values(TaskPriority).includes(taskData.priority)) {
    throw new Error(`Invalid task priority value: ${taskData.priority}.`);
  }
  if (taskData.status && !Object.values(TaskStatus).includes(taskData.status)) {
    throw new Error(`Invalid task status value: ${taskData.status}.`);
  }
  // Progress validation removed from here as it's implicit
};

const fetchProfilesForTasks = async (tasks: DbTask[]): Promise<Map<string, Pick<DbUserProfile, 'full_name' | 'email' | 'avatar_url'>>> => {
  const userIds = new Set<string>();
  tasks.forEach(task => {
    if (task.assigned_to) userIds.add(task.assigned_to);
    if (task.assigner_id) userIds.add(task.assigner_id);
    if (task.user_id) userIds.add(task.user_id);
  });

  const profilesMap = new Map<string, Pick<DbUserProfile, 'full_name' | 'email' | 'avatar_url'>>();
  if (userIds.size > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', Array.from(userIds));
    
    if (profilesError) {
      console.warn('Warning fetching profiles for tasks:', formatSupabaseError(profilesError, 'fetchProfilesForTasks'));
    } else if (profilesData) {
      profilesData.forEach(p => profilesMap.set(p.id, { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url }));
    }
  }
  return profilesMap;
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

const getProgressForStatus = (status: TaskStatus, currentProgress?: number): number => {
  switch (status) {
    case TaskStatus.TODO: return 0;
    case TaskStatus.IN_PROGRESS: return (currentProgress === 0 || currentProgress === undefined) ? 25 : (currentProgress === 100 ? 25 : currentProgress) ;
    case TaskStatus.REVIEW: return (currentProgress !== undefined && currentProgress < 90) ? 90 : (currentProgress === 100 ? 90 : currentProgress);
    case TaskStatus.COMPLETED: return 100;
    default: return currentProgress ?? 0;
  }
};

const TASK_BASE_SELECT_QUERY = `*, task_tags (tag_name)`;

// New helper function to fetch projects for a list of tasks and combine them
const fetchAndCombineProjectsForTasks = async (tasks: DbTask[]): Promise<(DbTask & { projects: any })[]> => {
    if (!tasks || tasks.length === 0) return tasks.map(t => ({ ...t, projects: null }));

    const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
    if (projectIds.length === 0) {
        return tasks.map(t => ({ ...t, projects: null }));
    }

    const projectsMap = new Map();
    try {
        const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select('id, name, team_id')
            .in('id', projectIds);

        if (projectsError) {
             throw new Error(formatSupabaseError(projectsError, 'fetchAndCombineProjectsForTasks'));
        }
        
        if (projectsData) {
            projectsData.forEach(p => projectsMap.set(p.id, p));
        }
    } catch(error) {
        console.warn(`Could not fetch some project details for tasks due to error:`, error);
        // Continue without project data if it fails, so the app doesn't crash
    }

    return tasks.map(task => ({
        ...task,
        projects: task.project_id ? projectsMap.get(task.project_id) : null,
    }));
};

export const taskService = {
  async getUserProfile(userId: string): Promise<UserPublicProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching profile for user ${userId}:`, formatSupabaseError(error, 'taskService.getUserProfile'));
        return null;
      }
      
      return data ? mapUserProfileToPublicProfile(data) : null;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  },

  async getAllTasks(): Promise<Task[]> {
    try {
      const user = await getCurrentUser();
      
      // Step 1: Get all project IDs the user has access to.
      const { data: projectMemberships, error: projectIdsError } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);
  
      if (projectIdsError) {
          throw new Error(formatSupabaseError(projectIdsError, "getAllTasks (fetching project memberships)"));
      }
      const accessibleProjectIds = projectMemberships?.map(p => p.project_id) || [];
      
      // Step 2: Fetch all tasks from those projects
      let projectTasks: DbTask[] = [];
      if(accessibleProjectIds.length > 0) {
          const { data: projTasksData, error: projTasksError } = await supabase
              .from('tasks')
              .select(TASK_BASE_SELECT_QUERY)
              .in('project_id', accessibleProjectIds);
          if(projTasksError) {
              console.warn(`Could not fetch some project tasks: ${formatSupabaseError(projTasksError, "getAllTasks (project tasks)")}`);
          } else {
              projectTasks = projTasksData || [];
          }
      }
  
      // Step 3: Fetch all personal tasks (not associated with a project)
      const { data: personalTasksData, error: personalTasksError } = await supabase
          .from('tasks')
          .select(TASK_BASE_SELECT_QUERY)
          .is('project_id', null)
          .or(`user_id.eq.${user.id},assigned_to.eq.${user.id},assigner_id.eq.${user.id}`);
  
      if (personalTasksError) {
          throw new Error(formatSupabaseError(personalTasksError, "getAllTasks (personal tasks)"));
      }
  
      // Step 4: Combine and deduplicate
      const allTasksData = [...projectTasks, ...(personalTasksData || [])];
      const uniqueTasks = Array.from(new Map(allTasksData.map(task => [task.id, task])).values());
  
      // Step 5: Fetch related data and map
      if (uniqueTasks.length === 0) return [];
  
      const tasksWithProjects = await fetchAndCombineProjectsForTasks(uniqueTasks);
      const profilesMap = await fetchProfilesForTasks(uniqueTasks);
      return tasksWithProjects.map(t => mapDbTaskToFrontend(t as any, profilesMap));
  
    } catch (error: any) {
      const errorMessage = error.message || "Failed to get all tasks.";
      console.error(`Critical error in taskService.getAllTasks: ${errorMessage}`, error);
      throw new Error(errorMessage);
    }
  },

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    try {
      const user = await getCurrentUser();
      
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select(TASK_BASE_SELECT_QUERY)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id},assigner_id.eq.${user.id}`)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(formatSupabaseError(error, "taskService.getTasksByStatus (fetch)"));
      }
      if (!tasksData) return [];
      
      const tasksWithProjects = await fetchAndCombineProjectsForTasks(tasksData);
      const profilesMap = await fetchProfilesForTasks(tasksData);
      return tasksWithProjects.map(t => mapDbTaskToFrontend(t as any, profilesMap));
    } catch (error: any)
       {
      const errorMessage = error.message || "Failed to get tasks by status.";
      console.error(`Critical error in taskService.getTasksByStatus: ${errorMessage}`, error);
      throw new Error(errorMessage);
    }
  },

  async getConnections(): Promise<Array<{id: string, name: string, email: string}>> {
    try {
      const user = await getCurrentUser();
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('connections')
        .select('user_a_id, user_b_id')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

      if (connectionsError) {
        throw new Error(formatSupabaseError(connectionsError, "taskService.getConnections (fetch connections)"));
      }
      if (!connectionsData || connectionsData.length === 0) return [];

      const connectedUserIds = connectionsData
        .map(conn => conn.user_a_id === user.id ? conn.user_b_id : conn.user_a_id)
        .filter(id => id !== null && id !== user.id);

      if (connectedUserIds.length === 0) return [];
        
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', connectedUserIds);

      if (profilesError) {
        throw new Error(formatSupabaseError(profilesError, "taskService.getConnections (fetch profiles)"));
      }
      if (!userProfiles) return [];

      return userProfiles.map(profile => ({
        id: profile.id,
        name: profile.full_name || profile.email?.split('@')[0] || 'Unknown User',
        email: profile.email || 'No email'
      })).filter(conn => conn.id && conn.name !== 'Unknown User');
    } catch (error: any) {
        const errorMessage = error.message || "Failed to get connections.";
        console.error(`Critical error in taskService.getConnections: ${errorMessage}`, error);
        throw new Error(errorMessage);
    }
  },
  
  // Enhanced createTask to support multiple assignees
  async createTask(taskData: Partial<Task> & { projectId?: string; assigneeIds?: string[] }): Promise<Task[]> {
    try {
        validateTaskData({title: taskData.title, ...taskData});
        const user = await getCurrentUser();

        const assigneeIds = taskData.assigneeIds || [user.id];
        const status = taskData.status || TaskStatus.TODO;
        const progress = getProgressForStatus(status);
        const now = new Date().toISOString();

        const createdTasks: Task[] = [];

        // Create separate task for each assignee
        for (const assigneeId of assigneeIds) {
          let finalAssignerId = null;
          if (assigneeId !== user.id) { 
              finalAssignerId = user.id;
          }

          const taskToInsert: Database['public']['Tables']['tasks']['Insert'] = {
            title: taskData.title!.trim(), 
            description: taskData.description?.trim() || null,
            due_date: taskData.dueDate || new Date().toISOString().split('T')[0],
            priority: taskData.priority || TaskPriority.MEDIUM,
            status: status,
            project_id: taskData.projectId?.trim() ? taskData.projectId : null,
            assigned_to: assigneeId,
            assigner_id: finalAssignerId,
            progress: progress,
            user_id: user.id,
            created_at: now,
            updated_at: now,
            dependencies: taskData.dependencies,
          };
          
          if (status === TaskStatus.COMPLETED && !taskData.completedAt) {
            taskToInsert.completed_at = now;
          }

          const { data: task, error: taskError } = await supabase
            .from('tasks')
            .insert([taskToInsert])
            .select()
            .single();

          if (taskError) {
              throw new Error(formatSupabaseError(taskError, "taskService.createTask (insert task)"));
          }

          // Add tags for this task
          if (taskData.tags && taskData.tags.length > 0) {
            const validTags = taskData.tags.filter(tag => tag?.trim()).map(tag => tag.trim()).slice(0, 10);
            if (validTags.length > 0) {
              const tagInserts = validTags.map(tagItem => ({ task_id: task.id, tag_name: tagItem }));
              const { error: tagsError } = await supabase.from('task_tags').insert(tagInserts);
              if (tagsError) console.warn('Warning: Error inserting tags during task creation:', formatSupabaseError(tagsError, 'createTask tags'));
            }
          }
          
          const fullTaskData = await this.getTaskById(task.id); 
          if (!fullTaskData) throw new Error("Task creation succeeded but failed to retrieve the created task.");
          
          createdTasks.push(fullTaskData);

          // Send notification if task is assigned to someone other than the creator
          if (assigneeId !== user.id) {
            try {
              const assignerProfile = await this.getUserProfile(user.id);
              const assignerName = assignerProfile?.full_name || 'Someone';
              
              await notificationService.createEnhancedTaskNotification(
                assigneeId,
                'task_assigned',
                fullTaskData.title,
                fullTaskData.id,
                assignerName,
                fullTaskData.dueDate
              );

              // Create deadline reminder if task has due date
              // TODO: Implement deadline reminder service
              // if (fullTaskData.dueDate) {
              //   await deadlineReminderService.createDeadlineReminder(
              //     fullTaskData.id,
              //     assigneeId,
              //     fullTaskData.dueDate
              //   );
              // }
            } catch (notificationError) {
              console.warn('Failed to send task assignment notification:', notificationError);
            }
          }
        }

        return createdTasks;

    } catch (error: any) {
        const errorMessage = error.message || "Failed to create task.";
        console.error(`Critical error in taskService.createTask: ${errorMessage}`, error);
        throw new Error(errorMessage);
    }
  },

  // Legacy single task creation for backward compatibility
  async createSingleTask(taskData: Partial<Task> & { projectId?: string; assigneeId?: string }): Promise<Task> {
    const tasks = await this.createTask({
      ...taskData,
      assigneeIds: taskData.assigneeId ? [taskData.assigneeId] : undefined
    });
    return tasks[0];
  },

   async getTaskById(taskId: string): Promise<Task | null> { 
    try {
      if (!taskId?.trim()) return null;
      const { data: taskData, error } = await supabase
        .from('tasks')
        .select(TASK_BASE_SELECT_QUERY)
        .eq('id', taskId)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return null; 
        throw new Error(formatSupabaseError(error, `taskService.getTaskById (${taskId})`));
      }
      if (!taskData) return null;

      const [taskWithProject] = await fetchAndCombineProjectsForTasks([taskData]);
      const profilesMap = await fetchProfilesForTasks([taskData]);
      return mapDbTaskToFrontend(taskWithProject as any, profilesMap);

    } catch (error: any) {
        const errorMessage = error.message || `Failed to get task by ID ${taskId}.`;
        console.error(`Critical error in taskService.getTaskById: ${errorMessage}`, error);
        throw new Error(errorMessage);
    }
  },
  
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
        validateTaskData(updates);
        if (!taskId) throw new Error("Task ID is required for update.");
        
        if (updates.status === TaskStatus.COMPLETED) {
          const { data: taskWithDeps, error: fetchError } = await supabase
            .from('tasks')
            .select('dependencies')
            .eq('id', taskId)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`Could not fetch dependencies for task ${taskId}:`, fetchError.message);
            throw new Error("Could not verify task dependencies due to a database error. Please try again.");
          }

          if (taskWithDeps && taskWithDeps.dependencies && taskWithDeps.dependencies.length > 0) {
            const { data: dependencies, error: depsError } = await supabase
              .from('tasks')
              .select('title, status')
              .in('id', taskWithDeps.dependencies);
            
            if (depsError) {
              console.error(`Could not fetch dependency tasks for task ${taskId}:`, depsError.message);
              throw new Error("Could not verify task dependencies status. Please try again.");
            }
            
            if(dependencies) {
                const incompleteDeps = dependencies.filter(dep => dep.status !== TaskStatus.COMPLETED);
                
                if (incompleteDeps.length > 0) {
                  const incompleteTitles = incompleteDeps.map(dep => `"${dep.title}"`).join(', ');
                  throw new Error(`Cannot complete task. The following dependencies are not yet complete: ${incompleteTitles}.`);
                }
            }
          }
        }
        
        let dbUpdate: Database['public']['Tables']['tasks']['Update'] = {
            updated_at: new Date().toISOString()
        };

        if (updates.title !== undefined) dbUpdate.title = updates.title.trim();
        if (updates.description !== undefined) dbUpdate.description = updates.description.trim() || null;
        if (updates.dueDate !== undefined) dbUpdate.due_date = updates.dueDate;
        if (updates.priority !== undefined) dbUpdate.priority = updates.priority;
        if (updates.progress !== undefined) dbUpdate.progress = updates.progress;
        if (updates.status !== undefined) {
            dbUpdate.status = updates.status;
            dbUpdate.progress = getProgressForStatus(updates.status, updates.progress);
            if(updates.status === TaskStatus.COMPLETED && !updates.completedAt) {
              dbUpdate.completed_at = new Date().toISOString();
            } else if (updates.status !== TaskStatus.COMPLETED) {
              dbUpdate.completed_at = null;
            }
        }
        if (updates.completedAt !== undefined) dbUpdate.completed_at = updates.completedAt;
        if (updates.projectId !== undefined) dbUpdate.project_id = updates.projectId || null;
        if (updates.assignedTo !== undefined) dbUpdate.assigned_to = updates.assignedTo || null;
        if (updates.assignedBy !== undefined) dbUpdate.assigner_id = updates.assignedBy || null;
        if (updates.dependencies !== undefined) dbUpdate.dependencies = updates.dependencies;

        const { data, error: updateError } = await supabase
            .from('tasks')
            .update(dbUpdate)
            .eq('id', taskId)
            .select()
            .single();

        if (updateError) throw new Error(formatSupabaseError(updateError, "updateTask"));
        
        if (updates.tags !== undefined) {
            const { error: deleteTagsError } = await supabase.from('task_tags').delete().eq('task_id', taskId);
            if (deleteTagsError) console.warn("Warning: Could not clear old tags during update:", formatSupabaseError(deleteTagsError, 'updateTask delete tags'));
            
            const validTags = updates.tags.filter(tag => tag?.trim()).map(tag => tag.trim());
            if (validTags.length > 0) {
                const tagInserts = validTags.map(tagItem => ({ task_id: taskId, tag_name: tagItem }));
                const { error: insertTagsError } = await supabase.from('task_tags').insert(tagInserts);
                if (insertTagsError) console.warn("Warning: Could not insert new tags during update:", formatSupabaseError(insertTagsError, 'updateTask insert tags'));
            }
        }
        
        const updatedTask = await this.getTaskById(taskId);
        if(!updatedTask) throw new Error("Task updated but failed to retrieve it.");
        
        // Send notifications for task completion or assignment changes
        try {
          const user = getCurrentUser();
          const currentUserId = (await user).id;
          
          // Notify about task completion
          if (updates.status === TaskStatus.COMPLETED && updatedTask.assignedBy && updatedTask.assignedBy !== currentUserId) {
            const assignerProfile = await this.getUserProfile(currentUserId);
            const assignerName = assignerProfile?.full_name || 'Someone';
            
            await notificationService.createEnhancedTaskNotification(
              updatedTask.assignedBy,
              'task_completed',
              updatedTask.title,
              updatedTask.id,
              assignerName,
              updatedTask.dueDate
            );
          }
          
          // Notify about reassignment
          if (updates.assignedTo && updatedTask.assignedTo !== currentUserId) {
            const assignerProfile = await this.getUserProfile(currentUserId);
            const assignerName = assignerProfile?.full_name || 'Someone';
            
            await notificationService.createEnhancedTaskNotification(
              updatedTask.assignedTo,
              'task_assigned',
              updatedTask.title,
              updatedTask.id,
              assignerName,
              updatedTask.dueDate
            );

            // Create deadline reminder for new assignee
            // TODO: Implement deadline reminder service
            // if (updatedTask.dueDate) {
            //   await deadlineReminderService.createDeadlineReminder(
            //     updatedTask.id,
            //     updatedTask.assignedTo,
            //     updatedTask.dueDate
            //   );
            // }
          }

          // Handle deadline changes
          // TODO: Implement deadline reminder service
          // if (updates.dueDate && updatedTask.assignedTo) {
          //   await deadlineReminderService.updateDeadlineReminder(
          //     updatedTask.id,
          //     updatedTask.assignedTo,
          //     updatedTask.dueDate
          //   );
          // }

          // Delete reminders when task is completed
          // TODO: Implement deadline reminder service
          // if (updates.status === TaskStatus.COMPLETED) {
          //   await deadlineReminderService.deleteDeadlineReminders(updatedTask.id);
          // }
        } catch (notificationError) {
          console.warn('Failed to send task update notification:', notificationError);
        }
        
        return updatedTask;

    } catch(error: any) {
        throw new Error(error.message || `Failed to update task ${taskId}.`);
    }
  },

  async updateTaskStatus(taskId: string, newStatus: TaskStatus, oldStatus?: TaskStatus): Promise<Task> {
    const progress = getProgressForStatus(newStatus);
    const completedAt = newStatus === TaskStatus.COMPLETED ? new Date().toISOString() : undefined;
    return this.updateTask(taskId, { status: newStatus, progress, completedAt });
  },

  async deleteTask(taskId: string): Promise<boolean> {
    try {
        if (!taskId) throw new Error("Task ID is required for deletion.");
        
        await supabase.from('task_tags').delete().eq('task_id', taskId);
        await supabase.from('project_updates').update({ related_task_id: null }).eq('related_task_id', taskId); 
        await supabase.from('calendar_events').delete().eq('task_id', taskId);
        
        // Delete deadline reminders
        // TODO: Implement deadline reminder service
        // await deadlineReminderService.deleteDeadlineReminders(taskId);

        const { error: deleteTaskError } = await supabase.from('tasks').delete().eq('id', taskId);
        if (deleteTaskError) throw new Error(formatSupabaseError(deleteTaskError, 'deleteTask'));
        
        return true;
    } catch (error: any) {
        throw new Error(error.message || `Failed to delete task ${taskId}.`);
    }
  },
  
  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query.trim()) return [];
    const userIdToQuery = currentUserId || (await getCurrentUser()).id;

    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select('id, title, description, created_at, project_id') // Fetch project_id to get project name
      .or(`user_id.eq.${userIdToQuery},assigned_to.eq.${userIdToQuery},assigner_id.eq.${userIdToQuery}`)
      .ilike('title', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching tasks:', formatSupabaseError(error, 'taskService.search'));
      return [];
    }
    if (!tasksData) return [];

    const projectIds = Array.from(new Set(tasksData.map(t => t.project_id).filter(Boolean))) as string[];
    const projectsMap = new Map<string, { name: string }>();
    
    if(projectIds.length > 0) {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      if (projectsError) console.warn("Error fetching project names for task search results");
      else projectsData?.forEach(p => projectsMap.set(p.id, { name: p.name }));
    }

    return tasksData.map(task => ({
      id: task.id,
      title: task.title,
      type: 'task',
      description: task.project_id ? `Project: ${projectsMap.get(task.project_id)?.name || '...'}` : (task.description || 'Task'),
      icon: CheckBadgeIcon,
      path: '/app/tasks',
      state: { openTaskInfoModal: true, taskId: task.id }, 
      timestamp: task.created_at,
    }));
  },
};