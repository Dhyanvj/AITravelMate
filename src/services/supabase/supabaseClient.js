import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://dosgeavakhvgtzsdddts.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvc2dlYXZha2h2Z3R6c2RkZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTgzOTQsImV4cCI6MjA3MjEzNDM5NH0.B-068D7W8z1BskLGPH0wozQPhw39kQVs2qFoDl9LyxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});