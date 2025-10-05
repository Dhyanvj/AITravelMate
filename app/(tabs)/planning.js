import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Icon } from 'react-native-elements';
import groupTripService from '../../src/services/groupTripService';
import { supabase } from '../../src/services/supabase/supabaseClient';

const TRIP_TYPES = [
  { id: 'beach', label: 'Beach', icon: '🏖️', color: '#00BCD4', gradient: ['#00BCD4', '#26C6DA'] },
  { id: 'camping', label: 'Camping', icon: '⛺', color: '#4CAF50', gradient: ['#4CAF50', '#66BB6A'] },
  { id: 'city', label: 'City Trip', icon: '🏙️', color: '#9C27B0', gradient: ['#9C27B0', '#BA68C8'] },
  { id: 'road-trip', label: 'Road Trip', icon: '🚗', color: '#FF9800', gradient: ['#FF9800', '#FFB74D'] },
  { id: 'custom', label: 'Custom', icon: '✨', color: '#607D8B', gradient: ['#607D8B', '#78909C'] }
];

const { width } = Dimensions.get('window');

export default function PlanningScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const tripTypeAnimations = useRef(TRIP_TYPES.map(() => new Animated.Value(0))).current;
  const advancedHeightAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const [tripData, setTripData] = useState({
    title: '',
    destination: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    tripType: 'beach',
    budget: '',
    maxMembers: '',
    isPrivate: false,
    requireApproval: false,
    autoExpireDays: 30
  });

  // Initialize animations
  useEffect(() => {
    const startAnimations = () => {
      // Header animation
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Main content animations
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
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Staggered trip type animations
      tripTypeAnimations.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });
    };

    startAnimations();
  }, []);

  // Handle advanced settings toggle with animation
  const toggleAdvanced = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAdvanced(!showAdvanced);
    
    Animated.timing(advancedHeightAnim, {
      toValue: showAdvanced ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const validateForm = () => {
    if (!tripData.title.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return false;
    }
    if (!tripData.destination.trim()) {
      Alert.alert('Error', 'Please enter a destination');
      return false;
    }
    if (tripData.startDate >= tripData.endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return false;
    }
    return true;
  };

  const createTrip = async () => {
    if (!validateForm()) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const tripPayload = {
        title: tripData.title,
        destination: tripData.destination,
        description: tripData.description,
        start_date: tripData.startDate.toISOString().split('T')[0],
        end_date: tripData.endDate.toISOString().split('T')[0],
        trip_type: tripData.tripType,
        budget: parseFloat(tripData.budget) || null,
        status: 'active',
        trip_details: {
          max_members: parseInt(tripData.maxMembers) || null,
          is_private: tripData.isPrivate,
          require_approval: tripData.requireApproval
        }
      };

      const { trip, inviteCode } = await groupTripService.createTrip(tripPayload, user.id);

      // Create trip settings
      await supabase
        .from('trip_settings')
        .insert([{
          trip_id: trip.id,
          allow_expense_editing: true,
          require_admin_approval: tripData.requireApproval,
          auto_split_expenses: true,
          budget_limit: parseFloat(tripData.budget) || null
        }]);

      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Success!',
        `Trip created! Your invite code is: ${inviteCode}`,
        [
          {
            text: 'Share Invite',
            onPress: () => shareInviteCode(inviteCode, trip.title)
          },
          {
            text: 'View Trip',
            onPress: () => router.push(`/trip/${trip.id}`)
          }
        ]
      );

      // Reset form
      setTripData({
        title: '',
        destination: '',
        description: '',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        tripType: 'beach',
        budget: '',
        maxMembers: '',
        isPrivate: false,
        requireApproval: false,
        autoExpireDays: 30
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const shareInviteCode = async (code, tripName) => {
    try {
      await Share.share({
        message: `Join my trip to ${tripName}!\n\nInvite Code: ${code}\n\nDownload AITravelMate to join.`,
        title: 'Trip Invitation'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2089dc" />
      

      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

        {/* Basic Information */}
        <Animated.View
          style={[
            styles.animatedCard,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <Card containerStyle={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trip Details</Text>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionEmoji}>📝</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'title' && styles.inputWrapperFocused
              ]}>
                <Icon name="label" type="material" color={focusedInput === 'title' ? '#2089dc' : '#999'} size={20} />
                <TextInput
                  style={styles.customInput}
                  placeholder="Trip Name"
                  placeholderTextColor="#999"
                  value={tripData.title}
                  onChangeText={(text) => setTripData({ ...tripData, title: text })}
                  onFocus={() => setFocusedInput('title')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[
                styles.inputWrapper,
                focusedInput === 'destination' && styles.inputWrapperFocused
              ]}>
                <Icon name="place" type="material" color={focusedInput === 'destination' ? '#2089dc' : '#999'} size={20} />
                <TextInput
                  style={styles.customInput}
                  placeholder="Destination"
                  placeholderTextColor="#999"
                  value={tripData.destination}
                  onChangeText={(text) => setTripData({ ...tripData, destination: text })}
                  onFocus={() => setFocusedInput('destination')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[
                styles.inputWrapper,
                styles.textAreaWrapper,
                focusedInput === 'description' && styles.inputWrapperFocused
              ]}>
                <View style={styles.textAreaIconContainer}>
                  <Icon name="description" type="material" color={focusedInput === 'description' ? '#2089dc' : '#999'} size={20} />
                </View>
                <TextInput
                  style={styles.textArea}
                  placeholder="Description (optional)"
                  placeholderTextColor="#999"
                  value={tripData.description}
                  onChangeText={(text) => setTripData({ ...tripData, description: text })}
                  multiline
                  numberOfLines={3}
                  onFocus={() => setFocusedInput('description')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Trip Type */}
        <Animated.View
          style={[
            styles.animatedCard,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 20]
                })},
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <Card containerStyle={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trip Type</Text>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionEmoji}>🎯</Text>
              </View>
            </View>
            <View style={styles.tripTypeGrid}>
              {TRIP_TYPES.map((type, index) => (
                <Animated.View
                  key={type.id}
                  style={[
                    {
                      opacity: tripTypeAnimations[index],
                      transform: [{
                        scale: tripTypeAnimations[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1]
                        })
                      }]
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.tripTypeCard,
                      tripData.tripType === type.id && styles.tripTypeCardSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTripData({ ...tripData, tripType: type.id });
                    }}
                    activeOpacity={0.8}
                  >
                    {tripData.tripType === type.id ? (
                      <LinearGradient
                        colors={type.gradient}
                        style={styles.tripTypeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.tripTypeIcon}>{type.icon}</Text>
                        <Text style={[styles.tripTypeLabel, styles.tripTypeLabelSelected]}>
                          {type.label}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.tripTypeContent}>
                        <Text style={styles.tripTypeIcon}>{type.icon}</Text>
                        <Text style={styles.tripTypeLabel}>
                          {type.label}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Dates */}
        <Animated.View
          style={[
            styles.animatedCard,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 30]
                })},
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <Card containerStyle={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trip Dates</Text>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionEmoji}>📅</Text>
              </View>
            </View>

            <View style={styles.dateContainer}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowStartDate(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dateIconContainer}>
                  <Icon name="calendar-today" type="material" color="#2089dc" size={20} />
                </View>
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>{tripData.startDate.toDateString()}</Text>
                </View>
                <Icon name="chevron-right" type="material" color="#ccc" size={20} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowEndDate(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dateIconContainer}>
                  <Icon name="calendar-today" type="material" color="#2089dc" size={20} />
                </View>
                <View style={styles.dateContent}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>{tripData.endDate.toDateString()}</Text>
                </View>
                <Icon name="chevron-right" type="material" color="#ccc" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.durationInfo}>
              <LinearGradient
                colors={['#e8f5e9', '#f1f8e9']}
                style={styles.durationGradient}
              >
                <Icon name="schedule" type="material" color="#00BFA5" size={18} />
                <Text style={styles.durationText}>
                  Duration: {Math.ceil((tripData.endDate - tripData.startDate) / (1000 * 60 * 60 * 24))} days
                </Text>
              </LinearGradient>
            </View>

            {showStartDate && (
              <DateTimePicker
                value={tripData.startDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartDate(false);
                  if (selectedDate) {
                    setTripData({ ...tripData, startDate: selectedDate });
                  }
                }}
              />
            )}

            {showEndDate && (
              <DateTimePicker
                value={tripData.endDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndDate(false);
                  if (selectedDate) {
                    setTripData({ ...tripData, endDate: selectedDate });
                  }
                }}
              />
            )}
          </Card>
        </Animated.View>

        {/* Advanced Settings */}
        <Animated.View
          style={[
            styles.animatedCard,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 40]
                })},
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <Card containerStyle={styles.card}>
            <TouchableOpacity
              style={styles.advancedHeader}
              onPress={toggleAdvanced}
              activeOpacity={0.7}
            >
              <View style={styles.advancedHeaderContent}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Advanced Settings</Text>
                  <View style={styles.sectionIcon}>
                    <Text style={styles.sectionEmoji}>⚙️</Text>
                  </View>
                </View>
                <Animated.View
                  style={{
                    transform: [{
                      rotate: advancedHeightAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg']
                      })
                    }]
                  }}
                >
                  <Icon
                    name="keyboard-arrow-down"
                    type="material"
                    color="#2089dc"
                    size={24}
                  />
                </Animated.View>
              </View>
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.advancedContent,
                {
                  height: advancedHeightAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 400]
                  }),
                  opacity: advancedHeightAnim
                }
              ]}
            >
              <View style={styles.advancedInputs}>
                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'budget' && styles.inputWrapperFocused
                ]}>
                  <Icon name="attach-money" type="material" color={focusedInput === 'budget' ? '#2089dc' : '#999'} size={20} />
                  <TextInput
                    style={styles.customInput}
                    placeholder="Budget (optional)"
                    placeholderTextColor="#999"
                    value={tripData.budget}
                    onChangeText={(text) => setTripData({ ...tripData, budget: text })}
                    keyboardType="numeric"
                    onFocus={() => setFocusedInput('budget')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>

                <View style={[
                  styles.inputWrapper,
                  focusedInput === 'maxMembers' && styles.inputWrapperFocused
                ]}>
                  <Icon name="group" type="material" color={focusedInput === 'maxMembers' ? '#2089dc' : '#999'} size={20} />
                  <TextInput
                    style={styles.customInput}
                    placeholder="Max members (optional)"
                    placeholderTextColor="#999"
                    value={tripData.maxMembers}
                    onChangeText={(text) => setTripData({ ...tripData, maxMembers: text })}
                    keyboardType="numeric"
                    onFocus={() => setFocusedInput('maxMembers')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>

                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTripData({ ...tripData, isPrivate: !tripData.isPrivate });
                    }}
                  >
                    <View style={[
                      styles.checkbox,
                      tripData.isPrivate && styles.checkboxChecked
                    ]}>
                      {tripData.isPrivate && <Icon name="check" type="material" color="#fff" size={16} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Private trip (invite only)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTripData({ ...tripData, requireApproval: !tripData.requireApproval });
                    }}
                  >
                    <View style={[
                      styles.checkbox,
                      tripData.requireApproval && styles.checkboxChecked
                    ]}>
                      {tripData.requireApproval && <Icon name="check" type="material" color="#fff" size={16} />}
                    </View>
                    <Text style={styles.checkboxLabel}>Require approval for new members</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.expireContainer}>
                  <Text style={styles.expireLabel}>Invite expires after:</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.expireOptions}
                  >
                    {[7, 30, 90].map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={[
                          styles.expireOption,
                          tripData.autoExpireDays === days && styles.expireOptionActive
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTripData({ ...tripData, autoExpireDays: days });
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.expireOptionText,
                          tripData.autoExpireDays === days && styles.expireOptionTextActive
                        ]}>
                          {days} days
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Animated.View>
          </Card>
        </Animated.View>

        {/* Create Button */}
        <Animated.View
          style={[
            styles.createButtonContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50]
                })},
                { scale: buttonScaleAnim }
              ]
            }
          ]}
        >
          <TouchableOpacity
            style={styles.createButton}
            onPress={createTrip}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={loading ? ['#ccc', '#999'] : ['#00BFA5', '#00E676']}
              style={styles.createButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Animated.View style={styles.loadingSpinner}>
                    <Icon name="refresh" type="material" color="#fff" size={20} />
                  </Animated.View>
                  <Text style={styles.createButtonText}>Creating Trip...</Text>
                </View>
              ) : (
                <View style={styles.createButtonContent}>
                  <Icon name="check" type="material" color="#fff" size={24} />
                  <Text style={styles.createButtonText}>Create Trip</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  headerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  animatedCard: {
    marginHorizontal: 15,
    marginTop: 8,
  },
  card: {
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionEmoji: {
    fontSize: 20,
  },
  inputGroup: {
    gap: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: '#2089dc',
    shadowColor: '#2089dc',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  customInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 15,
  },
  textAreaIconContainer: {
    alignSelf: 'flex-start',
    marginTop: 11,
  },
  textArea: {
    flex: 1,
    minHeight: 60,
    textAlignVertical: 'top',
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  tripTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tripTypeCard: {
    width: (width - 80) / 3,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  tripTypeCardSelected: {
    shadowOpacity: 0.2,
    elevation: 8,
  },
  tripTypeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  tripTypeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
  },
  tripTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  tripTypeLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  tripTypeLabelSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dateContainer: {
    gap: 12,
    marginBottom: 15,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateContent: {
    marginLeft: 15,
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  durationInfo: {
    marginTop: 10,
  },
  durationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
  },
  durationText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#00BFA5',
    fontWeight: 'bold',
  },
  advancedHeader: {
    marginBottom: 10,
  },
  advancedHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advancedContent: {
    overflow: 'hidden',
  },
  advancedInputs: {
    gap: 15,
  },
  checkboxContainer: {
    gap: 15,
    marginVertical: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#2089dc',
    borderColor: '#2089dc',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  expireContainer: {
    marginTop: 15,
  },
  expireLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    fontWeight: '500',
  },
  expireOptions: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    gap: 10,
  },
  expireOption: {
    minWidth: 80,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    marginRight: 10,
  },
  expireOptionActive: {
    backgroundColor: '#2089dc',
    borderColor: '#2089dc',
  },
  expireOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  expireOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  createButtonContainer: {
    marginHorizontal: 15,
    marginTop: 25,
    marginBottom: 30,
  },
  createButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  createButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 30,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    transform: [{ rotate: '0deg' }],
  },
});