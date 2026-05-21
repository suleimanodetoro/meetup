import { Database } from "./supabase";
// Re-exporting the new tables for easy access
export type Visit = Database['public']['Tables']['visits']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Attendance = Database['public']['Tables']['attendance']['Row'];

// Updating the Event type to include all new columns
export type Event = Database['public']['Tables']['events']['Row'];

// nearby_events RPC returns an array of rows; this type is one row.
export type NearbyEvent =
  Database['public']['Functions']['nearby_events']['Returns'][number];