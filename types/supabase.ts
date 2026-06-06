export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string;
          event_id: number;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: number;
          id?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: number;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocked_users: {
        Row: {
          blocked_id: string | null;
          blocker_id: string | null;
          created_at: string | null;
          id: number;
          reason: string | null;
        };
        Insert: {
          blocked_id?: string | null;
          blocker_id?: string | null;
          created_at?: string | null;
          id?: number;
          reason?: string | null;
        };
        Update: {
          blocked_id?: string | null;
          blocker_id?: string | null;
          created_at?: string | null;
          id?: number;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'blocked_users_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocked_users_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: number | null;
          id: number;
          is_muted: boolean | null;
          joined_at: string | null;
          last_read_at: string | null;
          user_id: string | null;
        };
        Insert: {
          conversation_id?: number | null;
          id?: number;
          is_muted?: boolean | null;
          joined_at?: string | null;
          last_read_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          conversation_id?: number | null;
          id?: number;
          is_muted?: boolean | null;
          joined_at?: string | null;
          last_read_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          event_id: number | null;
          id: number;
          last_message_at: string | null;
          last_message_preview: string | null;
          name: string | null;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          event_id?: number | null;
          id?: number;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          event_id?: number | null;
          id?: number;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          name?: string | null;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_costs: {
        Row: {
          amount: number | null;
          created_at: string | null;
          currency: string | null;
          event_id: number;
          id: number;
          is_optional: boolean | null;
          item_name: string;
          link_url: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          currency?: string | null;
          event_id: number;
          id?: number;
          is_optional?: boolean | null;
          item_name: string;
          link_url?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          currency?: string | null;
          event_id?: number;
          id?: number;
          is_optional?: boolean | null;
          item_name?: string;
          link_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_costs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_venues: {
        Row: {
          created_at: string | null;
          event_id: number;
          id: number;
          order_index: number | null;
          venue_address: string | null;
          venue_city: string | null;
          venue_country: string | null;
          venue_country_code: string | null;
          venue_lat: number | null;
          venue_lng: number | null;
          venue_name: string;
        };
        Insert: {
          created_at?: string | null;
          event_id: number;
          id?: number;
          order_index?: number | null;
          venue_address?: string | null;
          venue_city?: string | null;
          venue_country?: string | null;
          venue_country_code?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          venue_name: string;
        };
        Update: {
          created_at?: string | null;
          event_id?: number;
          id?: number;
          order_index?: number | null;
          venue_address?: string | null;
          venue_city?: string | null;
          venue_country?: string | null;
          venue_country_code?: string | null;
          venue_lat?: number | null;
          venue_lng?: number | null;
          venue_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_venues_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          city: string | null;
          cost: number | null;
          cost_currency: string | null;
          country: string | null;
          country_code: string | null;
          created_at: string;
          date: string | null;
          description: string | null;
          end_date: string | null;
          guidelines_accepted: boolean | null;
          guidelines_accepted_at: string | null;
          id: number;
          image_uri: string | null;
          interests: Json | null;
          is_all_day: boolean | null;
          is_one_day: boolean | null;
          is_private: boolean | null;
          location_name: string | null;
          location_point: unknown | null;
          title: string;
          user_id: string | null;
        };
        Insert: {
          city?: string | null;
          cost?: number | null;
          cost_currency?: string | null;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          date?: string | null;
          description?: string | null;
          end_date?: string | null;
          guidelines_accepted?: boolean | null;
          guidelines_accepted_at?: string | null;
          id?: number;
          image_uri?: string | null;
          interests?: Json | null;
          is_all_day?: boolean | null;
          is_one_day?: boolean | null;
          is_private?: boolean | null;
          location_name?: string | null;
          location_point?: unknown | null;
          title: string;
          user_id?: string | null;
        };
        Update: {
          city?: string | null;
          cost?: number | null;
          cost_currency?: string | null;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          date?: string | null;
          description?: string | null;
          end_date?: string | null;
          guidelines_accepted?: boolean | null;
          guidelines_accepted_at?: string | null;
          id?: number;
          image_uri?: string | null;
          interests?: Json | null;
          is_all_day?: boolean | null;
          is_one_day?: boolean | null;
          is_private?: boolean | null;
          location_name?: string | null;
          location_point?: unknown | null;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          addressee_id: string | null;
          created_at: string | null;
          id: number;
          requester_id: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          addressee_id?: string | null;
          created_at?: string | null;
          id?: number;
          requester_id?: string | null;
          status: string;
          updated_at?: string | null;
        };
        Update: {
          addressee_id?: string | null;
          created_at?: string | null;
          id?: number;
          requester_id?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      message_read_receipts: {
        Row: {
          id: number;
          message_id: number | null;
          read_at: string | null;
          user_id: string | null;
        };
        Insert: {
          id?: number;
          message_id?: number | null;
          read_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          message_id?: number | null;
          read_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'message_read_receipts_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_read_receipts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: number | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          event_id: number | null;
          id: number;
          is_deleted: boolean | null;
          is_edited: boolean | null;
          message_type: string | null;
          metadata: Json | null;
          reply_to_id: number | null;
          user_id: string;
        };
        Insert: {
          content: string;
          conversation_id?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          event_id?: number | null;
          id?: number;
          is_deleted?: boolean | null;
          is_edited?: boolean | null;
          message_type?: string | null;
          metadata?: Json | null;
          reply_to_id?: number | null;
          user_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          event_id?: number | null;
          id?: number;
          is_deleted?: boolean | null;
          is_edited?: boolean | null;
          message_type?: string | null;
          metadata?: Json | null;
          reply_to_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_reply_to_id_fkey';
            columns: ['reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          avatar_url_2: string | null;
          avatar_url_3: string | null;
          bio: string | null;
          birth_date: string | null;
          full_name: string | null;
          gender: string | null;
          gender_preference: string | null;
          founder_year: number | null;
          id: string;
          instagram_url: string | null;
          interests: Json | null;
          is_founder: boolean;
          languages: Json | null;
          location: string | null;
          location_country: string | null;
          location_country_code: string | null;
          location_updated_at: string | null;
          meeting_preference: string | null;
          nationality: string | null;
          nationality_code: string | null;
          onboarding_completed: boolean | null;
          onboarding_step: number | null;
          tiktok_url: string | null;
          twitter_url: string | null;
          updated_at: string | null;
          username: string | null;
          website: string | null;
          youtube_url: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          avatar_url_2?: string | null;
          avatar_url_3?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          full_name?: string | null;
          gender?: string | null;
          gender_preference?: string | null;
          founder_year?: number | null;
          id: string;
          instagram_url?: string | null;
          interests?: Json | null;
          is_founder?: boolean;
          languages?: Json | null;
          location?: string | null;
          location_country?: string | null;
          location_country_code?: string | null;
          location_updated_at?: string | null;
          meeting_preference?: string | null;
          nationality?: string | null;
          nationality_code?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_step?: number | null;
          tiktok_url?: string | null;
          twitter_url?: string | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
          youtube_url?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          avatar_url_2?: string | null;
          avatar_url_3?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          full_name?: string | null;
          gender?: string | null;
          gender_preference?: string | null;
          founder_year?: number | null;
          id?: string;
          instagram_url?: string | null;
          interests?: Json | null;
          is_founder?: boolean;
          languages?: Json | null;
          location?: string | null;
          location_country?: string | null;
          location_country_code?: string | null;
          location_updated_at?: string | null;
          meeting_preference?: string | null;
          nationality?: string | null;
          nationality_code?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_step?: number | null;
          tiktok_url?: string | null;
          twitter_url?: string | null;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
          youtube_url?: string | null;
        };
        Relationships: [];
      };
      typing_indicators: {
        Row: {
          conversation_id: number | null;
          id: number;
          started_at: string | null;
          user_id: string | null;
        };
        Insert: {
          conversation_id?: number | null;
          id?: number;
          started_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          conversation_id?: number | null;
          id?: number;
          started_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'typing_indicators_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'typing_indicators_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_privacy_settings: {
        Row: {
          allow_friend_requests: boolean | null;
          created_at: string | null;
          id: number;
          message_privacy: string | null;
          profile_visibility: string | null;
          show_online_status: boolean | null;
          show_read_receipts: boolean | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          allow_friend_requests?: boolean | null;
          created_at?: string | null;
          id?: number;
          message_privacy?: string | null;
          profile_visibility?: string | null;
          show_online_status?: boolean | null;
          show_read_receipts?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          allow_friend_requests?: boolean | null;
          created_at?: string | null;
          id?: number;
          message_privacy?: string | null;
          profile_visibility?: string | null;
          show_online_status?: boolean | null;
          show_read_receipts?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_privacy_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_subscriptions: {
        Row: {
          created_at: string | null;
          entitlement_id: string | null;
          expires_at: string | null;
          id: number;
          original_transaction_id: string | null;
          provider: string | null;
          started_at: string | null;
          subscription_type: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          entitlement_id?: string | null;
          expires_at?: string | null;
          id?: number;
          original_transaction_id?: string | null;
          provider?: string | null;
          started_at?: string | null;
          subscription_type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          entitlement_id?: string | null;
          expires_at?: string | null;
          id?: number;
          original_transaction_id?: string | null;
          provider?: string | null;
          started_at?: string | null;
          subscription_type?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      visits: {
        Row: {
          city: string;
          country: string | null;
          country_code: string | null;
          created_at: string;
          end_date: string;
          id: number;
          start_date: string;
          user_id: string;
        };
        Insert: {
          city: string;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          end_date: string;
          id?: number;
          start_date: string;
          user_id: string;
        };
        Update: {
          city?: string;
          country?: string | null;
          country_code?: string | null;
          created_at?: string;
          end_date?: string;
          id?: number;
          start_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'visits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_users_message: {
        Args: { sender_id: string; receiver_id: string };
        Returns: boolean;
      };
      cleanup_old_typing_indicators: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      cleanup_typing_indicators: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      delete_user_account: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      get_city_meta_window: {
        Args: { city_name: string; window_from?: string; window_to?: string };
        Returns: {
          city: string;
          country: string;
          country_code: string;
          user_count: number;
          plan_count: number;
        }[];
      };
      get_city_plans_ranked: {
        Args: {
          city_name: string;
          window_from?: string;
          window_to?: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: {
          event_id: number;
          title: string;
          description: string;
          image_uri: string;
          date: string;
          end_date: string;
          location_name: string;
          cost: number;
          cost_currency: string;
          attendee_count: number;
          host_name: string;
          host_avatar: string;
          match_score: number;
        }[];
      };
      get_city_users_ranked: {
        Args: {
          city_name: string;
          window_from?: string;
          window_to?: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: {
          user_id: string;
          full_name: string;
          avatar_url: string;
          bio: string;
          nationality_code: string;
          location_country_code: string;
          is_verified: boolean;
          visit_start: string;
          visit_end: string;
          match_score: number;
        }[];
      };
      get_friendship_status: {
        Args: { user1_id: string; user2_id: string };
        Returns: {
          status: string;
          is_requester: boolean;
        }[];
      };
      get_mutual_friends: {
        Args: { user1_id: string; user2_id: string };
        Returns: {
          id: string;
          full_name: string;
          username: string;
          avatar_url: string;
        }[];
      };
      get_nearby_city_users: {
        Args: { user_city: string; user_country: string };
        Returns: {
          id: string;
          full_name: string;
          avatar_url: string;
          bio: string;
          location: string;
          location_country: string;
          location_country_code: string;
          nationality_code: string;
          interests: Json;
          gender: string;
        }[];
      };
      get_new_plans: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: number;
          title: string;
          description: string;
          date: string;
          end_date: string;
          city: string;
          country: string;
          country_code: string;
          location_name: string;
          image_uri: string;
          cost: number;
          cost_currency: string;
          interests: Json;
          user_id: string;
          attendee_count: number;
          recent_attendees: Json;
          created_at: string;
        }[];
      };
      get_or_create_dm_conversation: {
        Args: { user1_id: string; user2_id: string };
        Returns: number;
      };
      get_or_create_dm_conversation_v3: {
        Args: { sender_id: string; recipient_id: string };
        Returns: {
          conv_id_out: number;
          is_new_out: boolean;
          can_msg_out: boolean;
          block_msg_out: string;
        }[];
      };
      get_pending_requests_count: {
        Args: { user_id: string };
        Returns: number;
      };
      get_plans_by_category: {
        Args: { category_param: string };
        Returns: {
          id: number;
          title: string;
          description: string;
          date: string;
          city: string;
          country: string;
          country_code: string;
          image_uri: string;
          attendee_count: number;
          recent_attendees: Json;
          interests: Json;
        }[];
      };
      get_popular_plans: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string | null;
          cost: number | null;
          cost_currency: string | null;
          country: string | null;
          country_code: string | null;
          created_at: string;
          date: string | null;
          description: string | null;
          end_date: string | null;
          guidelines_accepted: boolean | null;
          guidelines_accepted_at: string | null;
          id: number;
          image_uri: string | null;
          interests: Json | null;
          is_all_day: boolean | null;
          is_one_day: boolean | null;
          is_private: boolean | null;
          location_name: string | null;
          location_point: unknown | null;
          title: string;
          user_id: string | null;
        }[];
      };
      get_popular_plans_with_attendees: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: number;
          title: string;
          description: string;
          date: string;
          end_date: string;
          city: string;
          country: string;
          country_code: string;
          location_name: string;
          image_uri: string;
          cost: number;
          cost_currency: string;
          interests: Json;
          user_id: string;
          attendee_count: number;
          recent_attendees: Json;
          created_at: string;
        }[];
      };
      get_suggested_users: {
        Args: { current_user_id: string };
        Returns: {
          id: string;
          full_name: string;
          avatar_url: string;
          bio: string;
          birth_date: string;
          nationality_code: string;
          interests: Json;
          languages: Json;
          location: string;
          similarity_score: number;
          common_interests: string[];
          common_cities: string[];
        }[];
      };
      get_trending_cities: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string;
          country: string;
          country_code: string;
          plan_count: number;
          image_url: string;
        }[];
      };
      get_trending_visits: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: number;
          city: string;
          country: string;
          country_code: string;
          start_date: string;
          end_date: string;
          user_count: number;
          image_url: string;
          recent_users: Json;
        }[];
      };
      get_user_chat_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_conversations: number;
          dm_conversations: number;
          group_conversations: number;
          total_messages_sent: number;
          total_friends: number;
          pending_requests: number;
        }[];
      };
      get_user_conversations: {
        Args: { p_user_id: string };
        Returns: {
          conversation_id: number;
          conversation_type: string;
          conversation_name: string;
          avatar_url: string;
          last_message_content: string;
          last_message_at: string;
          last_message_user_name: string;
          unread_count: number;
          participant_count: number;
          event_id: number;
          event_country_code: string;
        }[];
      };
      get_users_in_city: {
        Args: { city_name: string; country_name?: string };
        Returns: {
          id: string;
          full_name: string;
          avatar_url: string;
          bio: string;
          location: string;
          location_country: string;
          nationality_code: string;
          interests: Json;
          gender: string;
          updated_at: string;
        }[];
      };
      is_conversation_member: {
        Args: { conv_id: number };
        Returns: boolean;
      };
      mark_conversation_as_read: {
        Args: { p_conversation_id: number; p_user_id: string };
        Returns: undefined;
      };
      nearby_events: {
        Args: { lat: number; long: number };
        Returns: {
          id: number;
          created_at: string;
          title: string;
          description: string;
          date: string;
          location: string;
          image_uri: string;
          user_id: string;
          lat: number;
          long: number;
          dist_meters: number;
        }[];
      };
      search_cities: {
        Args: { query: string; max_results?: number };
        Returns: {
          city: string;
          country: string;
          country_code: string;
          activity_count: number;
        }[];
      };
      search_users_for_friends: {
        Args: { searcher_id: string; search_term: string; limit_count?: number };
        Returns: {
          id: string;
          full_name: string;
          username: string;
          avatar_url: string;
          bio: string;
          friendship_status: string;
          mutual_friends_count: number;
          mutual_plans_count: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
