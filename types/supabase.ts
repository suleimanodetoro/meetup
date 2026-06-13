export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string
          event_id: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string | null
          blocker_id: string | null
          created_at: string | null
          id: number
          reason: string | null
        }
        Insert: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: number
          reason?: string | null
        }
        Update: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: number | null
          id: number
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: number | null
          id?: number
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: number | null
          id?: number
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          event_id: number | null
          id: number
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_costs: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          event_id: number
          id: number
          is_optional: boolean | null
          item_name: string
          link_url: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_id: number
          id?: number
          is_optional?: boolean | null
          item_name: string
          link_url?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_id?: number
          id?: number
          is_optional?: boolean | null
          item_name?: string
          link_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_costs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_venues: {
        Row: {
          created_at: string | null
          event_id: number
          id: number
          order_index: number | null
          venue_address: string | null
          venue_city: string | null
          venue_country: string | null
          venue_country_code: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string
        }
        Insert: {
          created_at?: string | null
          event_id: number
          id?: number
          order_index?: number | null
          venue_address?: string | null
          venue_city?: string | null
          venue_country?: string | null
          venue_country_code?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name: string
        }
        Update: {
          created_at?: string | null
          event_id?: number
          id?: number
          order_index?: number | null
          venue_address?: string | null
          venue_city?: string | null
          venue_country?: string | null
          venue_country_code?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_venues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string | null
          cost: number | null
          cost_currency: string | null
          country: string | null
          country_code: string | null
          created_at: string
          date: string | null
          description: string | null
          end_date: string | null
          guidelines_accepted: boolean | null
          guidelines_accepted_at: string | null
          id: number
          image_uri: string | null
          interests: Json | null
          is_all_day: boolean | null
          is_one_day: boolean | null
          is_private: boolean | null
          location_name: string | null
          location_point: unknown
          title: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          cost?: number | null
          cost_currency?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_date?: string | null
          guidelines_accepted?: boolean | null
          guidelines_accepted_at?: string | null
          id?: number
          image_uri?: string | null
          interests?: Json | null
          is_all_day?: boolean | null
          is_one_day?: boolean | null
          is_private?: boolean | null
          location_name?: string | null
          location_point?: unknown
          title: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          cost?: number | null
          cost_currency?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_date?: string | null
          guidelines_accepted?: boolean | null
          guidelines_accepted_at?: string | null
          id?: number
          image_uri?: string | null
          interests?: Json | null
          is_all_day?: boolean | null
          is_one_day?: boolean | null
          is_private?: boolean | null
          location_name?: string | null
          location_point?: unknown
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string | null
          created_at: string | null
          id: number
          requester_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          addressee_id?: string | null
          created_at?: string | null
          id?: number
          requester_id?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          addressee_id?: string | null
          created_at?: string | null
          id?: number
          requester_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: number
          message_id: number | null
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          message_id?: number | null
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          message_id?: number | null
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: number | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event_id: number | null
          id: number
          is_deleted: boolean | null
          is_edited: boolean | null
          message_type: string | null
          metadata: Json | null
          reply_to_id: number | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: number | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: number | null
          id?: number
          is_deleted?: boolean | null
          is_edited?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_id?: number | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: number | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event_id?: number | null
          id?: number
          is_deleted?: boolean | null
          is_edited?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avatar_url_2: string | null
          avatar_url_3: string | null
          bio: string | null
          birth_date: string | null
          founder_year: number | null
          full_name: string | null
          gender: string | null
          gender_preference: string | null
          id: string
          instagram_url: string | null
          interests: Json | null
          is_founder: boolean
          languages: Json | null
          location: string | null
          location_country: string | null
          location_country_code: string | null
          location_updated_at: string | null
          meeting_preference: string | null
          nationality: string | null
          nationality_code: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          username: string | null
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          avatar_url_2?: string | null
          avatar_url_3?: string | null
          bio?: string | null
          birth_date?: string | null
          founder_year?: number | null
          full_name?: string | null
          gender?: string | null
          gender_preference?: string | null
          id: string
          instagram_url?: string | null
          interests?: Json | null
          is_founder?: boolean
          languages?: Json | null
          location?: string | null
          location_country?: string | null
          location_country_code?: string | null
          location_updated_at?: string | null
          meeting_preference?: string | null
          nationality?: string | null
          nationality_code?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          avatar_url_2?: string | null
          avatar_url_3?: string | null
          bio?: string | null
          birth_date?: string | null
          founder_year?: number | null
          full_name?: string | null
          gender?: string | null
          gender_preference?: string | null
          id?: string
          instagram_url?: string | null
          interests?: Json | null
          is_founder?: boolean
          languages?: Json | null
          location?: string | null
          location_country?: string | null
          location_country_code?: string | null
          location_updated_at?: string | null
          meeting_preference?: string | null
          nationality?: string | null
          nationality_code?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: number | null
          id: number
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: number | null
          id?: number
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: number | null
          id?: number
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_privacy_settings: {
        Row: {
          allow_friend_requests: boolean | null
          created_at: string | null
          id: number
          message_privacy: string | null
          profile_visibility: string | null
          show_online_status: boolean | null
          show_read_receipts: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allow_friend_requests?: boolean | null
          created_at?: string | null
          id?: number
          message_privacy?: string | null
          profile_visibility?: string | null
          show_online_status?: boolean | null
          show_read_receipts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allow_friend_requests?: boolean | null
          created_at?: string | null
          id?: number
          message_privacy?: string | null
          profile_visibility?: string | null
          show_online_status?: boolean | null
          show_read_receipts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_privacy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          entitlement_id: string | null
          expires_at: string | null
          id: number
          original_transaction_id: string | null
          provider: string | null
          started_at: string | null
          subscription_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entitlement_id?: string | null
          expires_at?: string | null
          id?: number
          original_transaction_id?: string | null
          provider?: string | null
          started_at?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entitlement_id?: string | null
          expires_at?: string | null
          id?: number
          original_transaction_id?: string | null
          provider?: string | null
          started_at?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          city: string
          country: string | null
          country_code: string | null
          created_at: string
          end_date: string
          id: number
          start_date: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          end_date: string
          id?: number
          start_date: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          end_date?: string
          id?: number
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_users_message: {
        Args: { receiver_id: string; sender_id: string }
        Returns: boolean
      }
      cleanup_old_typing_indicators: { Args: never; Returns: undefined }
      cleanup_typing_indicators: { Args: never; Returns: undefined }
      delete_user_account: { Args: never; Returns: Json }
      get_city_meta_window: {
        Args: { city_name: string; window_from?: string; window_to?: string }
        Returns: {
          city: string
          country: string
          country_code: string
          plan_count: number
          user_count: number
        }[]
      }
      get_city_plans_ranked: {
        Args: {
          city_name: string
          page_limit?: number
          page_offset?: number
          window_from?: string
          window_to?: string
        }
        Returns: {
          attendee_count: number
          cost: number
          cost_currency: string
          date: string
          description: string
          end_date: string
          event_id: number
          host_avatar: string
          host_name: string
          image_uri: string
          location_name: string
          match_score: number
          title: string
        }[]
      }
      get_city_users_ranked: {
        Args: {
          city_name: string
          page_limit?: number
          page_offset?: number
          window_from?: string
          window_to?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          is_premium: boolean
          is_verified: boolean
          location_country_code: string
          match_score: number
          nationality_code: string
          user_id: string
          visit_end: string
          visit_start: string
        }[]
      }
      get_friendship_status: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          is_requester: boolean
          status: string
        }[]
      }
      get_mutual_friends: {
        Args: { user1_id: string; user2_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          username: string
        }[]
      }
      get_nearby_city_users: {
        Args: { user_city: string; user_country: string }
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          gender: string
          id: string
          interests: Json
          location: string
          location_country: string
          location_country_code: string
          nationality_code: string
        }[]
      }
      get_new_plans: {
        Args: never
        Returns: {
          attendee_count: number
          city: string
          cost: number
          cost_currency: string
          country: string
          country_code: string
          created_at: string
          date: string
          description: string
          end_date: string
          id: number
          image_uri: string
          interests: Json
          location_name: string
          recent_attendees: Json
          title: string
          user_id: string
        }[]
      }
      get_or_create_dm_conversation: {
        Args: { user1_id: string; user2_id: string }
        Returns: number
      }
      get_or_create_dm_conversation_v3: {
        Args: { recipient_id: string; sender_id: string }
        Returns: {
          block_msg_out: string
          can_msg_out: boolean
          conv_id_out: number
          is_new_out: boolean
        }[]
      }
      get_pending_requests_count: { Args: { user_id: string }; Returns: number }
      get_plans_by_category: {
        Args: { category_param: string }
        Returns: {
          attendee_count: number
          city: string
          country: string
          country_code: string
          date: string
          description: string
          id: number
          image_uri: string
          interests: Json
          recent_attendees: Json
          title: string
        }[]
      }
      get_popular_plans: {
        Args: never
        Returns: {
          city: string | null
          cost: number | null
          cost_currency: string | null
          country: string | null
          country_code: string | null
          created_at: string
          date: string | null
          description: string | null
          end_date: string | null
          guidelines_accepted: boolean | null
          guidelines_accepted_at: string | null
          id: number
          image_uri: string | null
          interests: Json | null
          is_all_day: boolean | null
          is_one_day: boolean | null
          is_private: boolean | null
          location_name: string | null
          location_point: unknown
          title: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_popular_plans_with_attendees: {
        Args: never
        Returns: {
          attendee_count: number
          city: string
          cost: number
          cost_currency: string
          country: string
          country_code: string
          created_at: string
          date: string
          description: string
          end_date: string
          id: number
          image_uri: string
          interests: Json
          location_name: string
          recent_attendees: Json
          title: string
          user_id: string
        }[]
      }
      get_suggested_users: {
        Args: { current_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          birth_date: string
          common_cities: string[]
          common_interests: string[]
          full_name: string
          id: string
          interests: Json
          is_premium: boolean
          languages: Json
          location: string
          nationality_code: string
          similarity_score: number
        }[]
      }
      get_trending_cities: {
        Args: never
        Returns: {
          city: string
          country: string
          country_code: string
          image_url: string
          plan_count: number
        }[]
      }
      get_trending_visits: {
        Args: never
        Returns: {
          city: string
          country: string
          country_code: string
          end_date: string
          id: number
          image_url: string
          recent_users: Json
          start_date: string
          user_count: number
        }[]
      }
      get_user_chat_stats: {
        Args: { p_user_id: string }
        Returns: {
          dm_conversations: number
          group_conversations: number
          pending_requests: number
          total_conversations: number
          total_friends: number
          total_messages_sent: number
        }[]
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          conversation_id: number
          conversation_name: string
          conversation_type: string
          event_country_code: string
          event_id: number
          last_message_at: string
          last_message_content: string
          last_message_user_name: string
          participant_count: number
          unread_count: number
        }[]
      }
      get_users_in_city: {
        Args: { city_name: string; country_name?: string }
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          gender: string
          id: string
          interests: Json
          location: string
          location_country: string
          location_country_code: string
          nationality_code: string
          updated_at: string
        }[]
      }
      get_visit_details: {
        Args: { visit_id_param: number }
        Returns: {
          city: string
          country: string
          country_code: string
          end_date: string
          id: number
          plan_count: number
          start_date: string
          user_count: number
        }[]
      }
      get_visit_users: {
        Args: { limit_param?: number; visit_id_param: number }
        Returns: {
          avatar_url: string
          bio: string
          full_name: string
          is_verified: boolean
          nationality_code: string
          overlap_days: number
          user_id: string
          visit_end: string
          visit_start: string
        }[]
      }
      is_conversation_member: { Args: { conv_id: number }; Returns: boolean }
      is_user_founder: { Args: { uid: string }; Returns: boolean }
      is_user_premium: { Args: { uid: string }; Returns: boolean }
      mark_conversation_as_read: {
        Args: { p_conversation_id: number; p_user_id: string }
        Returns: undefined
      }
      nearby_events: {
        Args: { lat: number; long: number }
        Returns: {
          created_at: string
          date: string
          description: string
          dist_meters: number
          id: number
          image_uri: string
          lat: number
          location: string
          long: number
          title: string
          user_id: string
        }[]
      }
      search_cities: {
        Args: { max_results?: number; query: string }
        Returns: {
          activity_count: number
          city: string
          country: string
          country_code: string
        }[]
      }
      search_users_for_friends: {
        Args: { limit_count?: number; search_term: string; searcher_id: string }
        Returns: {
          avatar_url: string
          bio: string
          friendship_status: string
          full_name: string
          id: string
          mutual_friends_count: number
          mutual_plans_count: number
          username: string
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

