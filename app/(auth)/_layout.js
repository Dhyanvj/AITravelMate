import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#2089dc' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="welcome"
        options={{
          headerShown: false,
          title: 'Welcome'
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: 'Sign Up',
          presentation: 'modal'
        }}
      />
    </Stack>
  );
}