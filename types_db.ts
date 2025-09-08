export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_rooms: {
        Row: {
          id: string
          name: string
          type: "direct" | "group"
          created_at: string
          updated_at: string
          created_by: string
          is_active: boolean
        }
        Insert: {
          id: string
          name: string
          type: "direct" | "group"
          created_at?: string
          updated_at?: string
          created_by: string
          is_active?: boolean
        }
        Update: {
          name?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      room_participants: {
        Row: {
          room_id: string
          user_id: string
          role: "admin" | "member"
          joined_at: string
        }
        Insert: {
          room_id: string
          user_id: string
          role?: "admin" | "member"
          joined_at?: string
        }
        Update: {
          role?: "admin" | "member"
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
            onDelete: "cascade"
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
            onDelete: "cascade"
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          sender_id: string
          content: string
          message_type: string
          created_at: string
          updated_at: string
          is_edited: boolean
        }
        Insert: {
          id?: string
          room_id: string
          sender_id: string
          content: string
          message_type?: string
          created_at?: string
          updated_at?: string
          is_edited?: boolean
        }
        Update: {
          content?: string
          updated_at?: string
          is_edited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
            onDelete: "cascade"
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
            onDelete: "set null"
          }
        ]
      }
      team_invites: {
        Row: {
          id: string
          team_id: string
          created_by: string
          expires_at: string
          created_at: string
          uses_left: number | null
          role: string
          invite_code: string | null
        }
        Insert: {
          id?: string
          team_id: string
          created_by: string
          expires_at: string
          created_at?: string
          uses_left?: number | null
          role?: string
          invite_code?: string | null
        }
        Update: {
          uses_left?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      focus_sessions: { 
        Row: {
          id: string
          user_id: string
          date: string 
          duration_ms: number
          created_at: string 
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          duration_ms: number
          created_at?: string
        }
        Update: {
          date?: string
          duration_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          }
        ]
      }
      messages: { 
        Row: {
          id: string 
          sender_id: string
          receiver_id: string
          content: string
          created_at: string
          updated_at: string | null
          is_read: boolean | null
          message_type: string | null
        }
        Insert: {
          id?: string 
          sender_id: string
          receiver_id: string
          content: string
          created_at?: string
          updated_at?: string | null
          is_read?: boolean | null
          message_type?: string | null
        }
        Update: {
          content?: string
          updated_at?: string | null
          is_read?: boolean | null
          message_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          }
        ]
      }
      teams: { 
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          icon_seed: string | null
          created_at: string
          updated_at: string
          photo_url: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          icon_seed?: string | null
          created_at?: string
          updated_at?: string
          photo_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          icon_seed?: string | null
          updated_at?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      team_members: { 
        Row: {
          id: string | null
          team_id: string
          user_id: string
          role: string 
          joined_at: string
          tags: string[] | null 
          permissions: string[] | null 
          email: string | null
          invited: boolean | null
          accepted: boolean | null
          created_at: string | null
          updated_at: string | null
          invite_token: string | null
        }
        Insert: {
          id?: string | null
          team_id: string
          user_id: string
          role?: string
          joined_at?: string
          tags?: string[] | null 
          permissions?: string[] | null 
          email?: string | null
          invited?: boolean | null
          accepted?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          invite_token?: string | null
        }
        Update: {
          id?: string | null
          role?: string
          tags?: string[] | null 
          permissions?: string[] | null 
          email?: string | null
          invited?: boolean | null
          accepted?: boolean | null
          updated_at?: string | null
          invite_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      departments: { 
        Row: {
          id: string
          name: string
          team_id: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          team_id: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      department_members: { 
        Row: {
          id: string
          department_id: string
          user_id: string
          created_at: string
          updated_at: string | null
          role: string
          department_role: string | null
        }
        Insert: {
          id?: string
          department_id: string
          user_id: string
          created_at?: string
          updated_at?: string | null
          role?: string
          department_role?: string | null
        }
        Update: {
          updated_at?: string | null
          role?: string
          department_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          id: string 
          name: string
          description: string | null
          created_at: string
          updated_at: string
          user_id: string | null 
          owner_id: string 
          team_id: string | null 
          due_date: string | null 
          priority: string | null
          scope_type: string | null
          visibility: string | null
          photo_url: string | null
          department_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          owner_id: string 
          team_id?: string | null
          due_date?: string | null
          priority?: string | null
          scope_type?: string | null
          visibility?: string | null
          photo_url?: string | null
          department_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          owner_id?: string
          team_id?: string | null
          due_date?: string | null
          priority?: string | null
          scope_type?: string | null
          visibility?: string | null
          photo_url?: string | null
          department_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey" 
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey" 
            columns: ["owner_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          },
          { 
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      project_members: { 
        Row: {
          id: string | null
          project_id: string
          user_id: string
          role: string 
          joined_at: string 
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          project_id: string
          user_id: string
          role?: string 
          joined_at?: string 
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          }
        ]
      }
      project_updates: {
        Row: {
          id: string
          project_id: string
          author_id: string
          content: string
          type: string 
          related_task_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          author_id: string
          content: string
          type: string
          related_task_id?: string | null
          created_at?: string
        }
        Update: {
          content?: string
          type?: string
          related_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_related_task_id_fkey"
            columns: ["related_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      project_resources: { 
        Row: {
          id: string
          project_id: string
          name: string
          type: string 
          url: string 
          uploaded_by_user_id: string
          description: string | null
          size_bytes: number | null 
          created_at: string
          original_resource_id: string | null 
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type: string
          url: string
          uploaded_by_user_id: string
          description?: string | null
          size_bytes?: number | null
          created_at?: string
          original_resource_id?: string | null
        }
        Update: {
          name?: string
          type?: string
          url?: string
          description?: string | null
          size_bytes?: number | null
          original_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_resources_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          { 
            foreignKeyName: "project_resources_original_resource_id_fkey"
            columns: ["original_resource_id"]
            referencedRelation: "resources" 
            referencedColumns: ["id"]
            onDelete: "SET NULL" 
          }
        ]
      }
      project_department_assignments: {
        Row: {
          id: string
          project_id: string
          department_id: string
          assigned_by: string | null
          assigned_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          department_id: string
          assigned_by?: string | null
          assigned_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_department_assignments_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_department_assignments_department_id_fkey"
            columns: ["department_id"]
            referencedRelation: "departments"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string 
          title: string
          description: string | null
          due_date: string | null 
          priority: string | null 
          status: string 
          project_id: string | null 
          assigned_to: string | null 
          assigner_id: string | null 
          progress: number | null 
          completed_at: string | null 
          created_at: string
          updated_at: string
          user_id: string | null 
          estimated_hours: number | null 
          dependencies: string[] | null 
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          due_date?: string | null
          priority?: string | null
          status: string
          project_id?: string | null
          assigned_to?: string | null
          assigner_id?: string | null
          progress?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          estimated_hours?: number | null 
          dependencies?: string[] | null   
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          priority?: string | null
          status?: string
          project_id?: string | null
          assigned_to?: string | null
          assigner_id?: string | null
          progress?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
          estimated_hours?: number | null 
          dependencies?: string[] | null   
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          },
           {
            foreignKeyName: "tasks_assigner_id_fkey"
            columns: ["assigner_id"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      task_tags: {
        Row: {
          id: string | null
          task_id: string 
          tag_name: string
          created_at: string | null
        }
        Insert: {
          id?: string | null
          task_id: string
          tag_name: string
          created_at?: string | null
        }
        Update: {
          id?: string | null
          task_id?: string
          tag_name?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      calendar_events: {
        Row: {
          id: string 
          title: string
          description: string | null 
          date: string 
          start_time: string | null
          end_time: string | null
          color: string 
          calendar_type: string 
          user_id: string 
          project_id: string | null 
          task_id: string | null 
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          date: string
          start_time?: string | null
          end_time?: string | null
          color: string
          calendar_type: string
          user_id: string
          project_id?: string | null
          task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          date?: string
          start_time?: string | null
          end_time?: string | null
          color?: string
          calendar_type?: string
          user_id?: string
          project_id?: string | null
          task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      user_profiles: {
        Row: {
          id: string 
          full_name: string | null
          avatar_url: string | null
          email: string | null 
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null 
          updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null 
          updated_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      connection_requests: {
        Row: {
          id: string 
          sender_id: string 
          receiver_id: string 
          status: string 
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      connections: {
        Row: {
          id: string 
          user_a_id: string 
          user_b_id: string 
          created_at: string
          status: string | null
        }
        Insert: {
          id?: string
          user_a_id: string
          user_b_id: string
          created_at?: string
          status?: string | null
        }
        Update: {
          id?: string
          user_a_id?: string
          user_b_id?: string
          created_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_user_a_id_fkey"
            columns: ["user_a_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_user_b_id_fkey"
            columns: ["user_b_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notes: {
        Row: {
          id: string
          title: string
          content: string 
          category: string 
          tags: string[] | null
          is_favorite: boolean | null
          url: string | null
          author: string | null
          attendees: string[] | null
          action_items: string[] | null
          user_id: string 
          created_at: string
          updated_at: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          category: string
          tags?: string[] | null
          is_favorite?: boolean | null
          url?: string | null
          author?: string | null
          attendees?: string[] | null
          action_items?: string[] | null
          user_id: string
          created_at?: string
          updated_at?: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string
          tags?: string[] | null
          is_favorite?: boolean | null
          url?: string | null
          author?: string | null
          attendees?: string[] | null
          action_items?: string[] | null
          user_id?: string
          created_at?: string
          updated_at?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      resources: { 
        Row: {
          id: string 
          bucket_name: string 
          file_name: string
          file_path: string 
          mime_type: string
          size_bytes: number 
          resource_type: string 
          uploaded_by: string 
          created_at: string
          project_id: string | null 
          team_id: string | null
          parent_folder_id: string | null
          starred: boolean | null
          last_accessed_at: string | null
          updated_at: string | null
          shared_link_id: string | null
          is_team_photo: boolean | null
        }
        Insert: {
          id?: string
          bucket_name: string 
          file_name: string
          file_path: string
          mime_type: string
          size_bytes: number
          resource_type: string
          uploaded_by: string
          created_at?: string
          project_id?: string | null 
          team_id?: string | null
          parent_folder_id?: string | null
          starred?: boolean | null
          last_accessed_at?: string | null
          updated_at?: string | null
          shared_link_id?: string | null
          is_team_photo?: boolean | null
        }
        Update: {
          id?: string
          bucket_name?: string 
          file_name?: string
          file_path?: string
          mime_type?: string
          size_bytes?: number
          resource_type?: string
          uploaded_by?: string
          created_at?: string
          project_id?: string | null 
          team_id?: string | null
          parent_folder_id?: string | null
          starred?: boolean | null
          last_accessed_at?: string | null
          updated_at?: string | null
          shared_link_id?: string | null
          is_team_photo?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            referencedRelation: "user_profiles" 
            referencedColumns: ["id"]
          },
          { 
            foreignKeyName: "resources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
            onDelete: "SET NULL" 
          },
          { 
            foreignKeyName: "resources_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          { 
            foreignKeyName: "resources_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            referencedRelation: "resources"
            referencedColumns: ["id"]
            onDelete: "CASCADE" 
          }
        ]
      }
      resource_shares: {
        Row: {
          id: string
          resource_id: string
          shared_by_user_id: string
          shared_with_user_id: string
          permissions: string
          created_at: string
        }
        Insert: {
          id?: string
          resource_id: string
          shared_by_user_id: string
          shared_with_user_id: string
          permissions: string
          created_at?: string
        }
        Update: {
          permissions?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_shares_resource_id_fkey"
            columns: ["resource_id"]
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      team_updates: {
        Row: {
          id: string
          team_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_updates_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      team_chat_messages: {
        Row: {
          id: string
          team_id: string
          sender_id: string
          content: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          sender_id: string
          content: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_messages_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      department_updates: {
        Row: {
          id: string
          department_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          department_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_updates_department_id_fkey"
            columns: ["department_id"]
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      department_chat_messages: {
        Row: {
          id: string
          department_id: string
          sender_id: string
          content: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          department_id: string
          sender_id: string
          content: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_chat_messages_department_id_fkey"
            columns: ["department_id"]
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      calendar_events_with_context: {
        Row: {
          id: string | null
          title: string | null
          description: string | null
          date: string | null
          start_time: string | null
          end_time: string | null
          color: string | null
          calendar_type: string | null
          user_id: string | null
          project_id: string | null
          task_id: string | null
          created_at: string | null
          updated_at: string | null
          project_name: string | null
          task_title: string | null
          task_status: string | null
          task_priority: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      user_connections: {
        Row: {
          id: string | null
          user_a_id: string | null
          user_b_id: string | null
          status: string | null
          created_at: string | null
          user_a_name: string | null
          user_a_email: string | null
          user_b_name: string | null
          user_b_email: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_user_a_id_fkey"
            columns: ["user_a_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_user_b_id_fkey"
            columns: ["user_b_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_project_memberships: {
        Row: {
          project_id: string | null
          user_id: string | null
          role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      get_project_user_role: {
        Args: {
          p_project_id: string
          p_user_id: string
        }
        Returns: string | null
      },
      transfer_team_ownership: {
        Args: {
          p_team_id: string
          p_new_owner_id: string
          p_current_user_id: string
        }
        Returns: Json
      },
      accept_team_invite: {
        Args: {
          p_invite_code: string
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}