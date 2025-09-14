import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { Card, Button, Icon, Divider, ListItem, Badge } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';
import AIService from '../../src/services/ai/aiService';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ItineraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [expandedDays, setExpandedDays] = useState({});

  useEffect(() => {
    fetchTrips();
    if (params.tripId) {
      loadTripItinerary(params.tripId);
    }
  }, [params.tripId]);

  const fetchTrips = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const loadTripItinerary = async (tripId) => {
    setLoading(true);
    try {
      // First, fetch the trip details
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;
      setSelectedTrip(tripData);

      // Then, fetch existing itinerary
      const { data: itineraryData, error: itineraryError } = await supabase
        .from('itineraries')
        .select('*')
        .eq('trip_id', tripId)
        .order('day_number', { ascending: true });

      if (itineraryData && itineraryData.length > 0) {
        // Format existing itinerary for display
        const formattedItinerary = {
          destination: tripData.destination,
          totalDays: itineraryData.length,
          dailyItinerary: itineraryData.map(day => day.activities)
        };
        setItinerary(formattedItinerary);
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIItinerary = async () => {
    if (!selectedTrip) {
      Alert.alert('No Trip Selected', 'Please select a trip first');
      return;
    }

    setGeneratingAI(true);
    try {
      // Prepare trip details for AI
      const tripDetails = {
        destination: selectedTrip.destination,
        startDate: selectedTrip.start_date,
        endDate: selectedTrip.end_date,
        budget: selectedTrip.budget || 1000,
        tripType: selectedTrip.trip_type || 'leisure',
        interests: selectedTrip.trip_details?.interests || ['sightseeing', 'culture', 'food'],
        travelers: selectedTrip.trip_details?.travelers || 1,
        notes: selectedTrip.trip_details?.notes || ''
      };

      // Generate itinerary using AI
      const generatedItinerary = await AIService.generateItinerary(tripDetails);

      if (generatedItinerary) {
        setItinerary(generatedItinerary);

        // Save itinerary to database
        await saveItineraryToDatabase(generatedItinerary);

        Alert.alert(
          'Success!',
          'Your AI-powered itinerary has been generated!',
          [{ text: 'Great!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error generating itinerary:', error);
      Alert.alert('Error', 'Failed to generate itinerary. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const saveItineraryToDatabase = async (generatedItinerary) => {
    try {
      // Delete existing itinerary for this trip
      await supabase
        .from('itineraries')
        .delete()
        .eq('trip_id', selectedTrip.id);

      // Save new itinerary
      const itineraryRecords = generatedItinerary.dailyItinerary.map((day, index) => {
        // Properly calculate the date for each day
        const tripStartDate = new Date(selectedTrip.start_date);
        const dayDate = new Date(tripStartDate);
        dayDate.setDate(tripStartDate.getDate() + index);

        return {
          trip_id: selectedTrip.id,
          day_number: index + 1,
          date: dayDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
          activities: day
        };
      });

      const { error } = await supabase
        .from('itineraries')
        .insert(itineraryRecords);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      // Don't throw the error, just log it so the user can still see the itinerary
      Alert.alert(
        'Note',
        'Itinerary generated successfully but could not be saved. You can still view it.',
        [{ text: 'OK' }]
      );
    }
  };

  const optimizeItinerary = async () => {
    if (!feedback.trim()) {
      Alert.alert('Please provide feedback', 'Tell us what you\'d like to change');
      return;
    }

    setShowFeedbackModal(false);
    setGeneratingAI(true);

    try {
      const optimizedItinerary = await AIService.optimizeItinerary(itinerary, feedback);
      setItinerary(optimizedItinerary);
      await saveItineraryToDatabase(optimizedItinerary);
      Alert.alert('Success', 'Your itinerary has been optimized!');
      setFeedback('');
    } catch (error) {
      Alert.alert('Error', 'Failed to optimize itinerary');
    } finally {
      setGeneratingAI(false);
    }
  };

  const toggleDayExpansion = (dayNumber) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayNumber]: !prev[dayNumber]
    }));
  };

  const renderDayItinerary = (day) => {
    const isExpanded = expandedDays[day.day];

    return (
      <Card key={day.day} containerStyle={styles.dayCard}>
        <TouchableOpacity onPress={() => toggleDayExpansion(day.day)}>
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayTitle}>Day {day.day}</Text>
              <Text style={styles.dayDate}>{day.date}</Text>
              {day.theme && <Text style={styles.dayTheme}>{day.theme}</Text>}
            </View>
            <Icon
              name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              type="material"
              color="#666"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.dayContent}>
            <Divider style={styles.divider} />

            {/* Morning */}
            <View style={styles.timeSlot}>
              <View style={styles.timeHeader}>
                <Icon name="wb-sunny" type="material" size={20} color="#FFA726" />
                <Text style={styles.timeTitle}>Morning</Text>
              </View>
              <Text style={styles.activityName}>{day.morning?.activity}</Text>
              <Text style={styles.activityDescription}>{day.morning?.description}</Text>
              <View style={styles.activityMeta}>
                <Badge value={day.morning?.duration} status="primary" />
                <Text style={styles.cost}>{day.morning?.cost}</Text>
              </View>
            </View>

            {/* Afternoon */}
            <View style={styles.timeSlot}>
              <View style={styles.timeHeader}>
                <Icon name="wb-cloudy" type="material" size={20} color="#42A5F5" />
                <Text style={styles.timeTitle}>Afternoon</Text>
              </View>
              <Text style={styles.activityName}>{day.afternoon?.activity}</Text>
              <Text style={styles.activityDescription}>{day.afternoon?.description}</Text>
              <View style={styles.activityMeta}>
                <Badge value={day.afternoon?.duration} status="primary" />
                <Text style={styles.cost}>{day.afternoon?.cost}</Text>
              </View>
            </View>

            {/* Evening */}
            <View style={styles.timeSlot}>
              <View style={styles.timeHeader}>
                <Icon name="nightlight-round" type="material" size={20} color="#7E57C2" />
                <Text style={styles.timeTitle}>Evening</Text>
              </View>
              <Text style={styles.activityName}>{day.evening?.activity}</Text>
              <Text style={styles.activityDescription}>{day.evening?.description}</Text>
              <View style={styles.activityMeta}>
                <Badge value={day.evening?.duration} status="primary" />
                <Text style={styles.cost}>{day.evening?.cost}</Text>
              </View>
            </View>

            {/* Meals */}
            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>🍽️ Recommended Meals</Text>
              <Text style={styles.mealText}>🥐 Breakfast: {day.meals?.breakfast}</Text>
              <Text style={styles.mealText}>🍜 Lunch: {day.meals?.lunch}</Text>
              <Text style={styles.mealText}>🍷 Dinner: {day.meals?.dinner}</Text>
            </View>

            {/* Transportation */}
            <View style={styles.transportSection}>
              <Text style={styles.sectionTitle}>🚌 Transportation</Text>
              <Text style={styles.transportText}>{day.transportation}</Text>
            </View>

            {/* Budget Breakdown */}
            {day.budgetBreakdown && (
              <View style={styles.budgetSection}>
                <Text style={styles.sectionTitle}>💰 Daily Budget</Text>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Activities:</Text>
                  <Text style={styles.budgetValue}>{day.budgetBreakdown.activities}</Text>
                </View>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Meals:</Text>
                  <Text style={styles.budgetValue}>{day.budgetBreakdown.meals}</Text>
                </View>
                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Transport:</Text>
                  <Text style={styles.budgetValue}>{day.budgetBreakdown.transportation}</Text>
                </View>
                <Divider />
                <View style={[styles.budgetRow, styles.budgetTotal]}>
                  <Text style={styles.budgetTotalLabel}>Total:</Text>
                  <Text style={styles.budgetTotalValue}>{day.budgetBreakdown.total}</Text>
                </View>
              </View>
            )}

            {/* Tips */}
            {day.tips && (
              <View style={styles.tipsSection}>
                <Text style={styles.sectionTitle}>💡 Tips</Text>
                <Text style={styles.tipText}>{day.tips}</Text>
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  const renderTripSelector = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tripSelector}>
      {trips.map((trip) => (
        <TouchableOpacity
          key={trip.id}
          style={[
            styles.tripChip,
            selectedTrip?.id === trip.id && styles.selectedTripChip
          ]}
          onPress={() => {
            setSelectedTrip(trip);
            loadTripItinerary(trip.id);
          }}
        >
          <Text style={[
            styles.tripChipText,
            selectedTrip?.id === trip.id && styles.selectedTripChipText
          ]}>
            {trip.title}
          </Text>
          <Text style={[
            styles.tripChipDate,
            selectedTrip?.id === trip.id && styles.selectedTripChipDate
          ]}>
            {new Date(trip.start_date).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2089dc" />
        <Text style={styles.loadingText}>Loading your itinerary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Trip Selector */}
      {trips.length > 0 && renderTripSelector()}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTrips} />
        }
      >
        {selectedTrip ? (
          <>
            {/* Trip Header */}
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.header}
            >
              <Text style={styles.destination}>{selectedTrip.destination}</Text>
              <Text style={styles.tripDates}>
                {new Date(selectedTrip.start_date).toLocaleDateString()} - {new Date(selectedTrip.end_date).toLocaleDateString()}
              </Text>
              {itinerary && (
                <Text style={styles.totalDays}>{itinerary.totalDays} Days Adventure</Text>
              )}
            </LinearGradient>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                title={itinerary ? "Regenerate" : "Generate AI Itinerary"}
                icon={<Icon name="auto-awesome" type="material" color="#fff" size={20} />}
                buttonStyle={[styles.actionButton, styles.generateButton]}
                onPress={generateAIItinerary}
                loading={generatingAI}
              />
              {itinerary && (
                <Button
                  title="Optimize"
                  icon={<Icon name="tune" type="material" color="#fff" size={20} />}
                  buttonStyle={[styles.actionButton, styles.optimizeButton]}
                  onPress={() => setShowFeedbackModal(true)}
                />
              )}
            </View>

            {/* Itinerary Content */}
            {itinerary ? (
              <>
                {/* Overall Tips */}
                {itinerary.overallTips && (
                  <Card containerStyle={styles.tipsCard}>
                    <Text style={styles.overallTipsTitle}>📌 Travel Tips</Text>
                    {itinerary.overallTips.map((tip, index) => (
                      <Text key={index} style={styles.overallTip}>• {tip}</Text>
                    ))}
                  </Card>
                )}

                {/* Daily Itineraries */}
                {itinerary.dailyItinerary?.map(day => renderDayItinerary(day))}

                {/* Total Cost */}
                {itinerary.estimatedTotalCost && (
                  <Card containerStyle={styles.totalCostCard}>
                    <Text style={styles.totalCostLabel}>Estimated Total Cost</Text>
                    <Text style={styles.totalCostValue}>{itinerary.estimatedTotalCost}</Text>
                  </Card>
                )}
              </>
            ) : (
              <Card containerStyle={styles.emptyCard}>
                <Icon name="event-note" type="material" size={64} color="#ccc" />
                <Text style={styles.emptyText}>No itinerary yet</Text>
                <Text style={styles.emptySubtext}>
                  Generate an AI-powered itinerary for your trip
                </Text>
              </Card>
            )}
          </>
        ) : (
          <Card containerStyle={styles.emptyCard}>
            <Icon name="luggage" type="material" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No trips found</Text>
            <Button
              title="Plan Your First Trip"
              buttonStyle={styles.planTripButton}
              onPress={() => router.push('/(tabs)/planning')}
            />
          </Card>
        )}
      </ScrollView>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How can we improve your itinerary?</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="E.g., Add more budget-friendly options, include more cultural sites, etc."
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                buttonStyle={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowFeedbackModal(false)}
              />
              <Button
                title="Optimize"
                buttonStyle={[styles.modalButton, styles.confirmButton]}
                onPress={optimizeItinerary}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  tripSelector: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    maxHeight: 80,
  },
  tripChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedTripChip: {
    backgroundColor: '#2089dc',
  },
  tripChipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedTripChipText: {
    color: '#fff',
  },
  tripChipDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedTripChipDate: {
    color: '#e0e0e0',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  destination: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  tripDates: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  totalDays: {
    fontSize: 14,
    color: '#fff',
    marginTop: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
  },
  actionButton: {
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 12,
    minWidth: 150,
  },
  generateButton: {
    backgroundColor: '#4CAF50',
  },
  optimizeButton: {
    backgroundColor: '#FF9800',
  },
  dayCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dayDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  dayTheme: {
    fontSize: 12,
    color: '#2089dc',
    fontStyle: 'italic',
    marginTop: 2,
  },
  dayContent: {
    marginTop: 15,
  },
  divider: {
    marginBottom: 15,
  },
  timeSlot: {
    marginBottom: 20,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  activityName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cost: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  mealsSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  mealText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    paddingLeft: 10,
  },
  transportSection: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  transportText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  budgetSection: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#666',
  },
  budgetValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  budgetTotal: {
    marginTop: 8,
    paddingTop: 8,
  },
  budgetTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  budgetTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tipsSection: {
    backgroundColor: '#fffbf0',
    padding: 15,
    borderRadius: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  tipsCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#f0f8ff',
  },
  overallTipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  overallTip: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
  totalCostCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#4CAF50',
  },
  totalCostLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  totalCostValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  planTripButton: {
    marginTop: 20,
    backgroundColor: '#2089dc',
    borderRadius: 25,
    paddingHorizontal: 30,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    borderRadius: 25,
    paddingHorizontal: 30,
    minWidth: 120,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
});