import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
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
import QRCode from 'react-native-qrcode-svg';
import TripManagementModal from '../../src/components/TripManagementModal';
import groupTripService from '../../src/services/groupTripService';
import { supabase } from '../../src/services/supabase/supabaseClient';

const { width } = Dimensions.get('window');

export default function GroupTripsScreen() {
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [selectedTripForManagement, setSelectedTripForManagement] = useState(null);
  const router = useRouter();

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef([]).current;

  useEffect(() => {
    fetchGroupTrips();
    startAnimations();
  }, []);

  useEffect(() => {
    filterTrips();
  }, [trips, statusFilter]);

  // Initialize animations
  const startAnimations = () => {
    // Header animation
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Action buttons animation
    Animated.timing(buttonAnim, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Filter animation
    Animated.timing(filterAnim, {
      toValue: 1,
      duration: 500,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Main content animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchGroupTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch trips where user is a member
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          *,
          trip:trip_id (
            *,
            trip_members (
              count
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const filterTrips = () => {
    let filtered = trips;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.trip.status === statusFilter);
    }

    setFilteredTrips(filtered);
  };

  const handleCreateTrip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/planning');
  };

  const handleJoinTrip = async () => {
    if (!joinCode.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const trip = await groupTripService.joinTripWithCode(joinCode.toUpperCase(), user.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `You've joined ${trip.title}!`);
      setShowJoinModal(false);
      setJoinCode('');
      fetchGroupTrips();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (trip) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get existing invite code
      const { data: invite } = await supabase
        .from('trip_invites')
        .select('invite_code')
        .eq('trip_id', trip.trip.id)
        .single();

      if (invite) {
        setInviteCode(invite.invite_code);
        setSelectedTrip(trip.trip);
        setShowInviteModal(true);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not generate invite code');
    }
  };

  const shareInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Join my trip to ${selectedTrip.destination}! Use code: ${inviteCode}\n\nDownload AI TravelMate to join.`,
        title: 'Trip Invitation'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleEditTrip = (tripItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTripForManagement(tripItem);
    setShowManagementModal(true);
  };


  const handleLeaveTrip = (tripItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Leave Trip',
      `Are you sure you want to leave "${tripItem.trip.title}"? You will no longer have access to this trip's content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              await groupTripService.leaveTrip(tripItem.trip.id, user.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'You have left the trip successfully');
              fetchGroupTrips();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteTrip = (tripItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone and will remove all trip data including expenses, itineraries, and chat messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              await groupTripService.deleteTrip(tripItem.trip.id, user.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Trip deleted successfully');
              fetchGroupTrips();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleTripUpdated = () => {
    fetchGroupTrips();
    setShowManagementModal(false);
    setSelectedTripForManagement(null);
  };

  const renderTripCard = ({ item, index }) => {
    const memberCount = item.trip.trip_members?.[0]?.count || 1;
    const isOwner = item.role === 'owner';
    const isAdmin = item.role === 'admin';
    const status = item.trip.status;
    const canManage = isOwner || isAdmin;

    // Initialize card animation if not exists
    if (!cardAnimations[index]) {
      cardAnimations[index] = new Animated.Value(0);
    }

    // Animate card entrance - moved outside of useEffect
    if (cardAnimations[index]._value === 0) {
      Animated.timing(cardAnimations[index], {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }

    const getStatusColor = (status) => {
      switch (status) {
        case 'active': return '#4CAF50';
        case 'completed': return '#2196F3';
        case 'cancelled': return '#F44336';
        default: return '#666';
      }
    };

    const getStatusGradient = (status) => {
      switch (status) {
        case 'active': return ['#4CAF50', '#66BB6A'];
        case 'completed': return ['#2196F3', '#42A5F5'];
        case 'cancelled': return ['#F44336', '#EF5350'];
        default: return ['#666', '#999'];
      }
    };

    return (
      <Animated.View
        style={[
          styles.animatedCard,
          {
            opacity: cardAnimations[index],
            transform: [
              {
                translateY: cardAnimations[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              },
              {
                scale: cardAnimations[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1]
                })
              }
            ]
          }
        ]}
      >
      <Card containerStyle={styles.tripCard}>
        <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/trip/${item.trip.id}`);
            }}
            activeOpacity={0.8}
        >
          <View style={styles.tripHeader}>
            <View style={styles.tripInfo}>
                <View style={styles.tripTitleContainer}>
              <Text style={styles.tripTitle}>
                {item.trip.title}
              </Text>
                  <View style={styles.tripDestinationContainer}>
                    <Icon name="place" type="material" size={14} color="#666" />
              <Text style={styles.tripDestination}>{item.trip.destination}</Text>
                  </View>
                </View>
                
              <View style={styles.tripMeta}>
                  <View style={styles.memberInfo}>
                <Icon name="people" type="material" size={16} color="#666" />
                <Text style={styles.memberCount}>{memberCount} members</Text>
                  </View>
                  
                  <View style={styles.statusContainer}>
                    <LinearGradient
                      colors={getStatusGradient(status)}
                      style={styles.statusBadge}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <View style={[styles.statusIndicator, { backgroundColor: '#fff' }]} />
                <Text style={styles.statusText}>{status}</Text>
                    </LinearGradient>
                  </View>
                  
                {(isOwner || isAdmin) && (
                    <View style={[
                      styles.roleBadge,
                      { backgroundColor: isOwner ? '#FFEBEE' : '#FFF3E0' }
                    ]}>
                      <Text style={[
                        styles.roleBadgeText,
                        { color: isOwner ? '#F44336' : '#FF9800' }
                      ]}>
                        {item.role}
                      </Text>
                    </View>
                )}
              </View>
            </View>
              
            <View style={styles.tripActions}>
              <TouchableOpacity
                  style={styles.inviteButton}
                onPress={() => generateInvite(item)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#2089dc', '#4da6ff']}
                    style={styles.inviteButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Icon name="person-add" type="material" color="#fff" size={20} />
                  </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* Management Actions */}
        <View style={styles.managementActions}>
          {/* Leave Trip button - available to all members except owners */}
          {!isOwner && (
            <TouchableOpacity
              style={[styles.managementButton, styles.leaveButton]}
              onPress={() => handleLeaveTrip(item)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#F3E5F5', '#E1BEE7']}
                  style={styles.managementButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
            >
              <Icon name="exit-to-app" type="material" color="#9C27B0" size={16} />
              <Text style={styles.managementButtonText}>Leave</Text>
                </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Admin/Owner actions */}
          {canManage && (
            <>
              <TouchableOpacity
                style={[styles.managementButton, styles.editButton]}
                onPress={() => handleEditTrip(item)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#E8F5E8', '#C8E6C9']}
                    style={styles.managementButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
              >
                <Icon name="edit" type="material" color="#4CAF50" size={16} />
                <Text style={styles.managementButtonText}>Edit</Text>
                  </LinearGradient>
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity
                  style={[styles.managementButton, styles.deleteButton]}
                  onPress={() => handleDeleteTrip(item)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#FFEBEE', '#FFCDD2']}
                      style={styles.managementButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                >
                  <Icon name="delete" type="material" color="#F44336" size={16} />
                  <Text style={styles.managementButtonText}>Delete</Text>
                    </LinearGradient>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Card>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2089dc" />

      {/* Enhanced Action Buttons */}
      <Animated.View
        style={[
          styles.actionButtons,
          {
            opacity: buttonAnim,
            transform: [
              {
                translateY: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0]
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.createButtonContainer}
          onPress={handleCreateTrip}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4CAF50', '#66BB6A']}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="add" type="material" color="#fff" size={20} />
            <Text style={styles.actionButtonText}>Create Trip</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.joinButtonContainer}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowJoinModal(true);
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FF9800', '#FFB74D']}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="group-add" type="material" color="#fff" size={20} />
            <Text style={styles.actionButtonText}>Join Trip</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Enhanced Filters */}
      <Animated.View
        style={[
          styles.filtersContainer,
          {
            opacity: filterAnim,
            transform: [
              {
                translateY: filterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Status:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterButtons}
            style={styles.filterScrollView}
          >
            {['all', 'active', 'completed', 'cancelled'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  statusFilter === status && styles.activeFilterButton
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStatusFilter(status);
                }}
                activeOpacity={0.7}
              >
                {statusFilter === status ? (
                  <LinearGradient
                    colors={['#2089dc', '#4da6ff']}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.activeFilterButtonText}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.filterButtonText}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.listContainer,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
      <FlatList
        data={filteredTrips}
        renderItem={renderTripCard}
        keyExtractor={(item) => item.trip.id}
        contentContainerStyle={styles.tripsList}
          showsVerticalScrollIndicator={false}
        ListEmptyComponent={
            <Animated.View
              style={[
                styles.emptyCard,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      scale: scaleAnim.interpolate({
                        inputRange: [0.95, 1],
                        outputRange: [0.9, 1]
                      })
                    }
                  ]
                }
              ]}
            >
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🧳</Text>
              </View>
            <Text style={styles.emptyText}>No group trips yet</Text>
            <Text style={styles.emptySubtext}>
              Create a new trip or join an existing one
            </Text>
            </Animated.View>
        }
      />
      </Animated.View>

      {/* Enhanced Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <Animated.View style={styles.modalContent}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Trip Invite</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowInviteModal(false);
                }}
              >
                <Icon name="close" type="material" color="#666" size={24} />
              </TouchableOpacity>
            </View>

            {inviteCode && (
              <>
                <View style={styles.qrContainer}>
                  <LinearGradient
                    colors={['#f8f9fa', '#e9ecef']}
                    style={styles.qrGradient}
                  >
                  <QRCode
                    value={inviteCode}
                      size={180}
                      backgroundColor="transparent"
                  />
                  </LinearGradient>
                </View>

                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Invite Code:</Text>
                  <View style={styles.codeDisplay}>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.shareButtonContainer}
                  onPress={shareInvite}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#66BB6A']}
                    style={styles.shareButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Icon name="share" type="material" color="#fff" size={20} />
                    <Text style={styles.shareButtonText}>Share Invite</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Enhanced Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <Animated.View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join a Trip</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowJoinModal(false);
                  setJoinCode('');
                }}
              >
                <Icon name="close" type="material" color="#666" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.joinInputContainer}>
              <Text style={styles.joinInputLabel}>Enter Invite Code</Text>
              <View style={styles.joinInputWrapper}>
                <TextInput
                  style={styles.joinInput}
                  placeholder="ABC123"
                  placeholderTextColor="#999"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  maxLength={6}
                  textAlign="center"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButtonContainer}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowJoinModal(false);
                  setJoinCode('');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButtonContainer}
                onPress={handleJoinTrip}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#FFA726', '#FB8C00'] : ['#4CAF50', '#66BB6A']}
                  style={styles.confirmButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <Text style={styles.confirmButtonText}>Joining...</Text>
                  ) : (
                    <Text style={styles.confirmButtonText}>Join Trip</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Trip Management Modal */}
      <TripManagementModal
        visible={showManagementModal}
        onClose={() => {
          setShowManagementModal(false);
          setSelectedTripForManagement(null);
        }}
        trip={selectedTripForManagement?.trip}
        userRole={selectedTripForManagement?.role}
        onTripUpdated={handleTripUpdated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 0,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 10,
  },
  createButtonContainer: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  joinButtonContainer: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterScrollView: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginRight: 12,
    minWidth: 50,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  filterButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#5a6c7d',
    textTransform: 'capitalize',
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  activeFilterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  tripsList: {
    paddingBottom: 20,
  },
  animatedCard: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  tripCard: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 14,
    marginHorizontal: 15,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tripInfo: {
    flex: 1,
  },
  tripTitleContainer: {
    marginBottom: 8,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  tripDestinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDestination: {
    fontSize: 13,
    color: '#5a6c7d',
    marginLeft: 5,
    fontWeight: '500',
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#5a6c7d',
    marginLeft: 5,
    fontWeight: '500',
  },
  statusContainer: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  tripActions: {
    marginLeft: 15,
  },
  inviteButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  managementActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
    gap: 8,
  },
  managementButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  managementButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  managementButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyCard: {
    marginHorizontal: 15,
    marginTop: 50,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    marginBottom: 25,
  },
  qrGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  codeLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  codeDisplay: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2089dc',
    letterSpacing: 3,
  },
  shareButtonContainer: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  joinInputContainer: {
    width: '100%',
    marginBottom: 25,
  },
  joinInputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    fontWeight: '500',
  },
  joinInputWrapper: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
  },
  joinInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 15,
    paddingHorizontal: 20,
    letterSpacing: 3,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  cancelButtonContainer: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  confirmButtonContainer: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});