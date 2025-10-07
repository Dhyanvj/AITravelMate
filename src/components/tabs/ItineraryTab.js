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
import { Badge, Button, Card, Icon, Input } from 'react-native-elements';
import AIService from '../../services/ai/aiService';
import { supabase } from '../../services/supabase/supabaseClient';

export default function ItineraryTab({ tripId, userRole }) {
  const [activities, setActivities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [activeTab, setActiveTab] = useState('activities'); // 'suggestions' or 'activities'
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
    startTime: new Date(),
    durationHours: '1',
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
          suggested_by_profile:profiles!activity_suggestions_suggested_by_fkey(
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
          day_number: activityForm.day,
          time: activityForm.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          start_time: activityForm.startTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          duration_hours: parseFloat(activityForm.durationHours),
          status: 'pending'
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Activity suggested! It will appear in the suggestions list for approval.');

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
          day_number: suggestion.day_number,
          activities: {
            title: suggestion.activity_name,
            description: suggestion.description,
            location: suggestion.location,
            time: suggestion.start_time || suggestion.time || '12:00',
            duration: suggestion.duration_hours || '1',
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

  const editSuggestion = async () => {
    if (!activityForm.title.trim()) {
      Alert.alert('Error', 'Please enter an activity title');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('activity_suggestions')
        .update({
          activity_name: activityForm.title,
          description: activityForm.description,
          location: activityForm.location,
          day_number: activityForm.day,
          time: activityForm.time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          start_time: activityForm.startTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          duration_hours: parseFloat(activityForm.durationHours)
        })
        .eq('id', editingSuggestion.id);

      Alert.alert('Success', 'Suggestion updated successfully!');
      setShowEditModal(false);
      setEditingSuggestion(null);
      resetForm();
      fetchSuggestions();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSuggestion = async (suggestionId) => {
    Alert.alert(
      'Delete Suggestion',
      'Are you sure you want to delete this suggestion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('activity_suggestions')
                .delete()
                .eq('id', suggestionId);
              fetchSuggestions();
              Alert.alert('Success', 'Suggestion deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete suggestion');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (suggestion) => {
    setEditingSuggestion(suggestion);
    setActivityForm({
      title: suggestion.activity_name,
      description: suggestion.description || '',
      location: suggestion.location || '',
      day: suggestion.day_number || 1,
      time: new Date(),
      duration: '1',
      startTime: suggestion.start_time ? new Date(`2000-01-01T${suggestion.start_time}`) : new Date(),
      durationHours: suggestion.duration_hours?.toString() || '1',
      category: 'sightseeing'
    });
    setShowEditModal(true);
  };

  const generateAIItinerary = async () => {
    setLoading(true);
    try {
      console.log('Starting AI itinerary generation...');
      console.log('Trip details:', {
        destination: tripDetails.destination,
        startDate: tripDetails.start_date,
        endDate: tripDetails.end_date,
        budget: tripDetails.budget,
        tripType: tripDetails.trip_type
      });

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

      console.log('AI itinerary generated:', itinerary);

      // Create AI-generated suggestions instead of direct activities
      const suggestionsToInsert = [];
      
      if (itinerary && itinerary.dailyItinerary && Array.isArray(itinerary.dailyItinerary)) {
        for (const day of itinerary.dailyItinerary) {
          const activities = [
            { ...day.morning, time: '09:00' },
            { ...day.afternoon, time: '14:00' },
            { ...day.evening, time: '19:00' }
          ];

          for (const activity of activities) {
            if (activity.activity && activity.activity.trim()) {
              const suggestionData = {
                trip_id: tripId,
                suggested_by: currentUser.id,
                activity_name: activity.activity,
                description: activity.description || '',
                location: activity.location || '',
                day_number: day.day,
                time: activity.time,
                start_time: activity.time,
                duration_hours: parseFloat(activity.duration) || 1,
                status: 'pending',
                votes_up: 0,
                votes_down: 0
              };

              // Only add is_ai_generated if the column exists
              // This will be handled by the database migration
              try {
                suggestionData.is_ai_generated = true;
              } catch (error) {
                console.warn('is_ai_generated column not available, suggestion will be marked as manual');
              }

              suggestionsToInsert.push(suggestionData);
            }
          }
        }
      } else {
        console.error('Invalid itinerary structure:', itinerary);
        throw new Error('Invalid itinerary data received from AI service');
      }

       // Insert all suggestions at once
       if (suggestionsToInsert.length > 0) {
         console.log('Inserting suggestions:', suggestionsToInsert.length);

         const { error } = await supabase
           .from('activity_suggestions')
           .insert(suggestionsToInsert);

         if (error) {
           console.error('Database error:', error);
           throw error;
         }
       } else {
         console.warn('No valid activities found in AI response');
       }

      Alert.alert('Success', `AI generated ${suggestionsToInsert.length} activity suggestions! Check the Suggestions tab to review and approve them.`);
      fetchSuggestions();
      setShowAIModal(false);
    } catch (error) {
      console.error('AI Generation Error:', error);
      Alert.alert('Error', `Failed to generate itinerary: ${error.message || 'Unknown error'}`);
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
      startTime: new Date(),
      durationHours: '1',
      category: 'sightseeing'
    });
    setShowTimePicker(false);
    setEditingSuggestion(null);
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
    const canEdit = currentUser?.id === suggestion.suggested_by || userRole === 'owner' || userRole === 'admin';
    
    // Debug logging to verify authorization
    console.log('Suggestion debug:', {
      suggestionId: suggestion.id,
      currentUserId: currentUser?.id,
      suggestedBy: suggestion.suggested_by,
      userRole: userRole,
      canEdit: canEdit
    });

    return (
      <Card key={suggestion.id} containerStyle={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>{suggestion.activity_name}</Text>
          <View style={styles.suggestionHeaderRight}>
            <Badge
              value="Pending"
              status="warning"
              containerStyle={styles.badge}
            />
            {canEdit && (
              <View style={styles.suggestionActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(suggestion)}
                >
                  <Icon name="edit" type="material" size={16} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteSuggestion(suggestion.id)}
                >
                  <Icon name="delete" type="material" size={16} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {suggestion.description && (
          <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
        )}

        <View style={styles.suggestionDetails}>
          <View style={styles.suggestionDetailRow}>
            <Icon name="calendar-today" type="material" size={16} color="#666" />
            <Text style={styles.suggestionDetailText}>
              Day {suggestion.day_number || '1'}
            </Text>
          </View>
          <View style={styles.suggestionDetailRow}>
            <Icon name="access-time" type="material" size={16} color="#666" />
            <Text style={styles.suggestionDetailText}>
              {suggestion.start_time || suggestion.time || '12:00'}
            </Text>
          </View>
          <View style={styles.suggestionDetailRow}>
            <Icon name="schedule" type="material" size={16} color="#666" />
            <Text style={styles.suggestionDetailText}>
              {suggestion.duration_hours || '1'}h duration
            </Text>
          </View>
        </View>

        <Text style={styles.suggestedBy}>
          Suggested by {suggestion.is_ai_generated === true ? 'AI' : (suggestion.suggested_by_profile?.full_name || 'Unknown')}
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
          onPress={() => setShowSuggestModal(true)}
        />
        <Button
          title="AI Generate"
          icon={<Icon name="auto-awesome" type="material" color="#fff" size={20} />}
          buttonStyle={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => setShowAIModal(true)}
        />
      </View>

      {/* Main Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Icon 
            name="lightbulb-outline" 
            type="material" 
            color={activeTab === 'suggestions' ? '#fff' : '#666'} 
            size={20} 
          />
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
          Suggestions
          </Text>
          {suggestions.filter(s => s.day_number === selectedDay).length > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{suggestions.filter(s => s.day_number === selectedDay).length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activities' && styles.activeTab]}
          onPress={() => setActiveTab('activities')}
        >
          <Icon 
            name="event" 
            type="material" 
            color={activeTab === 'activities' ? '#fff' : '#666'} 
            size={20} 
          />
          <Text style={[styles.tabText, activeTab === 'activities' && styles.activeTabText]}>
            Activities
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'suggestions' && (
        <View style={styles.tabContent}>
          {/* Day Tabs for Suggestions */}
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

          {/* Suggestions List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Day {selectedDay} Suggestions</Text>
            {suggestions
              .filter(s => s.day_number === selectedDay)
              .length > 0 ? (
              suggestions
                .filter(s => s.day_number === selectedDay)
                .map(renderSuggestion)
            ) : (
              <Card containerStyle={styles.emptyCard}>
                <Icon name="lightbulb-outline" type="material" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No suggestions for Day {selectedDay}</Text>
                <Text style={styles.emptySubtext}>Suggest an activity for this day!</Text>
              </Card>
            )}
          </View>
        </View>
      )}

      {activeTab === 'activities' && (
        <View style={styles.tabContent}>
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
                <Icon name="event" type="material" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No activities planned for this day</Text>
                <Text style={styles.emptySubtext}>Add an activity or generate with AI!</Text>
              </Card>
            )}
          </View>
        </View>
      )}

      {/* Suggest Activity Modal */}
      <Modal
        visible={showSuggestModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Suggest Activity
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
              <Text style={styles.formLabel}>Start Time:</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Icon name="access-time" type="material" color="#666" size={20} />
                <Text style={styles.timeButtonText}>
                  {activityForm.startTime.toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Duration (hours):</Text>
              <View style={styles.durationContainer}>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    const currentDuration = parseFloat(activityForm.durationHours);
                    if (currentDuration > 0.5) {
                      setActivityForm({ ...activityForm, durationHours: (currentDuration - 0.5).toString() });
                    }
                  }}
                >
                  <Icon name="remove" type="material" color="#666" size={20} />
                </TouchableOpacity>
                <Text style={styles.durationText}>{activityForm.durationHours}h</Text>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    const currentDuration = parseFloat(activityForm.durationHours);
                    setActivityForm({ ...activityForm, durationHours: (currentDuration + 0.5).toString() });
                  }}
                >
                  <Icon name="add" type="material" color="#666" size={20} />
                </TouchableOpacity>
              </View>
            </View>

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
                  setShowSuggestModal(false);
                  resetForm();
                }}
              />
              <Button
                title="Suggest"
                loading={loading}
                buttonStyle={[styles.modalButton, { backgroundColor: '#00BFA5' }]}
                onPress={suggestActivity}
              />
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={activityForm.startTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) {
                    setActivityForm({ ...activityForm, startTime: selectedTime });
                  }
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Suggestion Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit Suggestion
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
              <Text style={styles.formLabel}>Start Time:</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Icon name="access-time" type="material" color="#666" size={20} />
                <Text style={styles.timeButtonText}>
                  {activityForm.startTime.toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Duration (hours):</Text>
              <View style={styles.durationContainer}>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    const currentDuration = parseFloat(activityForm.durationHours);
                    if (currentDuration > 0.5) {
                      setActivityForm({ ...activityForm, durationHours: (currentDuration - 0.5).toString() });
                    }
                  }}
                >
                  <Icon name="remove" type="material" color="#666" size={20} />
                </TouchableOpacity>
                <Text style={styles.durationText}>{activityForm.durationHours}h</Text>
                <TouchableOpacity
                  style={styles.durationButton}
                  onPress={() => {
                    const currentDuration = parseFloat(activityForm.durationHours);
                    setActivityForm({ ...activityForm, durationHours: (currentDuration + 0.5).toString() });
                  }}
                >
                  <Icon name="add" type="material" color="#666" size={20} />
                </TouchableOpacity>
              </View>
            </View>

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
                  setShowEditModal(false);
                  setEditingSuggestion(null);
                  resetForm();
                }}
              />
              <Button
                title="Update"
                loading={loading}
                buttonStyle={[styles.modalButton, { backgroundColor: '#00BFA5' }]}
                onPress={editSuggestion}
              />
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={activityForm.startTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) {
                    setActivityForm({ ...activityForm, startTime: selectedTime });
                  }
                }}
              />
            )}
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
              AI will create activity suggestions based on your trip details and preferences. Review and approve them in the Suggestions tab.
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#00BFA5',
    shadowColor: '#00BFA5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    marginHorizontal: 15,
    marginBottom: 12,
    color: '#2c3e50',
  },
  dayTabs: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  dayTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeDayTab: {
    backgroundColor: '#00BFA5',
    borderColor: '#00BFA5',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  dayTabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  activeDayTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  activityCard: {
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  activityInfo: {
    flex: 1,
    marginLeft: 14,
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  activityTime: {
    fontSize: 13,
    color: '#5a6c7d',
    fontWeight: '500',
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityDescription: {
    fontSize: 14,
    color: '#5a6c7d',
    marginTop: 12,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationText: {
    fontSize: 13,
    color: '#5a6c7d',
    marginLeft: 6,
    fontWeight: '500',
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
  suggestionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionActions: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 8,
  },
  editButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#ffe6e6',
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
  suggestionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 15,
  },
  suggestionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
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
    borderRadius: 16,
    marginHorizontal: 15,
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 15,
    color: '#5a6c7d',
    fontWeight: '500',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 5,
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
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  durationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  durationText: {
    marginHorizontal: 15,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});