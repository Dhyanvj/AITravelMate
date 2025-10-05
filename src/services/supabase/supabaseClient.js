import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dosgeavakhvgtzsdddts.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvc2dlYXZha2h2Z3R6c2RkZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTgzOTQsImV4cCI6MjA3MjEzNDM5NH0.B-068D7W8z1BskLGPH0wozQPhw39kQVs2qFoDl9LyxA';

// Custom storage adapter with error handling
const customStorage = {
  getItem: async (key) => {
    try {
      const item = await AsyncStorage.getItem(key);
      return item;
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  },
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Helper function to clear auth state
export const clearAuthState = async () => {
  try {
    await supabase.auth.signOut();
    // Clear all auth-related items from storage
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(key => key.includes('supabase') || key.includes('auth'));
    await AsyncStorage.multiRemove(authKeys);
    console.log('Auth state cleared successfully');
  } catch (error) {
    console.error('Error clearing auth state:', error);
  }
};

// Helper function to check and recover session
export const recoverSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session recovery error:', error);
      await clearAuthState();
      return null;
    }
    return session;
  } catch (error) {
    console.error('Session recovery failed:', error);
    await clearAuthState();
    return null;
  }
};