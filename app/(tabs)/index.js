import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated
} from 'react-native';
import { Card, Button, Icon, Avatar, Badge } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    totalExpenses: 0
  });
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const quickAccessItems = [
    {
      id: 'itinerary',
      title: 'Itinerary',
      icon: 'calendar',
      color: '#4CAF50',
      route: '/screens/itinerary'
    },
    {
      id: 'discover',
      title: 'Discover',
      icon: 'explore',
      color: '#FF9800',
      route: '/screens/discover'
    },
    {
      id: 'assistant',
      title: 'AI Assistant',
      icon: 'smart-toy',
      color: '#9C27B0',
      route: '/screens/chat'
    }
  ];

  useEffect(() => {
    fetchUserData();
    fetchTrips();
    fetchStats();
  }, []);

  const toggleQuickMenu = () => {
    if (!showQuickMenu) {
      setShowQuickMenu(true);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowQuickMenu(false));
    }
  };

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

      const { data: trips } = await supabase
        .from('trip_members')
        .select('trip_id')
        .eq('user_id', user.id);

      const { data: expenses } = await supabase
        .from('expense_splits')
        .select('amount_owed')
        .eq('user_id', user.id);

      const totalExpenses = expenses?.reduce((sum, exp) => sum + parseFloat(exp.amount_owed || 0), 0) || 0;

      setStats({
        totalTrips: trips?.length || 0,
        activeTrips: upcomingTrips.filter(t => t.trip?.status !== 'completed').length,
        totalExpenses: totalExpenses
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
            <Avatar
              rounded
              size="medium"
              title={profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              containerStyle={styles.avatar}
            />
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>
                {profile?.full_name || user?.email?.split('@')[0] || 'User'}!
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={toggleQuickMenu} style={styles.menuButton}>
            <Icon name="apps" type="material" color="#fff" size={28} />
          </TouchableOpacity>
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
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>${stats.totalExpenses.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Active Trips */}
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

        {/* Quick Actions */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/planning')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <Icon name="add" type="material" color="#fff" size={24} />
              </View>
              <Text style={styles.actionText}>New Trip</Text>
            </TouchableOpacity>

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
              onPress={() => router.push('/expenses')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                <Icon name="attach-money" type="material" color="#fff" size={24} />
              </View>
              <Text style={styles.actionText}>Expenses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/packing')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B0' }]}>
                <Icon name="luggage" type="material" color="#fff" size={24} />
              </View>
              <Text style={styles.actionText}>Packing</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Sign Out Button */}
        <Card containerStyle={[styles.card, styles.lastCard]}>
          <Button
            title="Sign Out"
            icon={<Icon name="logout" type="material" color="#fff" size={20} />}
            buttonStyle={styles.signOutButton}
            onPress={handleSignOut}
          />
        </Card>
      </ScrollView>

      {/* Quick Access Menu */}
      {showQuickMenu && (
        <Animated.View
          style={[
            styles.quickMenuOverlay,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={toggleQuickMenu}
          />
          <Animated.View
            style={[
              styles.quickMenuContainer,
              {
                transform: [{
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  })
                }],
                opacity: fadeAnim,
              }
            ]}
          >
            {quickAccessItems.map((item, index) => (
              <Animated.View
                key={item.id}
                style={[
                  styles.quickMenuItemWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [{
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      })
                    }]
                  }
                ]}
              >
                <TouchableOpacity
                  style={styles.quickMenuItem}
                  onPress={() => {
                    toggleQuickMenu();
                    router.push(item.route);
                  }}
                >
                  <View style={[styles.quickMenuIcon, { backgroundColor: item.color }]}>
                    <Icon name={item.icon} type="material" color="#fff" size={20} />
                  </View>
                  <Text style={styles.quickMenuText}>{item.title}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        </Animated.View>
      )}
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
  avatar: {
    backgroundColor: '#fff',
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
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    borderRadius: 15,
    marginHorizontal: 15,
    marginTop: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lastCard: {
    marginBottom: 20,
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
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#ff4444',
    borderRadius: 25,
  },
  quickMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  quickMenuContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  quickMenuItemWrapper: {
    marginVertical: 2,
  },
  quickMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    minWidth: 180,
    borderRadius: 8,
  },
  quickMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickMenuText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
});