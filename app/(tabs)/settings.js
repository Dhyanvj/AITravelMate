import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { clearAuthState, supabase } from '../../src/services/supabase/supabaseClient';

// Predefined avatar collection
const AVATAR_OPTIONS = [
  { id: 'avatar1', name: 'Traveler', emoji: '🧳' },
  { id: 'avatar2', name: 'Explorer', emoji: '🗺️' },
  { id: 'avatar3', name: 'Adventurer', emoji: '🏔️' },
  { id: 'avatar4', name: 'Photographer', emoji: '📸' },
  { id: 'avatar5', name: 'Beach Lover', emoji: '🏖️' },
  { id: 'avatar6', name: 'City Explorer', emoji: '🏙️' },
  { id: 'avatar7', name: 'Nature Lover', emoji: '🌲' },
  { id: 'avatar8', name: 'Foodie', emoji: '🍜' },
  { id: 'avatar9', name: 'Culture Seeker', emoji: '🏛️' },
  { id: 'avatar10', name: 'Backpacker', emoji: '🎒' },
  { id: 'avatar11', name: 'Mountain Climber', emoji: '⛰️' },
  { id: 'avatar12', name: 'Ocean Explorer', emoji: '🌊' },
  { id: 'avatar13', name: 'Desert Wanderer', emoji: '🏜️' },
  { id: 'avatar14', name: 'Forest Walker', emoji: '🌳' },
  { id: 'avatar15', name: 'Sky Gazer', emoji: '🌌' },
  { id: 'avatar16', name: 'Sunset Chaser', emoji: '🌅' },
];

export default function Settings() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadUserProfile();
    
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Auth error:', error);
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('Refresh Token Not Found')) {
          await clearAuthState();
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please sign in again.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/welcome')
              }
            ]
          );
          return;
        }
        throw error;
      }
      
      if (currentUser) {
        setUser(currentUser);
        
        // Load profile data from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        setProfile(profileData);
        
        // Set display name from user metadata
        setDisplayName(currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User');
        
        // Set full name from profile data
        setFullName(profileData?.full_name || '');
        
        // Load avatar if exists
        const avatarId = currentUser.user_metadata?.avatar_id;
        if (avatarId) {
          const avatar = AVATAR_OPTIONS.find(option => option.id === avatarId);
          setSelectedAvatar(avatar || AVATAR_OPTIONS[0]); // Default to first avatar if not found
        } else {
          setSelectedAvatar(AVATAR_OPTIONS[0]); // Default avatar
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleClearAuthState = async () => {
    Alert.alert(
      'Clear Auth State',
      'This will clear all authentication data and sign you out. Use this if you\'re experiencing login issues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAuthState();
              Alert.alert(
                'Success',
                'Auth state cleared. You will be redirected to the welcome screen.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(auth)/welcome')
                  }
                ]
              );
            } catch (error) {
              console.error('Error clearing auth state:', error);
              Alert.alert('Error', 'Failed to clear auth state');
            }
          },
        },
      ]
    );
  };

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });

      if (error) throw error;

      setIsEditingDisplayName(false);
      Alert.alert('Success', 'Display name updated successfully');
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFullName = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // Also update user metadata for consistency
      const { error: userError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });

      if (userError) throw userError;

      // Update local state
      setProfile(prev => ({ ...prev, full_name: fullName.trim() }));
      setIsEditingFullName(false);
      Alert.alert('Success', 'Full name updated successfully');
    } catch (error) {
      console.error('Error updating full name:', error);
      Alert.alert('Error', 'Failed to update full name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChooseAvatar = () => {
    setShowAvatarModal(true);
  };

  const handleAvatarSelect = async (avatar) => {
    setIsSaving(true);
    try {
      // Update user metadata
      const { error: userError } = await supabase.auth.updateUser({
        data: { avatar_id: avatar.id }
      });

      if (userError) throw userError;

      // Also update profiles table for consistency
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_id: avatar.id,
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      setSelectedAvatar(avatar);
      setShowAvatarModal(false);
      Alert.alert('Success', 'Avatar updated successfully');
    } catch (error) {
      console.error('Error updating avatar:', error);
      Alert.alert('Error', 'Failed to update avatar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2089dc" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
    
      

      {/* Profile Section */}
      <Animated.View 
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Profile</Text>
        
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleChooseAvatar}>
            <View style={styles.avatarDisplay}>
              <Text style={styles.avatarEmoji}>{selectedAvatar?.emoji || '🧳'}</Text>
            </View>
            <View style={styles.avatarEditIcon}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarLabel}>Tap to change avatar</Text>
          {selectedAvatar && (
            <Text style={styles.avatarName}>{selectedAvatar.name}</Text>
          )}
        </View>

        {/* Full Name */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Full Name</Text>
          {isEditingFullName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.disabledButton]}
                onPress={handleSaveFullName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditingFullName(false);
                  setFullName(profile?.full_name || '');
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.displayNameContainer}
              onPress={() => setIsEditingFullName(true)}
            >
              <Text style={styles.displayNameText}>{fullName || 'Tap to add your full name'}</Text>
              <Ionicons name="pencil" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Display Name */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Display Name</Text>
          {isEditingDisplayName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.disabledButton]}
                onPress={handleSaveDisplayName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditingDisplayName(false);
                  setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'User');
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.displayNameContainer}
              onPress={() => setIsEditingDisplayName(true)}
            >
              <Text style={styles.displayNameText}>{displayName}</Text>
              <Ionicons name="pencil" size={16} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Account Section */}
      <Animated.View 
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim.interpolate({
              inputRange: [0, 30],
              outputRange: [0, 20]
            })}]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
          <View style={styles.settingItemLeft}>
            <Ionicons name="log-out" size={24} color="#e74c3c" />
            <Text style={[styles.settingItemText, { color: '#e74c3c' }]}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleClearAuthState}>
          <View style={styles.settingItemLeft}>
            <Ionicons name="refresh" size={24} color="#f39c12" />
            <Text style={[styles.settingItemText, { color: '#f39c12' }]}>Clear Auth State</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </Animated.View>

      {/* Loading Overlay */}
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2089dc" />
          <Text style={styles.loadingText}>Saving...</Text>
        </View>
      )}

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Avatar</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAvatarModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.avatarGrid} showsVerticalScrollIndicator={false}>
            <View style={styles.avatarGridContainer}>
              {AVATAR_OPTIONS.map((avatar) => (
                <TouchableOpacity
                  key={avatar.id}
                  style={[
                    styles.avatarOption,
                    selectedAvatar?.id === avatar.id && styles.selectedAvatarOption
                  ]}
                  onPress={() => handleAvatarSelect(avatar)}
                >
                  <Text style={styles.avatarOptionEmoji}>{avatar.emoji}</Text>
                  <Text style={[
                    styles.avatarOptionName,
                    selectedAvatar?.id === avatar.id && styles.selectedAvatarOptionName
                  ]}>
                    {avatar.name}
                  </Text>
                  {selectedAvatar?.id === avatar.id && (
                    <View style={styles.selectedIndicator}>
                      <Ionicons name="checkmark-circle" size={20} color="#2089dc" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2089dc',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 15,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarDisplay: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  avatarName: {
    fontSize: 14,
    color: '#2089dc',
    fontWeight: '500',
    marginTop: 4,
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2089dc',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLabel: {
    fontSize: 14,
    color: '#666',
  },
  inputSection: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  editNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#2089dc',
    borderRadius: 8,
    padding: 10,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  displayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  displayNameText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginTop: 8,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  avatarGrid: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  avatarOption: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  selectedAvatarOption: {
    borderColor: '#2089dc',
    backgroundColor: '#e3f2fd',
  },
  avatarOptionEmoji: {
    fontSize: 30,
    marginBottom: 5,
  },
  avatarOptionName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedAvatarOptionName: {
    color: '#2089dc',
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  scrollContent: {
    paddingBottom: 30,
  },
});
