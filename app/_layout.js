import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import 'react-native-get-random-values';
import { clearAuthState, recoverSession, supabase } from '../src/services/supabase/supabaseClient';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, !!session);
        
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          setIsAuthenticated(!!session);
        } else if (event === 'SIGNED_IN') {
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to welcome if not authenticated
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)/');
    }
  }, [isAuthenticated, segments, isLoading]);

  const checkUser = async () => {
    try {
      // Try to recover session first
      const session = await recoverSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Error checking auth status:', error);
      
      // If there's an auth error, clear the state and show alert
      if (error.message?.includes('Invalid Refresh Token') || 
          error.message?.includes('Refresh Token Not Found')) {
        console.log('Clearing corrupted auth state...');
        await clearAuthState();
        
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsAuthenticated(false);
                router.replace('/(auth)/welcome');
              }
            }
          ]
        );
      } else {
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2089dc" />
      </View>
    );
  }

  return <Slot />;
}