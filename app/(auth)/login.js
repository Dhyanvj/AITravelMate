import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Input, Button, Text } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;
      // Navigation will be handled by the auth listener in _layout.js
    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text h3 style={styles.title}>Welcome Back!</Text>

        <Input
          placeholder="Email"
          leftIcon={{ type: 'feather', name: 'mail' }}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={styles.inputContainer}
        />

        <Input
          placeholder="Password"
          leftIcon={{ type: 'feather', name: 'lock' }}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          containerStyle={styles.inputContainer}
        />

        <Button
          title="Login"
          loading={loading}
          buttonStyle={styles.button}
          onPress={handleLogin}
        />

        <View style={styles.footer}>
          <Text>Don't have an account? </Text>
          <Text
            style={styles.link}
            onPress={() => router.push('/(auth)/signup')}
          >
            Sign up
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2089dc',
    borderRadius: 25,
    paddingVertical: 15,
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  link: {
    color: '#2089dc',
    fontWeight: 'bold',
  },
});