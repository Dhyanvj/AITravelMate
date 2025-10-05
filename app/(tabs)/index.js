import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Badge, Button, Card, Icon } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';

// Avatar options (same as in settings)
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

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0
  });
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;


  useEffect(() => {
    fetchUserData();
    fetchTrips();
    fetchStats();
    
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Start subtle pulse animation for action buttons
    const startPulseAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    // Start pulse animation after initial load
    setTimeout(startPulseAnimation, 1000);
  }, []);

  // Refresh data when screen comes into focus (e.g., returning from settings)
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchTrips();
      fetchStats();
    }, [])
  );


  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        // Load avatar information
        const avatarId = user.user_metadata?.avatar_id || profileData?.avatar_id;
        if (avatarId) {
          const avatar = AVATAR_OPTIONS.find(option => option.id === avatarId);
          setSelectedAvatar(avatar || AVATAR_OPTIONS[0]);
        } else {
          setSelectedAvatar(AVATAR_OPTIONS[0]); // Default avatar
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('trip_members')
        .select(`
          *,
          trip:trip_id (*)
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(5);

      setUpcomingTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all trips for the user with trip details
      const { data: trips } = await supabase
        .from('trip_members')
        .select(`
          trip_id,
          trip:trip_id (
            id,
            status
          )
        `)
        .eq('user_id', user.id);

      const totalTrips = trips?.length || 0;
      const activeTrips = trips?.filter(t => t.trip?.status !== 'completed' && t.trip?.status !== 'cancelled').length || 0;

      setStats({
        totalTrips,
        activeTrips
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserData(), fetchTrips(), fetchStats()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header with Quick Access Button */}
      <LinearGradient
        colors={['#2089dc', '#4da6ff']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarEmoji}>
                {selectedAvatar?.emoji || '🧳'}
              </Text>
            </View>
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>
                {profile?.full_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'}!
              </Text>
            </View>
          </View>

        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeTrips}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Active Trips */}
        <Animated.View
          style={[
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
            <Text style={styles.sectionTitle}>Active Trips</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/group-trips')}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {upcomingTrips.length > 0 ? (
            upcomingTrips.slice(0, 3).map((item, index) => (
              <TouchableOpacity
                key={item.trip?.id || index}
                style={styles.tripCard}
                onPress={() => router.push(`/trip/${item.trip?.id}`)}
              >
                <View style={styles.tripCardContent}>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripTitle}>{item.trip?.title || 'Untitled Trip'}</Text>
                    <Text style={styles.tripDestination}>{item.trip?.destination || 'No destination'}</Text>
                    <View style={styles.tripMeta}>
                      <Icon name="calendar" type="feather" size={14} color="#666" />
                      <Text style={styles.tripDate}>
                        {item.trip?.start_date ? new Date(item.trip.start_date).toLocaleDateString() : 'No date'}
                      </Text>
                      {item.role === 'owner' && (
                        <Badge value="Owner" status="error" containerStyle={styles.roleBadge} />
                      )}
                    </View>
                  </View>
                  <Icon name="chevron-right" type="material" color="#ccc" />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active trips</Text>
              <Button
                title="Create Your First Trip"
                buttonStyle={styles.createButton}
                onPress={() => router.push('/(tabs)/planning')}
              />
            </View>
          )}
          </Card>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          style={[
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
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/planning')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                  <Icon name="add" type="material" color="#fff" size={24} />
                </View>
                <Text style={styles.actionText}>New Trip</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/group-trips')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF9800' }]}>
                <Icon name="group-add" type="material" color="#fff" size={24} />
              </View>
              <Text style={styles.actionText}>Join Trip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/screens/chat')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Icon name="smart-toy" type="material" color="#fff" size={24} />
              </View>
              <Text style={styles.actionText}>AI Assistant</Text>
            </TouchableOpacity>
          </View>
          </Card>
        </Animated.View>

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  welcomeText: {
    marginLeft: 12,
  },
  greeting: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 15,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 3,
  },
  card: {
    borderRadius: 20,
    marginHorizontal: 15,
    marginTop: 15,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  lastCard: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    color: '#2089dc',
    fontSize: 14,
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tripCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tripDestination: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripDate: {
    fontSize: 12,
    color: '#999',
    marginLeft: 5,
  },
  roleBadge: {
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingHorizontal: 30,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
    textAlign: 'center',
  },
});