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
import { Badge, Button, Card, Icon, Input } from 'react-native-elements';
import AIService from '../../services/ai/aiService';
import { supabase } from '../../services/supabase/supabaseClient';

export default function ItineraryTab({ tripId, userRole }) {
  const [activities, setActivities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tripDetails, setTripDetails] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    location: '',
    day: 1,
    time: new Date(),
    duration: '1',
    category: 'sightseeing'
  });

  const categories = [
    { id: 'sightseeing', label: 'Sightseeing', icon: 'camera', color: '#4CAF50' },
    { id: 'food', label: 'Food', icon: 'restaurant', color: '#FF9800' },
    { id: 'activity', label: 'Activity', icon: 'directions-run', color: '#2196F3' },
    { id: 'transport', label: 'Transport', icon: 'directions-car', color: '#9C27B0' },
    { id: 'accommodation', label: 'Hotel', icon: 'hotel', color: '#FF5722' },
    { id: 'other', label: 'Other', icon: 'more-horiz', color: '#607D8B' }
  ];

  useEffect(() => {
    fetchTripDetails();
    fetchActivities();
    fetchSuggestions();
    getCurrentUser();
  }, [tripId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchTripDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      setTripDetails(data);
    } catch (error) {
      console.error('Error fetching trip details:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select(`
          *,
          created_by:profiles!itineraries_created_by_fkey(
            full_name,
            username
          )
        `)
        .eq('trip_id', tripId)
        .order('day_number', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_suggestions')
        .select(`
          *,
          suggested_by:profiles!activity_suggestions_suggested_by_fkey(
            full_name,
            username
          ),
          activity_votes(
            user_id,
            vote_type
          )
        `)
        .eq('trip_id', tripId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const addActivity = async () => {
    if (!activityForm.title.trim()) {
      Alert.alert('Error', 'Please enter an activity title');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .insert([{
          trip_id: tripId,
          day_number: activityForm.day,
          activities: {
            title: activityForm.title,
            description: activityForm.description,
            location: activityForm.location,
            time: activityForm.time.toTimeString().split(' ')[0],
            duration: activityForm.duration,
            category: activityForm.category,
            completed: false
          }
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Activity added!');
      setShowAddModal(false);
      resetForm();
      fetchActivities();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const suggestActivity = async () => {
    if (!activityForm.title.trim()) {
      Alert.alert('Error', 'Please enter an activity title');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_suggestions')
        .insert([{
          trip_id: tripId,
          suggested_by: currentUser.id,
          activity_name: activityForm.title,
          description: activityForm.description,
          location: activityForm.location,
          time_slot: `Day ${activityForm.day} - ${activityForm.time.toTimeString().split(' ')[0]}`,
          status: userRole === 'owner' || userRole === 'admin' ? 'approved' : 'pending'
        }]);

      if (error) throw error;

      Alert.alert('Success', userRole === 'owner' || userRole === 'admin'
        ? 'Activity added!'
        : 'Activity suggested! Waiting for approval.');

      setShowSuggestModal(false);
      resetForm();
      fetchSuggestions();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const voteOnSuggestion = async (suggestionId, voteType) => {
    try {
      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('activity_votes')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .eq('user_id', currentUser.id)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote if clicking same button
          await supabase
            .from('activity_votes')
            .delete()
            .eq('id', existingVote.id);
        } else {
          // Update vote type
          await supabase
            .from('activity_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);
        }
      } else {
        // Create new vote
        await supabase
          .from('activity_votes')
          .insert([{
            suggestion_id: suggestionId,
            user_id: currentUser.id,
            vote_type: voteType
          }]);
      }

      // Update vote counts
      const { data: votes } = await supabase
        .from('activity_votes')
        .select('vote_type')
        .eq('suggestion_id', suggestionId);

      const voteCounts = {
        up: votes.filter(v => v.vote_type === 'up').length,
        down: votes.filter(v => v.vote_type === 'down').length,
        interested: votes.filter(v => v.vote_type === 'interested').length
      };

      await supabase
        .from('activity_suggestions')
        .update({
          votes_up: voteCounts.up,
          votes_down: voteCounts.down
        })
        .eq('id', suggestionId);

      fetchSuggestions();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const approveSuggestion = async (suggestionId) => {
    if (userRole !== 'owner' && userRole !== 'admin') {
      Alert.alert('Error', 'Only admins can approve suggestions');
      return;
    }

    try {
      const { data: suggestion } = await supabase
        .from('activity_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      // Add to itinerary
      await supabase
        .from('itineraries')
        .insert([{
          trip_id: tripId,
          day_number: parseInt(suggestion.time_slot.split(' ')[1]),
          activities: {
            title: suggestion.activity_name,
            description: suggestion.description,
            location: suggestion.location,
            time: suggestion.time_slot.split(' - ')[1] || '12:00',
            completed: false
          }
        }]);

      // Update suggestion status
      await supabase
        .from('activity_suggestions')
        .update({
          status: 'approved',
          approved_by: currentUser.id
        })
        .eq('id', suggestionId);

      Alert.alert('Success', 'Activity approved and added to itinerary!');
      fetchActivities();
      fetchSuggestions();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const generateAIItinerary = async () => {
    setLoading(true);
    try {
      const itinerary = await AIService.generateItinerary({
        destination: tripDetails.destination,
        startDate: tripDetails.start_date,
        endDate: tripDetails.end_date,
        budget: tripDetails.budget,
        tripType: tripDetails.trip_type,
        interests: [],
        travelers: 1,
        notes: tripDetails.description
      });

      // Add AI-generated activities to database
      for (const day of itinerary.dailyItinerary) {
        const activities = [
          { ...day.morning, time: '09:00' },
          { ...day.afternoon, time: '14:00' },
          { ...day.evening, time: '19:00' }
        ];

        for (const activity of activities) {
          await supabase
            .from('itineraries')
            .insert([{
              trip_id: tripId,
              day_number: day.day,
              activities: {
                title: activity.activity,
                description: activity.description,
                time: activity.time,
                duration: activity.duration,
                cost: activity.cost,
                completed: false
              }
            }]);
        }
      }

      Alert.alert('Success', 'AI itinerary generated!');
      fetchActivities();
      setShowAIModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate itinerary');
    } finally {
      setLoading(false);
    }
  };

  const toggleActivityComplete = async (activityId, currentStatus) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      const updatedActivities = {
        ...activity.activities,
        completed: !currentStatus
      };

      await supabase
        .from('itineraries')
        .update({ activities: updatedActivities })
        .eq('id', activityId);

      fetchActivities();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const deleteActivity = async (activityId) => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to delete this activity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('itineraries')
                .delete()
                .eq('id', activityId);
              fetchActivities();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete activity');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setActivityForm({
      title: '',
      description: '',
      location: '',
      day: 1,
      time: new Date(),
      duration: '1',
      category: 'sightseeing'
    });
  };

  const renderActivity = (activity) => {
    const activityData = activity.activities;
    const category = categories.find(c => c.id === activityData.category) || categories[0];

    return (
      <Card key={activity.id} containerStyle={styles.activityCard}>
        <View style={styles.activityHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
            <Icon name={category.icon} type="material" color="#fff" size={20} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={[
              styles.activityTitle,
              activityData.completed && styles.completedText
            ]}>
              {activityData.title}
            </Text>
            <Text style={styles.activityTime}>
              {activityData.time} • {activityData.duration}h
            </Text>
          </View>
          <View style={styles.activityActions}>
            <TouchableOpacity
              onPress={() => toggleActivityComplete(activity.id, activityData.completed)}
            >
              <Icon
                name={activityData.completed ? 'check-circle' : 'check-circle-outline'}
                type="material"
                color={activityData.completed ? '#4CAF50' : '#999'}
                size={24}
              />
            </TouchableOpacity>
            {(userRole === 'owner' || userRole === 'admin') && (
              <TouchableOpacity
                onPress={() => deleteActivity(activity.id)}
                style={{ marginLeft: 10 }}
              >
                <Icon name="delete" type="material" color="#ff4444" size={20} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {activityData.description && (
          <Text style={styles.activityDescription}>{activityData.description}</Text>
        )}
        {activityData.location && (
          <View style={styles.locationRow}>
            <Icon name="place" type="material" size={16} color="#666" />
            <Text style={styles.locationText}>{activityData.location}</Text>
          </View>
        )}
      </Card>
    );
  };

  const renderSuggestion = (suggestion) => {
    const userVote = suggestion.activity_votes?.find(v => v.user_id === currentUser?.id);

    return (
      <Card key={suggestion.id} containerStyle={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>{suggestion.activity_name}</Text>
          <Badge
            value="Pending"
            status="warning"
            containerStyle={styles.badge}
          />
        </View>

        {suggestion.description && (
          <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
        )}

        <Text style={styles.suggestedBy}>
          Suggested by {suggestion.suggested_by?.full_name || 'Unknown'}
        </Text>

        <View style={styles.voteContainer}>
          <TouchableOpacity
            style={[styles.voteButton, userVote?.vote_type === 'up' && styles.activeVote]}
            onPress={() => voteOnSuggestion(suggestion.id, 'up')}
          >
            <Icon name="thumb-up" type="material" size={20} color={userVote?.vote_type === 'up' ? '#4CAF50' : '#999'} />
            <Text style={styles.voteCount}>{suggestion.votes_up || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, userVote?.vote_type === 'down' && styles.activeVote]}
            onPress={() => voteOnSuggestion(suggestion.id, 'down')}
          >
            <Icon name="thumb-down" type="material" size={20} color={userVote?.vote_type === 'down' ? '#ff4444' : '#999'} />
            <Text style={styles.voteCount}>{suggestion.votes_down || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, userVote?.vote_type === 'interested' && styles.activeVote]}
            onPress={() => voteOnSuggestion(suggestion.id, 'interested')}
          >
            <Icon name="star" type="material" size={20} color={userVote?.vote_type === 'interested' ? '#FFD700' : '#999'} />
            <Text style={styles.voteCount}>Interested</Text>
          </TouchableOpacity>

          {(userRole === 'owner' || userRole === 'admin') && (
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => approveSuggestion(suggestion.id)}
            >
              <Icon name="check" type="material" size={20} color="#fff" />
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const getDaysArray = () => {
    if (!tripDetails) return [1];
    const start = new Date(tripDetails.start_date);
    const end = new Date(tripDetails.end_date);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: days }, (_, i) => i + 1);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          title="Add Activity"
          icon={<Icon name="add" type="material" color="#fff" size={20} />}
          buttonStyle={[styles.actionButton, { backgroundColor: '#00BFA5' }]}
          onPress={() => userRole === 'member' ? setShowSuggestModal(true) : setShowAddModal(true)}
        />
        <Button
          title="AI Generate"
          icon={<Icon name="auto-awesome" type="material" color="#fff" size={20} />}
          buttonStyle={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => setShowAIModal(true)}
        />
      </View>

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Suggestions</Text>
          {suggestions.map(renderSuggestion)}
        </View>
      )}

      {/* Day Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
        {getDaysArray().map(day => (
          <TouchableOpacity
            key={day}
            style={[styles.dayTab, selectedDay === day && styles.activeDayTab]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[styles.dayTabText, selectedDay === day && styles.activeDayTabText]}>
              Day {day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Activities List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Day {selectedDay} Activities</Text>
        {activities
          .filter(a => a.day_number === selectedDay)
          .map(renderActivity)}

        {activities.filter(a => a.day_number === selectedDay).length === 0 && (
          <Card containerStyle={styles.emptyCard}>
            <Text style={styles.emptyText}>No activities planned for this day</Text>
          </Card>
        )}
      </View>

      {/* Add/Suggest Activity Modal */}
      <Modal
        visible={showAddModal || showSuggestModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {showSuggestModal ? 'Suggest Activity' : 'Add Activity'}
            </Text>

            <Input
              placeholder="Activity Title"
              value={activityForm.title}
              onChangeText={(text) => setActivityForm({ ...activityForm, title: text })}
              leftIcon={<Icon name="label" type="material" color="#999" size={20} />}
            />

            <Input
              placeholder="Description (optional)"
              value={activityForm.description}
              onChangeText={(text) => setActivityForm({ ...activityForm, description: text })}
              multiline
              numberOfLines={3}
              leftIcon={<Icon name="description" type="material" color="#999" size={20} />}
            />

            <Input
              placeholder="Location"
              value={activityForm.location}
              onChangeText={(text) => setActivityForm({ ...activityForm, location: text })}
              leftIcon={<Icon name="place" type="material" color="#999" size={20} />}
            />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Day:</Text>
              <ScrollView horizontal style={styles.daySelector}>
                {getDaysArray().map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.daySelectorItem, activityForm.day === day && styles.selectedDay]}
                    onPress={() => setActivityForm({ ...activityForm, day })}
                  >
                    <Text style={[styles.daySelectorText, activityForm.day === day && styles.selectedDayText]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                buttonStyle={[styles.modalButton, { backgroundColor: '#999' }]}
                onPress={() => {
                  setShowAddModal(false);
                  setShowSuggestModal(false);
                  resetForm();
                }}
              />
              <Button
                title={showSuggestModal ? 'Suggest' : 'Add'}
                loading={loading}
                buttonStyle={[styles.modalButton, { backgroundColor: '#00BFA5' }]}
                onPress={showSuggestModal ? suggestActivity : addActivity}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Generation Modal */}
      <Modal
        visible={showAIModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate AI Itinerary</Text>
            <Text style={styles.modalDescription}>
              AI will create a complete itinerary based on your trip details and preferences.
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                buttonStyle={[styles.modalButton, { backgroundColor: '#999' }]}
                onPress={() => setShowAIModal(false)}
              />
              <Button
                title="Generate"
                loading={loading}
                buttonStyle={[styles.modalButton, { backgroundColor: '#9C27B0' }]}
                onPress={generateAIItinerary}
              />
            </View>
          </View>
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
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
  },
  actionButton: {
    borderRadius: 25,
    paddingHorizontal: 20,
    minWidth: 140,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 15,
    marginBottom: 10,
    color: '#333',
  },
  dayTabs: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeDayTab: {
    backgroundColor: '#00BFA5',
    borderColor: '#00BFA5',
  },
  dayTabText: {
    fontSize: 14,
    color: '#666',
  },
  activeDayTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  activityCard: {
    borderRadius: 12,
    marginHorizontal: 15,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 5,
  },
  suggestionCard: {
    borderRadius: 12,
    marginHorizontal: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  badge: {
    marginLeft: 10,
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  suggestedBy: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeVote: {
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
  },
  voteCount: {
    fontSize: 12,
    marginLeft: 5,
    color: '#666',
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  approveText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  emptyCard: {
    borderRadius: 12,
    marginHorizontal: 15,
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  formRow: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  daySelector: {
    flexDirection: 'row',
  },
  daySelectorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedDay: {
    backgroundColor: '#00BFA5',
  },
  daySelectorText: {
    fontSize: 14,
    color: '#666',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    borderRadius: 25,
    paddingHorizontal: 30,
    minWidth: 100,
  },
});