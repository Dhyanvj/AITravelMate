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
  TextInput,
  Modal,
  FlatList,
  Image
} from 'react-native';
import { Card, Button, Icon, SearchBar, Chip, Rating, Badge } from 'react-native-elements';
import * as Location from 'expo-location';
import { supabase } from '../../src/services/supabase/supabaseClient';
import AIService from '../../src/services/ai/aiService';
import { LinearGradient } from 'expo-linear-gradient';

export default function DiscoverScreen() {
  const [location, setLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [places, setPlaces] = useState([]);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Categories for filtering
  const categories = [
    { id: 'all', label: 'All', icon: 'apps' },
    { id: 'restaurants', label: 'Food', icon: 'restaurant' },
    { id: 'attractions', label: 'Attractions', icon: 'castle' },
    { id: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
    { id: 'nightlife', label: 'Nightlife', icon: 'wine-bar' },
    { id: 'nature', label: 'Nature', icon: 'park' },
    { id: 'culture', label: 'Culture', icon: 'museum' },
    { id: 'hotels', label: 'Hotels', icon: 'hotel' }
  ];

  // Filter options
  const [filters, setFilters] = useState({
    priceRange: 'all',
    rating: 0,
    distance: 'all',
    openNow: false
  });

  useEffect(() => {
    requestLocationPermission();
    fetchUserPreferences();
    fetchSavedPlaces();
  }, []);

  useEffect(() => {
    if (location) {
      discoverPlaces();
    }
  }, [selectedCategory, location]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Please enable location to get personalized recommendations near you.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      // Get location name
      const [address] = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      if (address) {
        setLocation(prev => ({
          ...prev,
          city: address.city,
          country: address.country
        }));
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('travel_preferences')
        .eq('id', user.id)
        .single();

      if (data?.travel_preferences) {
        setUserPreferences(data.travel_preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchSavedPlaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', user.id);

      setSavedPlaces(data || []);
    } catch (error) {
      console.error('Error fetching saved places:', error);
    }
  };

  const discoverPlaces = async (customLocation = null) => {
    setLoading(true);
    try {
      const targetLocation = customLocation || location;
      if (!targetLocation) {
        // Use mock data if no location
        setPlaces(getMockPlaces());
        return;
      }

      // Generate AI recommendations based on location and preferences
      const recommendations = await AIService.getPlaceRecommendations(
        `${targetLocation.city || 'Current location'}, ${targetLocation.country || ''}`,
        {
          type: selectedCategory === 'all' ? null : selectedCategory,
          interests: userPreferences?.interests || [],
          budget: filters.priceRange
        }
      );

      // If AI fails, use mock data
      if (!recommendations || recommendations.length === 0) {
        setPlaces(getMockPlaces());
      } else {
        // Add additional metadata to recommendations
        const enhancedPlaces = recommendations.map((place, index) => ({
          ...place,
          id: `place_${index}`,
          distance: calculateDistance(targetLocation, place.coordinates),
          isSaved: savedPlaces.some(sp => sp.place_name === place.name),
          image: getPlaceImage(place.type)
        }));
        setPlaces(enhancedPlaces);
      }
    } catch (error) {
      console.error('Error discovering places:', error);
      setPlaces(getMockPlaces());
    } finally {
      setLoading(false);
    }
  };

  const getMockPlaces = () => {
    // Mock data for testing
    const mockPlaces = [
      {
        id: '1',
        name: 'Le Bernardin',
        type: 'restaurant',
        category: 'restaurants',
        description: 'Exquisite French seafood restaurant with impeccable service',
        rating: 4.8,
        priceLevel: 4,
        distance: 0.5,
        address: '155 West 51st Street',
        hours: 'Open until 10:30 PM',
        image: '🍽️',
        tags: ['French', 'Seafood', 'Fine Dining'],
        estimatedCost: '$150-300 per person'
      },
      {
        id: '2',
        name: 'Central Park',
        type: 'attraction',
        category: 'nature',
        description: 'Iconic urban park perfect for walking, picnics, and outdoor activities',
        rating: 4.9,
        priceLevel: 0,
        distance: 1.2,
        address: 'Manhattan, NY',
        hours: 'Open 24 hours',
        image: '🌳',
        tags: ['Park', 'Nature', 'Free'],
        estimatedCost: 'Free'
      },
      {
        id: '3',
        name: 'Museum of Modern Art',
        type: 'museum',
        category: 'culture',
        description: 'World-renowned museum featuring contemporary and modern art',
        rating: 4.6,
        priceLevel: 2,
        distance: 0.8,
        address: '11 West 53rd Street',
        hours: 'Open until 5:30 PM',
        image: '🎨',
        tags: ['Art', 'Museum', 'Culture'],
        estimatedCost: '$25 adults'
      },
      {
        id: '4',
        name: 'The High Line',
        type: 'attraction',
        category: 'attractions',
        description: 'Elevated linear park built on a historic freight rail line',
        rating: 4.7,
        priceLevel: 0,
        distance: 2.1,
        address: 'New York, NY 10011',
        hours: 'Open until 10:00 PM',
        image: '🚶',
        tags: ['Park', 'Walking', 'Views'],
        estimatedCost: 'Free'
      },
      {
        id: '5',
        name: 'Brooklyn Bridge',
        type: 'attraction',
        category: 'attractions',
        description: 'Historic bridge offering stunning views of Manhattan skyline',
        rating: 4.8,
        priceLevel: 0,
        distance: 3.5,
        address: 'Brooklyn Bridge, New York',
        hours: 'Open 24 hours',
        image: '🌉',
        tags: ['Landmark', 'Views', 'Walking'],
        estimatedCost: 'Free'
      }
    ];

    return selectedCategory === 'all'
      ? mockPlaces
      : mockPlaces.filter(p => p.category === selectedCategory);
  };

  const calculateDistance = (location1, location2) => {
    // Simple distance calculation (would use proper formula in production)
    if (!location2?.coordinates) return Math.random() * 5;
    return Math.random() * 5; // Mock distance in km
  };

  const getPlaceImage = (type) => {
    const images = {
      restaurant: '🍽️',
      attraction: '🏛️',
      shopping: '🛍️',
      nightlife: '🎉',
      nature: '🌳',
      culture: '🎨',
      hotel: '🏨',
      museum: '🖼️',
      park: '🌲'
    };
    return images[type] || '📍';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setGeneratingAI(true);
    try {
      const searchResults = await AIService.getPlaceRecommendations(
        searchQuery,
        {
          interests: userPreferences?.interests || [],
          type: selectedCategory === 'all' ? null : selectedCategory
        }
      );

      if (searchResults && searchResults.length > 0) {
        setPlaces(searchResults.map((place, index) => ({
          ...place,
          id: `search_${index}`,
          image: getPlaceImage(place.type),
          isSaved: savedPlaces.some(sp => sp.place_name === place.name)
        })));
      } else {
        Alert.alert('No Results', 'No places found for your search');
      }
    } catch (error) {
      Alert.alert('Search Error', 'Failed to search places');
    } finally {
      setGeneratingAI(false);
    }
  };

  const savePlace = async (place) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Please login', 'You need to be logged in to save places');
        return;
      }

      if (place.isSaved) {
        // Remove from saved
        const { error } = await supabase
          .from('saved_places')
          .delete()
          .eq('user_id', user.id)
          .eq('place_name', place.name);

        if (!error) {
          setSavedPlaces(prev => prev.filter(p => p.place_name !== place.name));
          setPlaces(prev => prev.map(p =>
            p.id === place.id ? { ...p, isSaved: false } : p
          ));
        }
      } else {
        // Add to saved
        const { data, error } = await supabase
          .from('saved_places')
          .insert([{
            user_id: user.id,
            place_name: place.name,
            place_type: place.type,
            location: {
              address: place.address,
              coordinates: place.coordinates
            },
            rating: place.rating,
            notes: place.description
          }])
          .select()
          .single();

        if (!error) {
          setSavedPlaces(prev => [...prev, data]);
          setPlaces(prev => prev.map(p =>
            p.id === place.id ? { ...p, isSaved: true } : p
          ));
        }
      }
    } catch (error) {
      console.error('Error saving place:', error);
      Alert.alert('Error', 'Failed to save place');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      requestLocationPermission(),
      fetchUserPreferences(),
      fetchSavedPlaces(),
      discoverPlaces()
    ]);
    setRefreshing(false);
  };

  const renderPlaceCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedPlace(item);
        setShowPlaceModal(true);
      }}
    >
      <Card containerStyle={styles.placeCard}>
        <View style={styles.placeHeader}>
          <View style={styles.placeImageContainer}>
            <Text style={styles.placeImage}>{item.image}</Text>
          </View>
          <View style={styles.placeInfo}>
            <Text style={styles.placeName}>{item.name}</Text>
            <View style={styles.placeMetaRow}>
              <Icon name="place" type="material" size={14} color="#666" />
              <Text style={styles.placeDistance}>
                {item.distance ? `${item.distance.toFixed(1)} km away` : item.address}
              </Text>
            </View>
            {item.rating && (
              <View style={styles.ratingRow}>
                <Rating
                  imageSize={16}
                  readonly
                  startingValue={item.rating}
                  style={styles.rating}
                />
                <Text style={styles.ratingText}>({item.rating})</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => savePlace(item)}
            style={styles.saveButton}
          >
            <Icon
              name={item.isSaved ? 'bookmark' : 'bookmark-border'}
              type="material"
              color={item.isSaved ? '#2089dc' : '#666'}
              size={24}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.placeDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.placeTags}>
          {item.tags?.slice(0, 3).map((tag, index) => (
            <Badge
              key={index}
              value={tag}
              badgeStyle={styles.tagBadge}
              textStyle={styles.tagText}
            />
          ))}
          {item.estimatedCost && (
            <Text style={styles.costText}>{item.estimatedCost}</Text>
          )}
        </View>

        {item.hours && (
          <View style={styles.hoursRow}>
            <Icon name="schedule" type="material" size={14} color="#4CAF50" />
            <Text style={styles.hoursText}>{item.hours}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Location */}
      <LinearGradient
        colors={['#2089dc', '#4da6ff']}
        style={styles.header}
      >
        <View style={styles.locationHeader}>
          <Icon name="location-on" type="material" color="#fff" size={20} />
          <Text style={styles.locationText}>
            {location?.city || 'Getting location...'}
          </Text>
          <TouchableOpacity onPress={requestLocationPermission}>
            <Icon name="refresh" type="material" color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search places or destinations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Icon name="search" type="material" color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.selectedCategoryChip
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Icon
              name={category.icon}
              type="material"
              size={20}
              color={selectedCategory === category.id ? '#fff' : '#666'}
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.selectedCategoryText
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Icon name="filter-list" type="material" color="#2089dc" size={20} />
        <Text style={styles.filterButtonText}>Filters</Text>
      </TouchableOpacity>

      {/* Filter Options */}
      {showFilters && (
        <Card containerStyle={styles.filtersCard}>
          <Text style={styles.filterTitle}>Price Range</Text>
          <View style={styles.filterOptions}>
            {['all', '$', '$$', '$$$', '$$$$'].map((price) => (
              <TouchableOpacity
                key={price}
                style={[
                  styles.filterOption,
                  filters.priceRange === price && styles.selectedFilterOption
                ]}
                onPress={() => setFilters({ ...filters, priceRange: price })}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.priceRange === price && styles.selectedFilterOptionText
                ]}>
                  {price === 'all' ? 'All' : price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterTitle}>Distance</Text>
          <View style={styles.filterOptions}>
            {['all', '< 1km', '< 5km', '< 10km'].map((distance) => (
              <TouchableOpacity
                key={distance}
                style={[
                  styles.filterOption,
                  filters.distance === distance && styles.selectedFilterOption
                ]}
                onPress={() => setFilters({ ...filters, distance })}
              >
                <Text style={[
                  styles.filterOptionText,
                  filters.distance === distance && styles.selectedFilterOptionText
                ]}>
                  {distance === 'all' ? 'All' : distance}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {/* Places List */}
      {loading || generatingAI ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2089dc" />
          <Text style={styles.loadingText}>
            {generatingAI ? 'Finding best places for you...' : 'Loading places...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
          renderItem={renderPlaceCard}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Card containerStyle={styles.emptyCard}>
              <Icon name="explore" type="material" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No places found</Text>
              <Text style={styles.emptySubtext}>
                Try searching for a different location or category
              </Text>
            </Card>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Place Details Modal */}
      <Modal
        visible={showPlaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaceModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPlaceModal(false)}
            >
              <Icon name="close" type="material" size={24} />
            </TouchableOpacity>

            {selectedPlace && (
              <ScrollView>
                <Text style={styles.modalPlaceImage}>{selectedPlace.image}</Text>
                <Text style={styles.modalTitle}>{selectedPlace.name}</Text>

                {selectedPlace.rating && (
                  <View style={styles.modalRating}>
                    <Rating
                      imageSize={20}
                      readonly
                      startingValue={selectedPlace.rating}
                    />
                    <Text style={styles.modalRatingText}>
                      {selectedPlace.rating} stars
                    </Text>
                  </View>
                )}

                <Text style={styles.modalDescription}>
                  {selectedPlace.description}
                </Text>

                <View style={styles.modalInfo}>
                  <View style={styles.modalInfoRow}>
                    <Icon name="place" type="material" size={20} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {selectedPlace.address || 'Location not available'}
                    </Text>
                  </View>

                  {selectedPlace.hours && (
                    <View style={styles.modalInfoRow}>
                      <Icon name="schedule" type="material" size={20} color="#666" />
                      <Text style={styles.modalInfoText}>{selectedPlace.hours}</Text>
                    </View>
                  )}

                  {selectedPlace.estimatedCost && (
                    <View style={styles.modalInfoRow}>
                      <Icon name="attach-money" type="material" size={20} color="#666" />
                      <Text style={styles.modalInfoText}>
                        {selectedPlace.estimatedCost}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalTags}>
                  {selectedPlace.tags?.map((tag, index) => (
                    <Badge
                      key={index}
                      value={tag}
                      badgeStyle={styles.modalTagBadge}
                      textStyle={styles.modalTagText}
                    />
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title={selectedPlace.isSaved ? 'Remove from Saved' : 'Save Place'}
                    icon={
                      <Icon
                        name={selectedPlace.isSaved ? 'bookmark' : 'bookmark-border'}
                        type="material"
                        color="#fff"
                        size={20}
                      />
                    }
                    buttonStyle={[
                      styles.modalButton,
                      selectedPlace.isSaved && styles.savedButton
                    ]}
                    onPress={() => {
                      savePlace(selectedPlace);
                      setShowPlaceModal(false);
                    }}
                  />
                  <Button
                    title="Get Directions"
                    icon={<Icon name="directions" type="material" color="#fff" size={20} />}
                    buttonStyle={styles.modalButton}
                    onPress={() => {
                      // In production, would open maps app
                      Alert.alert('Directions', 'Opening maps...');
                    }}
                  />
                </View>
              </ScrollView>
            )}
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  locationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: {
    marginLeft: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    maxHeight: 60,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  selectedCategoryChip: {
    backgroundColor: '#2089dc',
  },
  categoryText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#2089dc',
    fontWeight: 'bold',
  },
  filtersCard: {
    borderRadius: 0,
    margin: 0,
    paddingVertical: 15,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  filterOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    marginBottom: 5,
  },
  selectedFilterOption: {
    backgroundColor: '#2089dc',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedFilterOptionText: {
    color: '#fff',
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
  listContent: {
    paddingBottom: 20,
  },
  placeCard: {
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  placeHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  placeImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeImage: {
    fontSize: 30,
  },
  placeInfo: {
    flex: 1,
    marginLeft: 15,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  placeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  placeDistance: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    alignItems: 'flex-start',
  },
  ratingText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#666',
  },
  saveButton: {
    padding: 5,
  },
  placeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  placeTags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  tagBadge: {
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 5,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  costText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 'auto',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoursText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#4CAF50',
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 1,
  },
  modalPlaceImage: {
    fontSize: 60,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  modalRating: {
    alignItems: 'center',
    marginBottom: 15,
  },
  modalRatingText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  modalInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalInfoText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  modalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTagBadge: {
    backgroundColor: '#2089dc',
    borderRadius: 15,
    paddingHorizontal: 15,
    margin: 5,
  },
  modalTagText: {
    fontSize: 12,
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    backgroundColor: '#2089dc',
    borderRadius: 25,
    paddingHorizontal: 20,
    minWidth: 140,
  },
  savedButton: {
    backgroundColor: '#4CAF50',
  },
});