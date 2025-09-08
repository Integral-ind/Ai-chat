import { supabase } from './supabaseClient';
import { CalendarEvent, GlobalSearchResultItem } from './types';
import { Database } from './types_db';
import { CalendarDaysIcon } from './constants'; // For search result icon

type DbCalendarEvent = Database['public']['Tables']['calendar_events']['Row'];

// Helper to get current user or throw error
const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not authenticated");
  return user;
};

// Helper to map DB event to frontend CalendarEvent
const mapDbEventToFrontend = (dbEvent: DbCalendarEvent): CalendarEvent => {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description || undefined,
    date: dbEvent.date,
    startTime: dbEvent.start_time || undefined,
    endTime: dbEvent.end_time || undefined,
    color: dbEvent.color,
    calendarType: dbEvent.calendar_type as CalendarEvent['calendarType'],
    userId: dbEvent.user_id,
    projectId: dbEvent.project_id || undefined,
    taskId: dbEvent.task_id || undefined,
  };
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

export const calendarService = {
  async getAllEventsForUser(): Promise<CalendarEvent[]> {
    try {
      const user = await getCurrentUser();
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id) // Explicitly filter by current user
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data.map(mapDbEventToFrontend);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  },

  async getEventsForDateRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    try {
      const user = await getCurrentUser();
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data.map(mapDbEventToFrontend);
    } catch (error) {
      console.error('Error fetching calendar events for date range:', error);
      throw error;
    }
  },

  async getEventsForProject(projectId: string): Promise<CalendarEvent[]> {
    try {
      const user = await getCurrentUser();
      
      // Validate project belongs to user
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();
        
      if (projectError || !project) {
        throw new Error("Project not found or access denied");
      }
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data.map(mapDbEventToFrontend);
    } catch (error) {
      console.error('Error fetching project calendar events:', error);
      throw error;
    }
  },

  async getEventsForTask(taskId: string): Promise<CalendarEvent[]> {
    try {
      const user = await getCurrentUser();
      
      // Validate task belongs to user
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .single();
        
      if (taskError || !task) {
        throw new Error("Task not found or access denied");
      }
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_id', taskId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data.map(mapDbEventToFrontend);
    } catch (error) {
      console.error('Error fetching task calendar events:', error);
      throw error;
    }
  },

  async createEvent(eventData: Partial<CalendarEvent> & { projectId?: string; taskId?: string }): Promise<CalendarEvent> {
    try {
      const user = await getCurrentUser();

      // Validate project belongs to user if projectId is provided
      if (eventData.projectId) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('id', eventData.projectId)
          .eq('user_id', user.id)
          .single();
          
        if (projectError || !project) {
          throw new Error("Project not found or access denied");
        }
      }

      // Validate task belongs to user if taskId is provided
      if (eventData.taskId) {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('id')
          .eq('id', eventData.taskId)
          .eq('user_id', user.id)
          .single();
          
        if (taskError || !task) {
          throw new Error("Task not found or access denied");
        }
      }

      const eventToInsert: Database['public']['Tables']['calendar_events']['Insert'] = {
        title: eventData.title!,
        description: eventData.description || null,
        date: eventData.date!,
        start_time: eventData.startTime || null,
        end_time: eventData.endTime || null,
        color: eventData.color!,
        calendar_type: eventData.calendarType!,
        user_id: user.id,
        project_id: eventData.projectId || null,
        task_id: eventData.taskId || null,
      };

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([eventToInsert])
        .select()
        .single();

      if (error) throw error;
      return mapDbEventToFrontend(data);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const user = await getCurrentUser();

      // Validate project belongs to user if projectId is provided in updates
      if (updates.projectId) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('id', updates.projectId)
          .eq('user_id', user.id)
          .single();
          
        if (projectError || !project) {
          throw new Error("Project not found or access denied");
        }
      }

      // Validate task belongs to user if taskId is provided in updates
      if (updates.taskId) {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('id')
          .eq('id', updates.taskId)
          .eq('user_id', user.id)
          .single();
          
        if (taskError || !task) {
          throw new Error("Task not found or access denied");
        }
      }

      const eventToUpdate: Database['public']['Tables']['calendar_events']['Update'] = {
        title: updates.title,
        description: updates.description,
        date: updates.date,
        start_time: updates.startTime,
        end_time: updates.endTime,
        color: updates.color,
        calendar_type: updates.calendarType,
        project_id: updates.projectId,
        task_id: updates.taskId,
        updated_at: new Date().toISOString(),
      };
      
      // Remove undefined fields so they don't overwrite existing data with null
      Object.keys(eventToUpdate).forEach(key => 
        eventToUpdate[key as keyof typeof eventToUpdate] === undefined && 
        delete eventToUpdate[key as keyof typeof eventToUpdate]
      );

      const { data, error } = await supabase
        .from('calendar_events')
        .update(eventToUpdate)
        .eq('id', eventId)
        .eq('user_id', user.id) // Ensure user can only update their own events
        .select()
        .single();

      if (error) throw error;
      return mapDbEventToFrontend(data);
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id); // Ensure user can only delete their own events

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  async getEventById(eventId: string): Promise<CalendarEvent | null> {
    try {
      const user = await getCurrentUser();
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .eq('user_id', user.id) // Ensure user can only get their own events
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return data ? mapDbEventToFrontend(data) : null;
    } catch (error) {
      console.error(`Error fetching event ${eventId}:`, error);
      throw error;
    }
  },

  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query.trim()) return [];
    const userIdToQuery = currentUserId || (await getCurrentUser()).id;

    const { data: eventsData, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userIdToQuery)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching calendar events:', formatSupabaseError(error, 'calendarService.search'));
      return [];
    }
    if (!eventsData) return [];
    
    const frontendEvents = eventsData.map(mapDbEventToFrontend);

    return frontendEvents.map(event => ({
      id: event.id,
      title: event.title,
      type: 'calendarEvent',
      description: `${event.date}${event.startTime ? ` at ${event.startTime}` : ''}`,
      icon: CalendarDaysIcon,
      path: '/app/calendar',
      state: { selectedDate: event.date, eventId: event.id, fromSearch: true }, // State to navigate to date and highlight event
      timestamp: event.date,
    }));
  }
};