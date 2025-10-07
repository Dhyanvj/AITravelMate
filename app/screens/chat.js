import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Avatar, Icon } from 'react-native-elements';
import AIService from '../../src/services/ai/aiService';
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

const { height: screenHeight } = Dimensions.get('window');

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [userTrips, setUserTrips] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [refreshingTrips, setRefreshingTrips] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const sendButtonAnim = useRef(new Animated.Value(0)).current;

  // Quick action suggestions
  const quickActions = [
    { id: 1, text: "Plan a weekend trip", icon: "flight-takeoff" },
    { id: 2, text: "Find restaurants nearby", icon: "restaurant" },
    { id: 3, text: "Translate a phrase", icon: "translate" },
    { id: 4, text: "Get packing tips", icon: "luggage" },
    { id: 5, text: "Currency conversion", icon: "attach-money" },
    { id: 6, text: "Weather forecast", icon: "wb-sunny" },
    { id: 7, text: "Travel safety tips", icon: "security" },
    { id: 8, text: "Visa requirements", icon: "card-travel" }
  ];

  // Sample conversation starters based on context
  const contextualPrompts = {
    general: [
      "What are the best travel destinations for this season?",
      "How do I get a good deal on flights?",
      "What should I pack for a tropical vacation?"
    ],
    trip: [
      "What's the weather like at my destination?",
      "Suggest activities for Day 2 of my trip",
      "Find vegetarian restaurants near my hotel"
    ],
    location: [
      "What are the must-see attractions here?",
      "How do I get to the airport from downtown?",
      "What's the local tipping culture?"
    ]
  };

  useEffect(() => {
    initializeChat();
    loadChatHistory();
    fetchUserData();
    
    // Start entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Add keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setIsKeyboardVisible(true);
      // Scroll to bottom when keyboard appears
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = () => {
    // Add welcome message
    const welcomeMessage = {
      id: 'welcome',
      text: "Hi! I'm your AI Travel Assistant. I can help you plan trips, find places to visit, translate phrases, get weather updates, and answer any travel-related questions. How can I assist you today?",
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages([welcomeMessage]);
  };

  const loadChatHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('chatHistory');
      if (history) {
        const parsedHistory = JSON.parse(history);
        // Load only last 20 messages
        setMessages(parsedHistory.slice(-20));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (newMessages) => {
    try {
      await AsyncStorage.setItem('chatHistory', JSON.stringify(newMessages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserProfile(profile);

      // Load avatar information
      const avatarId = user.user_metadata?.avatar_id || profile?.avatar_id;
      if (avatarId) {
        const avatar = AVATAR_OPTIONS.find(option => option.id === avatarId);
        setSelectedAvatar(avatar || AVATAR_OPTIONS[0]);
      } else {
        setSelectedAvatar(AVATAR_OPTIONS[0]); // Default avatar
      }

      // Fetch user trips for context using trip_members table
      const { data: tripMembers, error: tripError } = await supabase
        .from('trip_members')
        .select(`
          *,
          trip:trip_id (
            id,
            title,
            destination,
            start_date,
            end_date,
            trip_type,
            status,
            description
          )
        `)
        .eq('user_id', user.id);

      if (tripError) {
        console.error('Error fetching trips:', tripError);
      }

      // Extract trips from trip members and filter for active trips
      const trips = tripMembers?.map(member => member.trip)
        .filter(trip => trip && trip.status !== 'completed' && trip.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date)) || [];
      console.log('Fetched trips for chat:', trips);
      setUserTrips(trips);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const sendMessage = async (text = inputText) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsTyping(true);
    setShowQuickActions(false);
    setTypingIndicator(true);
    Keyboard.dismiss();

    try {
      // Get AI response with context
      const response = await getAIResponse(text, updatedMessages);

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        type: response.type || 'text',
        data: response.data || null,
        suggestions: response.suggestions || null
      };

      const newMessages = [...updatedMessages, assistantMessage];
      setMessages(newMessages);
      saveChatHistory(newMessages);
    } catch (error) {
      console.error('Error getting AI response:', error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting right now. Please try again later.",
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsTyping(false);
      setTypingIndicator(false);
    }
  };

  const getAIResponse = async (userInput, conversationHistory) => {
    // Build context from user data
    const context = {
      user: userProfile ? {
        name: userProfile.full_name,
        preferences: userProfile.travel_preferences
      } : null,
      currentTrips: userTrips.map(trip => ({
        destination: trip.destination,
        dates: `${trip.start_date} to ${trip.end_date}`,
        type: trip.trip_type
      })),
      selectedTrip: selectedContext ? {
        id: selectedContext.id,
        title: selectedContext.title,
        destination: selectedContext.destination,
        startDate: selectedContext.start_date,
        endDate: selectedContext.end_date,
        tripType: selectedContext.trip_type,
        description: selectedContext.description,
        status: selectedContext.status
      } : null
    };

    // Detect intent from user input
    const intent = detectIntent(userInput);

    // Generate appropriate response based on intent
    switch (intent.type) {
      case 'translation':
        return await handleTranslation(intent.data);
      case 'weather':
        return await handleWeatherQuery(intent.data);
      case 'currency':
        return await handleCurrencyConversion(intent.data);
      case 'trip_planning':
        return await handleTripPlanning(intent.data, context);
      case 'general':
      default:
        return await handleGeneralQuery(userInput, conversationHistory, context);
    }
  };

  const detectIntent = (input) => {
    const lowerInput = input.toLowerCase();

    // Translation detection
    if (lowerInput.includes('translate') || lowerInput.includes('how do you say') || lowerInput.includes('in spanish') || lowerInput.includes('in french')) {
      return { type: 'translation', data: input };
    }

    // Weather detection
    if (lowerInput.includes('weather') || lowerInput.includes('temperature') || lowerInput.includes('rain') || lowerInput.includes('forecast')) {
      return { type: 'weather', data: input };
    }

    // Currency detection
    if (lowerInput.includes('convert') || lowerInput.includes('currency') || lowerInput.includes('exchange rate') || lowerInput.includes('dollars to')) {
      return { type: 'currency', data: input };
    }


    // Trip planning detection
    if (lowerInput.includes('plan') || lowerInput.includes('itinerary') || lowerInput.includes('trip') || lowerInput.includes('travel to')) {
      return { type: 'trip_planning', data: input };
    }

    return { type: 'general', data: input };
  };

  const handleTranslation = async (query) => {
    // Mock translation response (would use real translation API)
    const translations = {
      'hello': { spanish: 'Hola', french: 'Bonjour', italian: 'Ciao', german: 'Hallo', japanese: 'こんにちは' },
      'thank you': { spanish: 'Gracias', french: 'Merci', italian: 'Grazie', german: 'Danke', japanese: 'ありがとう' },
      'goodbye': { spanish: 'Adiós', french: 'Au revoir', italian: 'Arrivederci', german: 'Auf Wiedersehen', japanese: 'さようなら' },
      'please': { spanish: 'Por favor', french: 'S\'il vous plaît', italian: 'Per favore', german: 'Bitte', japanese: 'お願いします' },
      'where is': { spanish: '¿Dónde está?', french: 'Où est?', italian: 'Dove è?', german: 'Wo ist?', japanese: 'どこですか' }
    };

    return {
      text: `Here are some translations:\n\n🇪🇸 Spanish: Hola\n🇫🇷 French: Bonjour\n🇮🇹 Italian: Ciao\n🇩🇪 German: Hallo\n🇯🇵 Japanese: こんにちは\n\nNeed help with pronunciation or more phrases?`,
      type: 'translation',
      suggestions: ['How do I ask for directions?', 'Common restaurant phrases', 'Emergency phrases']
    };
  };

  const handleWeatherQuery = async (query) => {
    // Mock weather response (would use real weather API)
    return {
      text: `Current weather in your destination:\n\n🌤️ Partly Cloudy\n🌡️ 24°C (75°F)\n💨 Wind: 10 km/h\n💧 Humidity: 65%\n\nForecast for next 3 days:\n• Tomorrow: ☀️ Sunny, 26°C\n• Day 2: 🌥️ Cloudy, 22°C\n• Day 3: 🌧️ Light rain, 20°C\n\nPerfect weather for sightseeing! Remember to bring sunscreen.`,
      type: 'weather',
      suggestions: ['What should I pack?', 'Indoor activities if it rains', 'Best time to visit']
    };
  };

  const handleCurrencyConversion = async (query) => {
    // Mock currency conversion (would use real API)
    return {
      text: `Currency Conversion:\n\n💵 100 USD = \n• 💶 92 EUR (Euro)\n• 💷 79 GBP (British Pound)\n• 💴 14,950 JPY (Japanese Yen)\n• 🇨🇦 135 CAD (Canadian Dollar)\n• 🇦🇺 153 AUD (Australian Dollar)\n\nCurrent exchange rates as of today. Rates may vary at exchange offices. I recommend using ATMs for better rates!`,
      type: 'currency',
      suggestions: ['Where to exchange money?', 'ATM locations', 'Avoid exchange fees']
    };
  };


  const handleTripPlanning = async (query, context) => {
    const selectedTrip = context.selectedTrip;
    
    if (selectedTrip) {
      return {
        text: `I'd be happy to help you with your trip to ${selectedTrip.destination}! Here's what I can assist you with for "${selectedTrip.title}":\n\n📅 **Trip Details:**\n• Destination: ${selectedTrip.destination}\n• Dates: ${new Date(selectedTrip.startDate).toLocaleDateString()} - ${new Date(selectedTrip.endDate).toLocaleDateString()}\n• Type: ${selectedTrip.tripType}\n\n🎯 **What I can help you with:**\n• Weather forecast for your dates\n• Local attractions and activities\n• Restaurant recommendations\n• Transportation options\n• Packing suggestions\n• Cultural tips and etiquette\n\nWhat specific aspect of your trip would you like help with?`,
        type: 'trip_planning',
        suggestions: ['Weather forecast', 'Local attractions', 'Restaurant recommendations', 'Transportation options']
      };
    } else {
      return {
        text: `I'd be happy to help you plan your trip! Based on your preferences, here's what I suggest:\n\n📅 **Trip Planning Checklist:**\n\n1. **Destination Research** ✓\n2. **Book Flights** - Best deals on Tuesday/Wednesday\n3. **Accommodation** - Book 3-4 weeks in advance\n4. **Activities** - Pre-book popular attractions\n5. **Travel Insurance** - Don't forget this!\n6. **Documents** - Check passport validity\n\nWould you like me to:\n• Generate a detailed itinerary?\n• Search for flights?\n• Find hotels?\n• Suggest activities?`,
        type: 'trip_planning',
        suggestions: ['Create itinerary', 'Search flights', 'Find hotels', 'Local activities']
      };
    }
  };

  const handleGeneralQuery = async (query, history, context) => {
    try {
      // Build enhanced prompt with trip context
      let enhancedQuery = query;
      if (context.selectedTrip) {
        enhancedQuery = `User is asking about their trip to ${context.selectedTrip.destination} (${context.selectedTrip.title}) from ${new Date(context.selectedTrip.startDate).toLocaleDateString()} to ${new Date(context.selectedTrip.endDate).toLocaleDateString()}. Trip type: ${context.selectedTrip.tripType}. User question: ${query}`;
      }

      // Use AI Service to get response
      const aiResponse = await AIService.getChatResponse(
        enhancedQuery,
        history.slice(-10).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))
      );

      return {
        text: aiResponse,
        type: 'text',
        suggestions: getContextualSuggestions(query, context.selectedTrip)
      };
    } catch (error) {
      // Fallback response
      return {
        text: getMockResponse(query, context.selectedTrip),
        type: 'text',
        suggestions: getContextualSuggestions(query, context.selectedTrip)
      };
    }
  };

  const getMockResponse = (query, selectedTrip) => {
    const responses = {
      default: selectedTrip 
        ? `I'm here to help with your trip to ${selectedTrip.destination}! I can assist you with weather, attractions, restaurants, transportation, and more for your upcoming trip. What would you like to know?`
        : "I'm here to help with all your travel needs! You can ask me about destinations, flights, hotels, local attractions, translations, weather, and more. What would you like to know?",
      greeting: selectedTrip
        ? `Hello! I'm ready to help you with your trip to ${selectedTrip.destination}. What would you like to know about your upcoming adventure?`
        : "Hello! Ready for your next adventure? I can help you plan trips, find great places to visit, or answer any travel questions you have.",
      thanks: "You're welcome! Is there anything else you'd like to know about your travel plans?",
      help: selectedTrip
        ? `I can help you with your trip to ${selectedTrip.destination}:\n• Weather forecast for your dates\n• Local attractions and activities\n• Restaurant recommendations\n• Transportation options\n• Packing suggestions\n• Cultural tips and etiquette\n\nWhat would you like help with?`
        : "I can assist you with:\n• Trip planning and itineraries\n• Flight and hotel recommendations\n• Local attractions and restaurants\n• Language translations\n• Weather forecasts\n• Currency conversion\n• Visa requirements\n• Packing tips\n• And much more!\n\nWhat would you like help with?"
    };

    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return responses.greeting;
    }
    if (lowerQuery.includes('thank')) {
      return responses.thanks;
    }
    if (lowerQuery.includes('help') || lowerQuery.includes('what can you')) {
      return responses.help;
    }

    return responses.default;
  };

  const getContextualSuggestions = (query, selectedTrip) => {
    if (selectedTrip) {
      const suggestions = [
        `Weather forecast for ${selectedTrip.destination}`,
        `Top attractions in ${selectedTrip.destination}`,
        `Best restaurants in ${selectedTrip.destination}`,
        `Transportation in ${selectedTrip.destination}`,
        `Packing tips for ${selectedTrip.destination}`,
        `Cultural tips for ${selectedTrip.destination}`
      ];
      return suggestions.slice(0, 3);
    } else {
      const suggestions = [
        'Find nearby restaurants',
        'Plan a day trip',
        'Get travel tips',
        'Check weather'
      ];
      return suggestions.slice(0, 3);
    }
  };

  const handleQuickAction = (action) => {
    const prompts = {
      1: "I want to plan a weekend trip. Where should I go?",
      2: "Find me good restaurants nearby",
      3: "How do I say 'Where is the bathroom?' in Spanish?",
      4: "What should I pack for a week-long trip?",
      5: "Convert 100 USD to EUR",
      6: "What's the weather forecast for this week?",
      7: "What are important travel safety tips?",
      8: "Do I need a visa to visit Japan?"
    };

    sendMessage(prompts[action.id]);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';

    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer
      ]}>
        {!isUser && (
          <Avatar
            rounded
            icon={{ name: 'smart-toy', type: 'material' }}
            containerStyle={styles.avatar}
            size="small"
          />
        )}

        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText
          ]}>
            {item.text}
          </Text>

          {item.suggestions && (
            <View style={styles.suggestionsContainer}>
              {item.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {isUser && (
          <View style={[styles.avatar, styles.userAvatar]}>
            <Text style={styles.avatarEmoji}>
              {selectedAvatar?.emoji || '🧳'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear the chat history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('chatHistory');
            initializeChat();
          }
        }
      ]
    );
  };

  const refreshTrips = async () => {
    setRefreshingTrips(true);
    try {
      await fetchUserData();
    } catch (error) {
      console.error('Error refreshing trips:', error);
    } finally {
      setRefreshingTrips(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#2089dc', '#4da6ff']}
        style={styles.header}
      >
         <Animated.View 
           style={[
             styles.headerContent,
             {
               opacity: fadeAnim,
               transform: [{ translateY: slideAnim }]
             }
           ]}
         >
           <View style={styles.headerLeft}>
             <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
               <Icon name="arrow-back" type="material" color="#fff" size={24} />
             </TouchableOpacity>
             <View style={styles.headerTitleContainer}>
               <Text style={styles.headerTitle}>AI Travel Assistant</Text>
               <View style={styles.headerSubtitleContainer}>
                 <View style={[styles.connectionIndicator, { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }]} />
                 <Text style={styles.headerSubtitle}>
                   {isTyping ? 'Typing...' : isConnected ? 'Always here to help' : 'Connecting...'}
                 </Text>
               </View>
             </View>
           </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={clearChat} style={styles.headerButton}>
              <Icon name="delete-outline" type="material" color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setShowTripSelector(true);
              // Refresh trips when opening the selector
              refreshTrips();
            }} style={styles.headerButton}>
              <Icon name="trip-origin" type="material" color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuickActions(!showQuickActions)} style={styles.headerButton}>
              <Icon name="apps" type="material" color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Selected Trip Context Bar */}
      {selectedContext && (
        <View style={styles.selectedTripBar}>
          <View style={styles.selectedTripInfo}>
            <Icon name="place" type="material" color="#2089dc" size={16} />
            <Text style={styles.selectedTripText}>
              Assisting with: {selectedContext.title} ({selectedContext.destination})
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setSelectedContext(null)}
            style={styles.clearTripButton}
          >
            <Icon name="close" type="material" color="#666" size={16} />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <View style={[styles.messagesWrapper, { marginBottom: isKeyboardVisible ? keyboardHeight : 0 }]}>
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => scrollToBottom()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
        />
      </View>

      {/* Quick Actions */}
      {showQuickActions && messages.length <= 1 && (
        <ScrollView 
          style={styles.quickActionsContainer}
          contentContainerStyle={styles.quickActionsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionButton}
                onPress={() => handleQuickAction(action)}
              >
                <Icon
                  name={action.icon}
                  type="material"
                  color="#2089dc"
                  size={24}
                />
                <Text style={styles.quickActionText}>{action.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#2089dc" />
          <Text style={styles.typingText}>AI is thinking...</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={[
        styles.inputContainer,
        {
          position: 'absolute',
          bottom: isKeyboardVisible ? keyboardHeight : 0,
          left: 0,
          right: 0,
        }
      ]}>
        <Animated.View style={[
          styles.inputWrapper,
          {
            borderColor: isInputFocused ? '#2089dc' : '#e5e5e5',
            shadowOpacity: isInputFocused ? 0.1 : 0,
            transform: [{
              scale: inputFocusAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.02]
              })
            }]
          }
        ]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message AI Travel Assistant..."
            placeholderTextColor="#8e8ea0"
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onFocus={() => {
              setIsInputFocused(true);
              Animated.timing(inputFocusAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }}
            onBlur={() => {
              setIsInputFocused(false);
              Animated.timing(inputFocusAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }}
            onSubmitEditing={() => {
              if (inputText.trim() && !isTyping) {
                sendMessage();
              }
            }}
          />
          <Animated.View style={{
            transform: [{
              scale: sendButtonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.95]
              })
            }]
          }}>
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => {
                Animated.sequence([
                  Animated.timing(sendButtonAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(sendButtonAnim, {
                    toValue: 0,
                    duration: 100,
                    useNativeDriver: true,
                  })
                ]).start();
                sendMessage();
              }}
              disabled={!inputText.trim() || isTyping}
            >
              <Icon
                name="send"
                type="material"
                color={inputText.trim() ? '#fff' : '#8e8ea0'}
                size={20}
              />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Trip Selector Modal */}
      <Modal
        visible={showTripSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Trip for Assistance</Text>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity onPress={refreshTrips} style={styles.refreshButton}>
                <Icon name="refresh" type="material" color="#2089dc" size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTripSelector(false)}>
                <Icon name="close" type="material" color="#333" size={24} />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <TouchableOpacity
              style={[styles.tripOption, !selectedContext && styles.selectedTripOption]}
              onPress={() => {
                setSelectedContext(null);
                setShowTripSelector(false);
              }}
            >
              <View style={styles.tripOptionContent}>
                <Icon name="public" type="material" color="#2089dc" size={24} />
                <View style={styles.tripOptionText}>
                  <Text style={styles.tripOptionTitle}>General Travel Assistance</Text>
                  <Text style={styles.tripOptionSubtitle}>Get help with general travel questions</Text>
                </View>
                {!selectedContext && <Icon name="check" type="material" color="#4CAF50" size={20} />}
              </View>
            </TouchableOpacity>

            {userTrips.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={[styles.tripOption, selectedContext?.id === trip.id && styles.selectedTripOption]}
                onPress={() => {
                  setSelectedContext(trip);
                  setShowTripSelector(false);
                }}
              >
                <View style={styles.tripOptionContent}>
                  <Icon name="place" type="material" color="#2089dc" size={24} />
                  <View style={styles.tripOptionText}>
                    <Text style={styles.tripOptionTitle}>{trip.title}</Text>
                    <Text style={styles.tripOptionSubtitle}>
                      {trip.destination} • {new Date(trip.start_date).toLocaleDateString()}
                    </Text>
                  </View>
                  {selectedContext?.id === trip.id && <Icon name="check" type="material" color="#4CAF50" size={20} />}
                </View>
              </TouchableOpacity>
            ))}

            {userTrips.length === 0 && (
              <View style={styles.noTripsContainer}>
                <Icon name="flight-takeoff" type="material" color="#ccc" size={48} />
                <Text style={styles.noTripsText}>No active trips found</Text>
                <Text style={styles.noTripsSubtext}>Create a trip or check if your trips are active</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={refreshTrips}
                  disabled={refreshingTrips}
                >
                  <Icon name="refresh" type="material" color="#2089dc" size={16} />
                  <Text style={styles.retryButtonText}>
                    {refreshingTrips ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contextBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  contextChip: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  selectedContextChip: {
    backgroundColor: '#2089dc',
  },
  contextChipText: {
    fontSize: 14,
    color: '#333',
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContainer: {
    padding: 15,
    flexGrow: 1,
    paddingBottom: 80, // Add padding to account for input container
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    backgroundColor: '#2089dc',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 15,
    padding: 12,
    marginHorizontal: 8,
  },
  userMessage: {
    backgroundColor: '#2089dc',
  },
  assistantMessage: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#333',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  suggestionChip: {
    backgroundColor: '#f0f8ff',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#2089dc',
  },
  suggestionText: {
    fontSize: 13,
    color: '#2089dc',
  },
  quickActionsContainer: {
    backgroundColor: '#fff',
    maxHeight: 250,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  quickActionsContent: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickActionButton: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 10,
    padding: 12,
    marginRight: '5%',
    marginBottom: 15,
    minHeight: 50,
  },
  quickActionText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  typingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f7f7f8',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#000',
    textAlignVertical: 'top',
    paddingVertical: 8,
    paddingHorizontal: 0,
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2089dc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#2089dc',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e5e5',
    shadowOpacity: 0,
    elevation: 0,
  },
  selectedTripBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectedTripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedTripText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  clearTripButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  tripOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedTripOption: {
    backgroundColor: '#f0f8ff',
    borderColor: '#2089dc',
    borderWidth: 2,
  },
  tripOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  tripOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  tripOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tripOptionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  noTripsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noTripsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  noTripsSubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2089dc',
  },
  retryButtonText: {
    fontSize: 14,
    color: '#2089dc',
    marginLeft: 6,
    fontWeight: '500',
  },
});