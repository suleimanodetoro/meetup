// types/messaging.ts

// =====================================================
// CORE MESSAGING TYPES
// =====================================================

export type ConversationType = 'dm' | 'group';
export type MessageType = 'text' | 'image' | 'location' | 'system';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type MessagePrivacy = 'everyone' | 'friends_only' | 'nobody';
export type ProfileVisibility = 'public' | 'friends_only' | 'private';

// Conversation Interface
export interface Conversation {
  id: number;
  type: ConversationType;
  name?: string | null;
  event_id?: number | null;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  avatar_url?: string | null;

  // Joined data
  participants?: ConversationParticipant[];
  unread_count?: number;
  is_muted?: boolean;
  event?: Event;
}

// Conversation Participant
export interface ConversationParticipant {
  id: number;
  conversation_id: number;
  user_id: string;
  joined_at: string;
  last_read_at?: string | null;
  is_muted: boolean;

  // Joined data
  profile?: Profile;
}

// Enhanced Message Interface
export interface Message {
  id: number;
  conversation_id?: number | null;
  event_id?: number | null; // Legacy support
  user_id: string;
  content: string;
  created_at: string;
  reply_to_id?: number | null;
  is_edited: boolean;
  edited_at?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  message_type: MessageType;
  metadata?: MessageMetadata | null;

  // Joined data
  user?: Profile;
  reply_to?: Message;
  read_receipts?: MessageReadReceipt[];
}

// Message Metadata for different types
export interface MessageMetadata {
  // For images
  image_url?: string;
  image_width?: number;
  image_height?: number;
  thumbnail_url?: string;

  // For location
  latitude?: number;
  longitude?: number;
  location_name?: string;

  // For system messages
  system_type?: 'user_joined' | 'user_left' | 'plan_updated' | 'plan_cancelled';
  system_data?: Record<string, any>;
}

// =====================================================
// FRIEND SYSTEM TYPES
// =====================================================

export interface Friendship {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;

  // Joined data
  requester?: Profile;
  addressee?: Profile;
}

export interface FriendRequest {
  id: number;
  from_user: Profile;
  created_at: string;
  mutual_friends?: Profile[];
  mutual_plans?: Event[];
}

// =====================================================
// PRIVACY & SETTINGS TYPES
// =====================================================

export interface UserPrivacySettings {
  id: number;
  user_id: string;
  message_privacy: MessagePrivacy;
  profile_visibility: ProfileVisibility;
  show_online_status: boolean;
  show_read_receipts: boolean;
  allow_friend_requests: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlockedUser {
  id: number;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  reason?: string | null;

  // Joined data
  blocked_profile?: Profile;
}

// =====================================================
// READ RECEIPTS & TYPING
// =====================================================

export interface MessageReadReceipt {
  id: number;
  message_id: number;
  user_id: string;
  read_at: string;

  // Joined data
  user?: Profile;
}

export interface TypingIndicator {
  id: number;
  conversation_id: number;
  user_id: string;
  started_at: string;

  // Joined data
  user?: Profile;
}

// =====================================================
// EXTENDED PROFILE TYPE
// =====================================================

export interface Profile {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  birth_date?: string | null;
  is_founder?: boolean | null;
  founder_year?: number | null;
  languages?: string[] | null;
  interests?: string[] | null;
  meeting_preference?: string | null;
  gender_preference?: string | null;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;

  // Computed fields
  age?: number;
  is_online?: boolean;
  last_seen?: string;
  friendship_status?: FriendshipStatus | null;
  can_message?: boolean;
  mutual_friends_count?: number;
  mutual_plans_count?: number;
}

// =====================================================
// EVENT/PLAN TYPE
// =====================================================

export interface Event {
  id: number;
  user_id: string;
  title: string;
  description?: string | null;
  date: string;
  end_date?: string | null;
  time?: string | null;
  city: string;
  country?: string | null;
  country_code?: string | null;
  location_name?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  image_uri?: string | null;
  max_attendees?: number | null;
  interests?: string[] | null;
  cost?: number | null;
  cost_currency?: string | null;
  is_private: boolean;
  created_at: string;
  updated_at?: string | null;

  // Joined data
  creator?: Profile;
  attendees?: Profile[];
  attendee_count?: number;
  conversation_id?: number;
  is_attending?: boolean;
}

// =====================================================
// CHAT LIST ITEM TYPE
// =====================================================

export interface ChatListItem {
  conversation: Conversation;
  last_message?: Message | null;
  unread_count: number;
  is_muted: boolean;
  is_online?: boolean; // For DMs
  participant_count?: number; // For groups
  typing_users?: Profile[]; // Users currently typing
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ConversationWithDetails extends Conversation {
  participants: (ConversationParticipant & { profile: Profile })[];
  last_message?: Message & { user: Profile };
  unread_count: number;
}

export interface MessageWithDetails extends Message {
  user: Profile;
  reply_to?: Message & { user: Profile };
  read_by: Profile[];
}

// =====================================================
// FORM/INPUT TYPES
// =====================================================

export interface SendMessageInput {
  conversation_id: number;
  content: string;
  message_type?: MessageType;
  reply_to_id?: number | null;
  metadata?: MessageMetadata | null;
}

export interface CreateDMInput {
  recipient_id: string;
  initial_message?: string;
}

export interface UpdatePrivacySettingsInput {
  message_privacy?: MessagePrivacy;
  profile_visibility?: ProfileVisibility;
  show_online_status?: boolean;
  show_read_receipts?: boolean;
  allow_friend_requests?: boolean;
}

// =====================================================
// REALTIME SUBSCRIPTION TYPES
// =====================================================

export interface RealtimeMessage {
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: {
    new?: Message;
    old?: Message;
  };
}

export interface RealtimeTyping {
  event: 'INSERT' | 'DELETE';
  payload: {
    new?: TypingIndicator;
    old?: TypingIndicator;
  };
}

export interface RealtimePresence {
  user_id: string;
  online_at: string;
  status: 'online' | 'away' | 'offline';
}
