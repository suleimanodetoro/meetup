import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {Database} from 'types/supabase'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // detectSessionInUrl is for the browser fragment flow; native handles
    // deep links manually via exchangeCodeForSession in the dedicated
    // reset-password / confirm-email screens.
    detectSessionInUrl: false,
    // PKCE is the modern flow for email-based confirmations and password
    // resets. Supabase ships a one-time `code` query param in the magic
    // link; the app exchanges it for a session — no token fragments to
    // parse, no risk of the access_token leaking into logs.
    flowType: 'pkce',
  },
});
