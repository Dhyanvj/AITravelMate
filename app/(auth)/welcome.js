import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>AI TravelMate</Text>
          <Text style={styles.subtitle}>Your Smart Travel Companion</Text>

          <View style={styles.features}>
            <Text style={styles.feature}>✈️ Smart Flight & Hotel Planning</Text>
            <Text style={styles.feature}>🗺️ AI-Powered Itineraries</Text>
            <Text style={styles.feature}>📍 Personalized Recommendations</Text>
            <Text style={styles.feature}>💬 24/7 Travel Assistant</Text>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Get Started"
              buttonStyle={[styles.button, styles.primaryButton]}
              titleStyle={styles.buttonText}
              onPress={() => router.push('/(auth)/signup')}
            />
            <Button
              title="I have an account"
              buttonStyle={[styles.button, styles.secondaryButton]}
              titleStyle={[styles.buttonText, { color: '#667eea' }]}
              onPress={() => router.push('/(auth)/login')}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 40,
  },
  features: {
    marginBottom: 50,
  },
  feature: {
    fontSize: 16,
    color: '#fff',
    marginVertical: 8,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    borderRadius: 25,
    paddingVertical: 15,
    marginVertical: 10,
  },
  primaryButton: {
    backgroundColor: '#fff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
});