import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Button, Card, Divider, Icon, Input } from 'react-native-elements';
import groupTripService from '../services/groupTripService';
import { supabase } from '../services/supabase/supabaseClient';

const TRIP_TYPES = [
  { id: 'beach', label: 'Beach', icon: '🏖️', color: '#00BCD4' },
  { id: 'camping', label: 'Camping', icon: '⛺', color: '#4CAF50' },
  { id: 'city', label: 'City Trip', icon: '🏙️', color: '#9C27B0' },
  { id: 'road-trip', label: 'Road Trip', icon: '🚗', color: '#FF9800' },
  { id: 'custom', label: 'Custom', icon: '✨', color: '#607D8B' }
];

const TRIP_STATUSES = [
  { id: 'active', label: 'Active', color: '#4CAF50' },
  { id: 'completed', label: 'Completed', color: '#2196F3' },
  { id: 'cancelled', label: 'Cancelled', color: '#F44336' }
];

export default function TripManagementModal({ 
  visible, 
  onClose, 
  trip, 
  userRole, 
  onTripUpdated 
}) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  const [tripData, setTripData] = useState({
    title: '',
    destination: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    tripType: 'beach',
    budget: '',
        status: 'active'
  });

  useEffect(() => {
    if (trip) {
      setTripData({
        title: trip.title || '',
        destination: trip.destination || '',
        description: trip.description || '',
        startDate: trip.start_date ? new Date(trip.start_date) : new Date(),
        endDate: trip.end_date ? new Date(trip.end_date) : new Date(),
        tripType: trip.trip_type || 'beach',
        budget: trip.budget ? trip.budget.toString() : '',
        status: trip.status || 'active',
      });
    }
  }, [trip]);

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

  const handleUpdateTrip = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData = {
        title: tripData.title,
        destination: tripData.destination,
        description: tripData.description,
        start_date: tripData.startDate.toISOString().split('T')[0],
        end_date: tripData.endDate.toISOString().split('T')[0],
        trip_type: tripData.tripType,
        budget: parseFloat(tripData.budget) || null,
        status: tripData.status
      };

      await groupTripService.updateTrip(trip.id, updateData, user.id);
      Alert.alert('Success', 'Trip updated successfully');
      onTripUpdated();
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await groupTripService.updateTripStatus(trip.id, newStatus, user.id);
      setTripData({ ...tripData, status: newStatus });
      Alert.alert('Success', `Trip status updated to ${newStatus}`);
      onTripUpdated();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone and will remove all trip data including expenses, itineraries, and chat messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              await groupTripService.deleteTrip(trip.id, user.id);
              Alert.alert('Success', 'Trip deleted successfully');
              onTripUpdated();
              onClose();
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const canEdit = userRole === 'owner' || userRole === 'admin';
  const canDelete = userRole === 'owner';

  if (!trip) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" type="material" color="#333" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Trip</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'edit' && styles.activeTab]}
            onPress={() => setActiveTab('edit')}
          >
            <Text style={[styles.tabText, activeTab === 'edit' && styles.activeTabText]}>
              Edit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'status' && styles.activeTab]}
            onPress={() => setActiveTab('status')}
          >
            <Text style={[styles.tabText, activeTab === 'status' && styles.activeTabText]}>
              Status
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {activeTab === 'edit' && (
            <View>
              <Card containerStyle={styles.card}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                
                <Input
                  label="Trip Name"
                  value={tripData.title}
                  onChangeText={(text) => setTripData({ ...tripData, title: text })}
                  disabled={!canEdit}
                  containerStyle={styles.inputContainer}
                />

                <Input
                  label="Destination"
                  value={tripData.destination}
                  onChangeText={(text) => setTripData({ ...tripData, destination: text })}
                  disabled={!canEdit}
                  containerStyle={styles.inputContainer}
                />

                <Input
                  label="Description"
                  value={tripData.description}
                  onChangeText={(text) => setTripData({ ...tripData, description: text })}
                  multiline
                  numberOfLines={3}
                  disabled={!canEdit}
                  containerStyle={styles.inputContainer}
                />
              </Card>

              <Card containerStyle={styles.card}>
                <Text style={styles.sectionTitle}>Trip Type</Text>
                <View style={styles.tripTypeGrid}>
                  {TRIP_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.tripTypeCard,
                        tripData.tripType === type.id && {
                          borderColor: type.color,
                          backgroundColor: `${type.color}10`
                        }
                      ]}
                      onPress={() => canEdit && setTripData({ ...tripData, tripType: type.id })}
                      disabled={!canEdit}
                    >
                      <Text style={styles.tripTypeIcon}>{type.icon}</Text>
                      <Text style={[
                        styles.tripTypeLabel,
                        tripData.tripType === type.id && { color: type.color, fontWeight: 'bold' }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>

              <Card containerStyle={styles.card}>
                <Text style={styles.sectionTitle}>Dates</Text>
                
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => canEdit && setShowStartDate(true)}
                  disabled={!canEdit}
                >
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>
                    {tripData.startDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => canEdit && setShowEndDate(true)}
                  disabled={!canEdit}
                >
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>
                    {tripData.endDate.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>

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

              <Card containerStyle={styles.card}>
                <Text style={styles.sectionTitle}>Budget</Text>
                <Input
                  label="Budget (optional)"
                  value={tripData.budget}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const filteredText = text.replace(/[^0-9.]/g, '');
                    const parts = filteredText.split('.');
                    const cleanText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filteredText;
                    setTripData({ ...tripData, budget: cleanText });
                  }}
                  keyboardType="decimal-pad"
                  disabled={!canEdit}
                  containerStyle={styles.inputContainer}
                />
              </Card>

              {canEdit && (
                <Button
                  title="Update Trip"
                  onPress={handleUpdateTrip}
                  loading={loading}
                  buttonStyle={styles.updateButton}
                />
              )}
              
              {/* Add bottom padding to ensure button is visible */}
              <View style={styles.bottomPadding} />
            </View>
          )}

          {activeTab === 'status' && (
            <View>
              <Card containerStyle={styles.card}>
                <Text style={styles.sectionTitle}>Trip Status</Text>
                <Text style={styles.currentStatus}>
                  Current Status: <Text style={[styles.statusText, { color: TRIP_STATUSES.find(s => s.id === tripData.status)?.color }]}>
                    {TRIP_STATUSES.find(s => s.id === tripData.status)?.label}
                  </Text>
                </Text>

                <Divider style={styles.divider} />

                {TRIP_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status.id}
                    style={[
                      styles.statusOption,
                      tripData.status === status.id && styles.selectedStatus
                    ]}
                    onPress={() => canEdit && handleStatusChange(status.id)}
                    disabled={!canEdit || tripData.status === status.id}
                  >
                    <View style={[styles.statusIndicator, { backgroundColor: status.color }]} />
                    <Text style={styles.statusLabel}>{status.label}</Text>
                    {tripData.status === status.id && (
                      <Icon name="check" type="material" color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </Card>

              <Card containerStyle={[styles.card, styles.dangerCard]}>
                <Text style={styles.dangerTitle}>Danger Zone</Text>
                <Text style={styles.dangerDescription}>
                  Once you delete a trip, there is no going back. Please be certain.
                </Text>
                <Button
                  title="Delete Trip"
                  onPress={handleDeleteTrip}
                  loading={loading}
                  buttonStyle={styles.deleteButton}
                  titleStyle={styles.deleteButtonText}
                />
              </Card>

            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00BFA5',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#00BFA5',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    borderRadius: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 10,
  },
  tripTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tripTypeCard: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    marginBottom: 10,
  },
  tripTypeIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  tripTypeLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateLabel: {
    fontSize: 16,
    color: '#333',
  },
  dateValue: {
    fontSize: 16,
    color: '#666',
  },
  updateButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 10,
    marginTop: 20,
  },
  currentStatus: {
    fontSize: 16,
    marginBottom: 15,
    color: '#333',
  },
  statusText: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 15,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedStatus: {
    backgroundColor: '#f0f8ff',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 15,
  },
  statusLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dangerSection: {
    marginTop: 20,
  },
  dangerCard: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 10,
  },
  dangerDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    borderRadius: 10,
  },
  deleteButtonText: {
    color: '#fff',
  },
  bottomPadding: {
    height: 50,
  }
});
