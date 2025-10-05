import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Icon } from 'react-native-elements';
import ChatTab from '../../src/components/tabs/ChatTab';
import ExpenseTab from '../../src/components/tabs/ExpenseTab';
import ItineraryTab from '../../src/components/tabs/ItineraryTab';
import PackingTab from '../../src/components/tabs/PackingTab';
import TripManagementModal from '../../src/components/TripManagementModal';
import { supabase } from '../../src/services/supabase/supabaseClient';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('member');
  const [showManagementModal, setShowManagementModal] = useState(false);

  useEffect(() => {
    fetchTripDetails();
  }, [id]);

  const fetchTripDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTrip(data);

      // Get current user's role in this trip
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tripMember } = await supabase
          .from('trip_members')
          .select('role')
          .eq('trip_id', id)
          .eq('user_id', user.id)
          .single();
        
        if (tripMember) {
          setUserRole(tripMember.role);
        } else if (data.created_by === user.id) {
          setUserRole('owner');
        }
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  const handleTripUpdated = () => {
    fetchTripDetails();
  };

  const tabs = [
    { id: 'itinerary', title: 'Itinerary', icon: 'event-note' },
    { id: 'expenses', title: 'Money', icon: 'attach-money' },
    { id: 'packing', title: 'Packing', icon: 'luggage' },
    { id: 'chat', title: 'Chat', icon: 'chat' }
  ];

  const renderTabContent = () => {
    switch(activeTab) {
      case 'itinerary':
        return (
          <ItineraryTab tripId={id} userRole={userRole} />
        );

      case 'expenses':
        return (
          <ExpenseTab tripId={id} userRole={userRole} />
        );

      case 'packing':
        return (
          <PackingTab tripId={id} userRole={userRole} />
        );

      case 'chat':
        return (
          <ChatTab tripId={id} userRole={userRole} />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading trip details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" type="material" color="#333" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.tripTitle}>{trip?.title || 'Trip Details'}</Text>
          <Text style={styles.tripLocation}>{trip?.destination}</Text>
        </View>

        <View style={styles.headerActions}>
          {(userRole === 'owner' || userRole === 'admin') && (
            <TouchableOpacity 
              onPress={() => setShowManagementModal(true)}
              style={styles.manageButton}
            >
              <Icon name="settings" type="material" color="#666" size={20} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/screens/chat')}>
            <View style={styles.aiButton}>
              <Icon name="auto-awesome" type="material" color="#9C27B0" size={20} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Icon
              name={tab.icon}
              type="material"
              size={20}
              color={activeTab === tab.id ? '#00BFA5' : '#999'}
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Trip Management Modal */}
      <TripManagementModal
        visible={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        trip={trip}
        userRole={userRole}
        onTripUpdated={handleTripUpdated}
      />
    </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tripLocation: {
    fontSize: 14,
    color: '#666',
  },
  aiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00BFA5',
  },
  tabText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  activeTabText: {
    color: '#00BFA5',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
    marginBottom: 10,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 25,
    marginTop: 20,
  },
  balanceCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  balanceTitle: {
    fontSize: 14,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00BFA5',
    marginTop: 5,
  },
});