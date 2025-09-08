import { supabase } from './supabaseClient';
import { Note, NoteCategory, GlobalSearchResultItem } from './types';
import { Database } from './types_db';
import { DocumentTextIcon } from './constants'; // For search result icon

type DbNote = Database['public']['Tables']['notes']['Row'];

// Helper to get current user or throw error
const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user for notes:", error.message);
    throw new Error(`Authentication error: ${error.message}`);
  }
  if (!user) {
    throw new Error("User not authenticated. Please sign in to manage notes.");
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

// Helper to map DB note to frontend Note
const mapDbNoteToFrontend = (dbNote: DbNote): Note => {
  return {
    id: dbNote.id,
    title: dbNote.title,
    content: dbNote.content,
    date: dbNote.updated_at, // Use updated_at as the primary date for frontend
    category: dbNote.category as NoteCategory,
    tags: dbNote.tags || [],
    isFavorite: dbNote.is_favorite || false,
    url: dbNote.url || undefined,
    author: dbNote.author || undefined,
    attendees: dbNote.attendees || [],
    actionItems: dbNote.action_items || [],
    userId: dbNote.user_id,
  };
};

const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

export const noteService = {
  async getAllNotesForUser(): Promise<Note[]> {
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }); // Order by updated_at

      if (error) throw new Error(formatSupabaseError(error, "noteService.getAllNotesForUser"));
      return data.map(mapDbNoteToFrontend);
    } catch (error: any) {
      throw new Error(error.message || "Failed to get all notes.");
    }
  },

  async createNote(noteData: Partial<Note>): Promise<Note> {
    try {
      const user = await getCurrentUser();
      if (!noteData.title?.trim() && noteData.category === NoteCategory.GENERAL) {
        noteData.title = "Untitled Note"; // Default title for general notes if empty
      } else if (!noteData.title?.trim()) {
         throw new Error("Note title cannot be empty.");
      }

      const now = new Date().toISOString();
      const noteToInsert: Database['public']['Tables']['notes']['Insert'] = {
        title: noteData.title!.trim(),
        content: noteData.content || (noteData.category === NoteCategory.GENERAL ? "<p><br></p>" : ""),
        category: noteData.category!,
        tags: noteData.tags || [],
        is_favorite: noteData.isFavorite || false,
        url: noteData.url || null,
        author: noteData.author || null,
        attendees: noteData.attendees || [],
        action_items: noteData.actionItems || [],
        user_id: user.id,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('notes')
        .insert([noteToInsert])
        .select()
        .single();

      if (error) throw new Error(formatSupabaseError(error, "noteService.createNote"));
      return mapDbNoteToFrontend(data);
    } catch (error: any) {
      throw new Error(error.message || "Failed to create note.");
    }
  },

  async updateNote(noteId: string, updates: Partial<Note>): Promise<Note> {
    try {
      await getCurrentUser(); // Ensure user is authenticated
      if (!noteId) throw new Error("Note ID is required for update.");
      if (updates.title !== undefined && !updates.title.trim() && updates.category === NoteCategory.GENERAL) {
        updates.title = "Untitled Note";
      } else if (updates.title !== undefined && !updates.title.trim()) {
        throw new Error("Note title cannot be empty.");
      }

      const noteToUpdate: Database['public']['Tables']['notes']['Update'] = {
        title: updates.title?.trim(),
        content: updates.content,
        // date field removed, updated_at will be set
        category: updates.category,
        tags: updates.tags,
        is_favorite: updates.isFavorite,
        url: updates.url,
        author: updates.author,
        attendees: updates.attendees,
        action_items: updates.actionItems,
        updated_at: new Date().toISOString(), // Always update modified date
      };
      
      // Remove undefined fields so they don't overwrite existing data with null, unless explicitly set to null
      Object.keys(noteToUpdate).forEach(keyStr => {
          const key = keyStr as keyof typeof noteToUpdate;
          if (noteToUpdate[key] === undefined) {
            delete noteToUpdate[key];
          }
      });


      const { data, error } = await supabase
        .from('notes')
        .update(noteToUpdate)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw new Error(formatSupabaseError(error, `noteService.updateNote (ID: ${noteId})`));
      return mapDbNoteToFrontend(data);
    } catch (error: any) {
      throw new Error(error.message || "Failed to update note.");
    }
  },

  async deleteNote(noteId: string): Promise<boolean> {
    try {
      await getCurrentUser(); // Ensure user is authenticated
      if (!noteId) throw new Error("Note ID is required for deletion.");

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw new Error(formatSupabaseError(error, `noteService.deleteNote (ID: ${noteId})`));
      return true;
    } catch (error: any) {
      throw new Error(error.message || "Failed to delete note.");
    }
  },

  async search(query: string, currentUserId?: string): Promise<GlobalSearchResultItem[]> {
    if (!query.trim()) return [];
    const userIdToQuery = currentUserId || (await getCurrentUser()).id;

    const { data: notesData, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userIdToQuery)
      // Supabase textSearch (tsvector) would be better here, but for simplicity using ilike
      // To use textSearch, you'd need a tsvector column and query like .textSearch('content_tsvector', query)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`) // Basic search on title and raw content
      .limit(10);

    if (error) {
      console.error('Error searching notes:', formatSupabaseError(error, 'noteService.search'));
      return [];
    }
    if (!notesData) return [];
    
    return notesData.map(note => ({
      id: note.id,
      title: note.title,
      type: 'note',
      description: stripHtml(note.content).substring(0, 100) + (stripHtml(note.content).length > 100 ? '...' : ''),
      icon: DocumentTextIcon,
      path: '/app/notes', // Path to the notes page
      state: { openNoteId: note.id, fromSearch: true }, // State to indicate which note to open/highlight
      timestamp: note.updated_at,
    }));
  }
};