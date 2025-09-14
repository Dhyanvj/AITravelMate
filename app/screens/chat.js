import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard
} from 'react-native';
import { Card, Icon, Avatar, Badge, Button, Header } from 'react-native-elements';
import { supabase } from '../../src/services/supabase/supabaseClient';
import AIService from '../../src/services/ai/aiService';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userTrips, setUserTrips] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollViewRef = useRef();

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

      // Fetch user trips for context
      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true })
        .limit(5);

      setUserTrips(trips || []);
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
      selectedContext: selectedContext
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
      case 'recommendation':
        return await handleRecommendation(intent.data, context);
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

    // Recommendation detection
    if (lowerInput.includes('recommend') || lowerInput.includes('suggest') || lowerInput.includes('best') || lowerInput.includes('where should')) {
      return { type: 'recommendation', data: input };
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

  const handleRecommendation = async (query, context) => {
    const response = await AIService.getPlaceRecommendations(
      context.currentTrips?.[0]?.destination || 'your area',
      { interests: context.user?.preferences?.interests || [] }
    );

    const places = response.slice(0, 3);
    let recommendationText = "Here are my top recommendations:\n\n";

    places.forEach((place, index) => {
      recommendationText += `${index + 1}. **${place.name}**\n`;
      recommendationText += `   📍 ${place.address || 'Location available'}\n`;
      recommendationText += `   ⭐ Rating: ${place.rating || 'N/A'}\n`;
      recommendationText += `   💰 ${place.estimatedCost || 'Price varies'}\n`;
      recommendationText += `   ${place.description}\n\n`;
    });

    return {
      text: recommendationText + "Would you like more details about any of these places?",
      type: 'recommendation',
      data: places,
      suggestions: ['Show on map', 'More recommendations', 'Filter by budget']
    };
  };

  const handleTripPlanning = async (query, context) => {
    return {
      text: `I'd be happy to help you plan your trip! Based on your preferences, here's what I suggest:\n\n📅 **Trip Planning Checklist:**\n\n1. **Destination Research** ✓\n2. **Book Flights** - Best deals on Tuesday/Wednesday\n3. **Accommodation** - Book 3-4 weeks in advance\n4. **Activities** - Pre-book popular attractions\n5. **Travel Insurance** - Don't forget this!\n6. **Documents** - Check passport validity\n\nWould you like me to:\n• Generate a detailed itinerary?\n• Search for flights?\n• Find hotels?\n• Suggest activities?`,
      type: 'trip_planning',
      suggestions: ['Create itinerary', 'Search flights', 'Find hotels', 'Local activities']
    };
  };

  const handleGeneralQuery = async (query, history, context) => {
    try {
      // Use AI Service to get response
      const aiResponse = await AIService.getChatResponse(
        query,
        history.slice(-10).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }))
      );

      return {
        text: aiResponse,
        type: 'text',
        suggestions: getContextualSuggestions(query)
      };
    } catch (error) {
      // Fallback response
      return {
        text: getMockResponse(query),
        type: 'text',
        suggestions: getContextualSuggestions(query)
      };
    }
  };

  const getMockResponse = (query) => {
    const responses = {
      default: "I'm here to help with all your travel needs! You can ask me about destinations, flights, hotels, local attractions, translations, weather, and more. What would you like to know?",
      greeting: "Hello! Ready for your next adventure? I can help you plan trips, find great places to visit, or answer any travel questions you have.",
      thanks: "You're welcome! Is there anything else you'd like to know about your travel plans?",
      help: "I can assist you with:\n• Trip planning and itineraries\n• Flight and hotel recommendations\n• Local attractions and restaurants\n• Language translations\n• Weather forecasts\n• Currency conversion\n• Visa requirements\n• Packing tips\n• And much more!\n\nWhat would you like help with?"
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

  const getContextualSuggestions = (query) => {
    const suggestions = [
      'Find nearby restaurants',
      'Plan a day trip',
      'Get travel tips',
      'Check weather'
    ];

    return suggestions.slice(0, 3);
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
          <Avatar
            rounded
            title={userProfile?.full_name?.charAt(0) || 'U'}
            containerStyle={[styles.avatar, styles.userAvatar]}
            size="small"
          />
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <LinearGradient
        colors={['#2089dc', '#4da6ff']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>AI Travel Assistant</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? 'Typing...' : 'Always here to help'}
            </Text>
          </View>
          <TouchableOpacity onPress={clearChat}>
            <Icon name="delete-outline" type="material" color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Trip Context Bar */}
      {userTrips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.contextBar}
        >
          <TouchableOpacity
            style={[styles.contextChip, !selectedContext && styles.selectedContextChip]}
            onPress={() => setSelectedContext(null)}
          >
            <Text style={styles.contextChipText}>General</Text>
          </TouchableOpacity>
          {userTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={[
                styles.contextChip,
                selectedContext?.id === trip.id && styles.selectedContextChip
              ]}
              onPress={() => setSelectedContext(trip)}
            >
              <Text style={styles.contextChipText}>
                {trip.destination.split(',')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Messages */}
      <FlatList
        ref={scrollViewRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollToBottom()}
      />

      {/* Quick Actions */}
      {showQuickActions && messages.length <= 1 && (
        <ScrollView style={styles.quickActionsContainer}>
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything about travel..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim() || isTyping}
        >
          <Icon
            name="send"
            type="material"
            color={inputText.trim() ? '#fff' : '#ccc'}
            size={24}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
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
  messagesContainer: {
    padding: 15,
    flexGrow: 1,
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
  },
  userAvatar: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
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
    paddingVertical: 15,
    paddingHorizontal: 15,
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
    marginBottom: 10,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2089dc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
});