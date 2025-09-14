import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Input, Button, Text, CheckBox } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';
import { useRouter } from 'expo-router';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert('Error', 'Please agree to terms and conditions');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      // Create profile
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              full_name: fullName,
              username: email.split('@')[0],
              travel_preferences: {
                budget: 'medium',
                travel_style: 'balanced',
                interests: []
              }
            },
          ]);

        if (profileError) throw profileError;

        Alert.alert(
          'Success',
          'Account created successfully! Please check your email to verify your account.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/(auth)/login')
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Signup Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.form}>
          <Text h3 style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your travel journey today!</Text>

          <Input
            placeholder="Full Name"
            leftIcon={{ type: 'feather', name: 'user' }}
            value={fullName}
            onChangeText={setFullName}
            containerStyle={styles.inputContainer}
            inputStyle={styles.input}
          />

          <Input
            placeholder="Email"
            leftIcon={{ type: 'feather', name: 'mail' }}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            containerStyle={styles.inputContainer}
            inputStyle={styles.input}
          />

          <Input
            placeholder="Password (min 6 characters)"
            leftIcon={{ type: 'feather', name: 'lock' }}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            containerStyle={styles.inputContainer}
            inputStyle={styles.input}
          />

          <CheckBox
            title="I agree to the Terms and Conditions"
            checked={agreeToTerms}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
            containerStyle={styles.checkbox}
            textStyle={styles.checkboxText}
          />

          <Button
            title="Create Account"
            loading={loading}
            disabled={loading}
            buttonStyle={styles.button}
            titleStyle={styles.buttonTitle}
            onPress={handleSignup}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/login')}
            >
              Login
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    fontSize: 16,
  },
  checkbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 20,
    marginLeft: 0,
    marginRight: 0,
    paddingHorizontal: 0,
  },
  checkboxText: {
    fontWeight: 'normal',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2089dc',
    borderRadius: 25,
    paddingVertical: 15,
    marginBottom: 20,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
  link: {
    color: '#2089dc',
    fontWeight: 'bold',
    fontSize: 16,
  },
});