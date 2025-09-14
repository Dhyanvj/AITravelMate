import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal
} from 'react-native';
import { Card, Button, Icon, Input, CheckBox } from 'react-native-elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../src/services/supabase/supabaseClient';
import groupTripService from '../../src/services/groupTripService';
import { useRouter } from 'expo-router';

const TRIP_TYPES = [
  { id: 'beach', label: 'Beach', icon: '🏖️', color: '#00BCD4' },
  { id: 'camping', label: 'Camping', icon: '⛺', color: '#4CAF50' },
  { id: 'city', label: 'City Trip', icon: '🏙️', color: '#9C27B0' },
  { id: 'road-trip', label: 'Road Trip', icon: '🚗', color: '#FF9800' },
  { id: 'custom', label: 'Custom', icon: '✨', color: '#607D8B' }
];

export default function PlanningScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create New Trip</Text>
          <Text style={styles.headerSubtitle}>Plan your next adventure</Text>
        </View>

        {/* Basic Information */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <Input
            placeholder="Trip Name"
            value={tripData.title}
            onChangeText={(text) => setTripData({ ...tripData, title: text })}
            leftIcon={<Icon name="label" type="material" color="#999" size={20} />}
            containerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Destination"
            value={tripData.destination}
            onChangeText={(text) => setTripData({ ...tripData, destination: text })}
            leftIcon={<Icon name="place" type="material" color="#999" size={20} />}
            containerStyle={styles.inputContainer}
          />

          <Input
            placeholder="Description (optional)"
            value={tripData.description}
            onChangeText={(text) => setTripData({ ...tripData, description: text })}
            multiline
            numberOfLines={3}
            leftIcon={<Icon name="description" type="material" color="#999" size={20} />}
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Trip Type */}
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
                onPress={() => setTripData({ ...tripData, tripType: type.id })}
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

        {/* Dates */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Trip Dates</Text>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDate(true)}
          >
            <Icon name="calendar-today" type="material" color="#999" size={20} />
            <View style={styles.dateContent}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{tripData.startDate.toDateString()}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndDate(true)}
          >
            <Icon name="calendar-today" type="material" color="#999" size={20} />
            <View style={styles.dateContent}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>{tripData.endDate.toDateString()}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.durationInfo}>
            <Icon name="schedule" type="material" color="#00BFA5" size={16} />
            <Text style={styles.durationText}>
              Duration: {Math.ceil((tripData.endDate - tripData.startDate) / (1000 * 60 * 60 * 24))} days
            </Text>
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

        {/* Advanced Settings */}
        <Card containerStyle={styles.card}>
          <TouchableOpacity
            style={styles.advancedHeader}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={styles.sectionTitle}>Advanced Settings</Text>
            <Icon
              name={showAdvanced ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              type="material"
              color="#999"
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedContent}>
              <Input
                placeholder="Budget (optional)"
                value={tripData.budget}
                onChangeText={(text) => setTripData({ ...tripData, budget: text })}
                keyboardType="numeric"
                leftIcon={<Icon name="attach-money" type="material" color="#999" size={20} />}
                containerStyle={styles.inputContainer}
              />

              <Input
                placeholder="Max members (optional)"
                value={tripData.maxMembers}
                onChangeText={(text) => setTripData({ ...tripData, maxMembers: text })}
                keyboardType="numeric"
                leftIcon={<Icon name="group" type="material" color="#999" size={20} />}
                containerStyle={styles.inputContainer}
              />

              <CheckBox
                title="Private trip (invite only)"
                checked={tripData.isPrivate}
                onPress={() => setTripData({ ...tripData, isPrivate: !tripData.isPrivate })}
                containerStyle={styles.checkbox}
              />

              <CheckBox
                title="Require approval for new members"
                checked={tripData.requireApproval}
                onPress={() => setTripData({ ...tripData, requireApproval: !tripData.requireApproval })}
                containerStyle={styles.checkbox}
              />

              <View style={styles.expireContainer}>
                <Text style={styles.expireLabel}>Invite expires after:</Text>
                <View style={styles.expireOptions}>
                  {[7, 30, 90].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.expireOption,
                        tripData.autoExpireDays === days && styles.expireOptionActive
                      ]}
                      onPress={() => setTripData({ ...tripData, autoExpireDays: days })}
                    >
                      <Text style={[
                        styles.expireOptionText,
                        tripData.autoExpireDays === days && styles.expireOptionTextActive
                      ]}>
                        {days} days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Create Button */}
        <Button
          title="Create Trip"
          loading={loading}
          buttonStyle={styles.createButton}
          titleStyle={styles.createButtonText}
          icon={<Icon name="check" type="material" color="#fff" size={20} />}
          onPress={createTrip}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: 15,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
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
    width: '30%',
    padding: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  tripTypeIcon: {
    fontSize: 28,
    marginBottom: 5,
  },
  tripTypeLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  dateContent: {
    marginLeft: 15,
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  durationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#00BFA5',
    fontWeight: 'bold',
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advancedContent: {
    marginTop: 15,
  },
  checkbox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginBottom: 10,
  },
  expireContainer: {
    marginTop: 10,
  },
  expireLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  expireOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  expireOption: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  expireOptionActive: {
    backgroundColor: '#00BFA5',
    borderColor: '#00BFA5',
  },
  expireOptionText: {
    fontSize: 14,
    color: '#666',
  },
  expireOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 25,
    paddingVertical: 15,
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 30,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});