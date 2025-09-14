import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Modal,
  Share
} from 'react-native';
import { Card, Button, Icon, Avatar, Badge, Input } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import groupTripService from '../../src/services/groupTripService';
import { supabase } from '../../src/services/supabase/supabaseClient';
import { useRouter } from 'expo-router';

export default function GroupTripsScreen() {
  const [trips, setTrips] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchGroupTrips();
  }, []);

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

  const handleCreateTrip = async () => {
    // Navigate to trip creation screen
    router.push('/(tabs)/planning');
  };

  const handleJoinTrip = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const trip = await groupTripService.joinTripWithCode(joinCode.toUpperCase(), user.id);

      Alert.alert('Success', `You've joined ${trip.title}!`);
      setShowJoinModal(false);
      setJoinCode('');
      fetchGroupTrips();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (trip) => {
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
      Alert.alert('Error', 'Could not generate invite code');
    }
  };

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join my trip to ${selectedTrip.destination}! Use code: ${inviteCode}\n\nDownload AI TravelMate to join.`,
        title: 'Trip Invitation'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const renderTripCard = ({ item }) => {
    const memberCount = item.trip.trip_members?.[0]?.count || 1;
    const isOwner = item.role === 'owner';
    const isAdmin = item.role === 'admin';

    return (
      <Card containerStyle={styles.tripCard}>
        <TouchableOpacity
          onPress={() => router.push(`/trip-details/${item.trip.id}`)}
        >
          <View style={styles.tripHeader}>
            <View style={styles.tripInfo}>
              <Text style={styles.tripTitle}>{item.trip.title}</Text>
              <Text style={styles.tripDestination}>{item.trip.destination}</Text>
              <View style={styles.tripMeta}>
                <Icon name="people" type="material" size={16} color="#666" />
                <Text style={styles.memberCount}>{memberCount} members</Text>
                {(isOwner || isAdmin) && (
                  <Badge
                    value={item.role}
                    status={isOwner ? 'error' : 'warning'}
                    containerStyle={styles.roleBadge}
                  />
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => generateInvite(item)}
            >
              <Icon name="person-add" type="material" color="#2089dc" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2089dc', '#4da6ff']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Group Trips</Text>
        <Text style={styles.headerSubtitle}>Plan together, travel better</Text>
      </LinearGradient>

      <View style={styles.actionButtons}>
        <Button
          title="Create Trip"
          icon={<Icon name="add" type="material" color="#fff" size={20} />}
          buttonStyle={[styles.actionButton, styles.createButton]}
          onPress={handleCreateTrip}
        />
        <Button
          title="Join Trip"
          icon={<Icon name="group-add" type="material" color="#fff" size={20} />}
          buttonStyle={[styles.actionButton, styles.joinButton]}
          onPress={() => setShowJoinModal(true)}
        />
      </View>

      <FlatList
        data={trips}
        renderItem={renderTripCard}
        keyExtractor={(item) => item.trip.id}
        contentContainerStyle={styles.tripsList}
        ListEmptyComponent={
          <Card containerStyle={styles.emptyCard}>
            <Icon name="luggage" type="material" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No group trips yet</Text>
            <Text style={styles.emptySubtext}>
              Create a new trip or join an existing one
            </Text>
          </Card>
        }
      />

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Trip Invite</Text>

            {inviteCode && (
              <>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={inviteCode}
                    size={200}
                    backgroundColor="white"
                  />
                </View>

                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Invite Code:</Text>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                </View>

                <Button
                  title="Share Invite"
                  icon={<Icon name="share" type="material" color="#fff" />}
                  buttonStyle={styles.shareButton}
                  onPress={shareInvite}
                />
              </>
            )}

            <Button
              title="Close"
              buttonStyle={styles.closeButton}
              onPress={() => setShowInviteModal(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join a Trip</Text>

            <Input
              placeholder="Enter invite code"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              maxLength={6}
              containerStyle={styles.inputContainer}
              inputStyle={styles.codeInput}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                buttonStyle={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowJoinModal(false);
                  setJoinCode('');
                }}
              />
              <Button
                title="Join"
                loading={loading}
                buttonStyle={[styles.modalButton, styles.confirmButton]}
                onPress={handleJoinTrip}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  actionButton: {
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 12,
    minWidth: 140,
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  joinButton: {
    backgroundColor: '#FF9800',
  },
  tripsList: {
    paddingBottom: 20,
  },
  tripCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  tripDestination: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  roleBadge: {
    marginLeft: 10,
  },
  inviteButton: {
    padding: 10,
  },
  emptyCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginTop: 50,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2089dc',
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingHorizontal: 40,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#666',
    borderRadius: 25,
    paddingHorizontal: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    borderRadius: 25,
    paddingHorizontal: 30,
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
});