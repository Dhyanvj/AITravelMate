import axios from 'axios';

// You'll need to add your OpenAI API key here
const OPENAI_API_KEY = 'YOUR_OPENAI_KEY'; // Store this securely in environment variables

class AIService {
  constructor() {
    this.apiKey = OPENAI_API_KEY;
    this.baseURL = 'https://api.openai.com/v1';
  }

  async getChatResponse(message, context) {
    const systemPrompt = 'You are AI TravelMate, a helpful and knowledgeable travel assistant. You help users with: ' +
      'Trip planning and itineraries, Travel recommendations, Language translations, Weather information, ' +
      'Cultural tips and etiquette, Transportation advice, Visa and documentation requirements, ' +
      'Packing suggestions, and Budget planning. ' +
      'Be concise but informative. Be friendly and enthusiastic about travel. ' +
      'If you don\'t know something specific, offer to help find the information or suggest alternatives.';

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            ...context,
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Chat AI Error:', error);

      // Return a helpful fallback response
      return this.getFallbackChatResponse(message);
    }
  }

  getFallbackChatResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Provide contextual fallback responses
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return 'Hello! I\'m here to help with all your travel needs. What destination are you interested in?';
    }

    if (lowerMessage.includes('flight')) {
      return 'For flights, I recommend checking on Tuesday or Wednesday for the best deals. Set up price alerts and be flexible with your dates if possible. What route are you looking for?';
    }

    if (lowerMessage.includes('hotel') || lowerMessage.includes('accommodation')) {
      return 'For accommodations, consider your priorities: location, amenities, or budget. Booking 3-4 weeks in advance often gives the best rates. What area are you looking to stay in?';
    }

    if (lowerMessage.includes('pack')) {
      return 'Essential packing tips: Roll clothes to save space, keep toiletries under 3.4oz for carry-on, bring versatile clothing items, and always pack essentials in your carry-on. What type of trip are you packing for?';
    }

    if (lowerMessage.includes('visa')) {
      return 'Visa requirements vary by nationality and destination. Check your government\'s travel website or the embassy of your destination country. Most tourist visas require a valid passport (6+ months validity), return ticket, and proof of accommodation. Which country are you planning to visit?';
    }

    if (lowerMessage.includes('weather')) {
      return 'Weather can vary greatly by season and location. Generally, check 10-day forecasts before traveling and pack layers. Would you like specific weather information for a destination?';
    }

    if (lowerMessage.includes('safe')) {
      return 'Travel safety tips: Register with your embassy, keep copies of important documents, research local customs and laws, avoid displaying wealth, and trust your instincts. Stay aware of your surroundings and have emergency contacts saved. Which destination concerns you?';
    }

    if (lowerMessage.includes('budget')) {
      return 'Budget planning: Consider flights (30-40%), accommodation (20-30%), food (20-25%), activities (15-20%), and always add 10-15% for unexpected expenses. Daily budgets vary widely by destination. What\'s your travel style and destination?';
    }

    // Default response
    return 'I\'m here to help with your travel planning! I can assist with destinations, flights, hotels, itineraries, packing tips, visa requirements, and more. What would you like to know about?';
  }

  async generateItinerary(tripDetails) {
    const { destination, startDate, endDate, budget, tripType, interests, travelers, notes } = tripDetails;

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const prompt = `Create a detailed ${days}-day travel itinerary for ${destination}.

Trip Details:
- Travel Dates: ${start.toDateString()} to ${end.toDateString()}
- Budget: $${budget} per person
- Number of Travelers: ${travelers}
- Trip Type: ${tripType}
- Interests: ${interests.join(', ')}
- Special Notes: ${notes || 'None'}

Please create a day-by-day itinerary with the following format for each day:
- Morning activities (with estimated time and cost)
- Afternoon activities (with estimated time and cost)
- Evening activities (with estimated time and cost)
- Recommended restaurants for meals
- Transportation tips for the day
- Approximate daily budget breakdown

Format the response as a JSON object with this structure:
{
  "destination": "${destination}",
  "totalDays": ${days},
  "dailyItinerary": [
    {
      "day": 1,
      "date": "date string",
      "theme": "theme for the day",
      "morning": {
        "activity": "activity name",
        "description": "brief description",
        "duration": "estimated time",
        "cost": "estimated cost per person"
      },
      "afternoon": {
        "activity": "activity name",
        "description": "brief description",
        "duration": "estimated time",
        "cost": "estimated cost per person"
      },
      "evening": {
        "activity": "activity name",
        "description": "brief description",
        "duration": "estimated time",
        "cost": "estimated cost per person"
      },
      "meals": {
        "breakfast": "restaurant recommendation",
        "lunch": "restaurant recommendation",
        "dinner": "restaurant recommendation"
      },
      "transportation": "transportation tips",
      "budgetBreakdown": {
        "activities": "amount",
        "meals": "amount",
        "transportation": "amount",
        "total": "amount"
      },
      "tips": "helpful tips for the day"
    }
  ],
  "overallTips": ["tip1", "tip2", "tip3"],
  "estimatedTotalCost": "total cost for the trip"
}

Ensure the activities match the interests and trip type specified. Be specific with real places and attractions in ${destination}.`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-3.5-turbo-1106', // Using the JSON mode capable model
          messages: [
            {
              role: 'system',
              content: 'You are a professional travel planner. Always respond with valid JSON only, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const itineraryData = JSON.parse(response.data.choices[0].message.content);
      return itineraryData;
    } catch (error) {
      console.error('AI Service Error:', error);

      // Return a mock itinerary if API fails (for testing)
      return this.getMockItinerary(tripDetails);
    }
  }

  async getPlaceRecommendations(location, preferences) {
    const prompt = `Recommend 8 amazing ${preferences.type || 'interesting'} places in ${location} that match these preferences: ${preferences.interests?.join(', ') || 'general tourism'}.
    ${preferences.budget ? `Budget preference: ${preferences.budget}` : ''}

For each place, provide a JSON array with these exact fields:
{
  "name": "Place name",
  "type": "restaurant/attraction/shopping/nightlife/nature/culture/hotel/museum",
  "category": "restaurants/attractions/shopping/nightlife/nature/culture/hotels",
  "description": "Detailed description (2-3 sentences)",
  "rating": 4.5,
  "priceLevel": 1-4 (1=$, 2=$$, 3=$$$, 4=$$$$),
  "address": "Full address",
  "hours": "Current hours or typical schedule",
  "tags": ["tag1", "tag2", "tag3"],
  "estimatedCost": "Cost per person or entry fee",
  "coordinates": {"lat": 0.0, "lng": 0.0},
  "bestTimeToVisit": "Best time to visit",
  "whyRecommended": "Why this place is special"
}

Focus on highly-rated, authentic local experiences. Mix popular attractions with hidden gems.`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-3.5-turbo-1106',
          messages: [
            {
              role: 'system',
              content: 'You are a knowledgeable local travel guide. Provide practical, accurate, and exciting place recommendations. Always respond with valid JSON array only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Parse response
      const responseContent = response.data.choices[0].message.content;
      let places;

      try {
        const parsed = JSON.parse(responseContent);
        // Handle if response is wrapped in an object
        places = parsed.places || parsed.recommendations || parsed;
      } catch (e) {
        // If parsing fails, return mock data
        return this.getMockPlaceRecommendations(location, preferences);
      }

      // Ensure it's an array
      if (!Array.isArray(places)) {
        places = [places];
      }

      return places;
    } catch (error) {
      console.error('Place Recommendations Error:', error);
      return this.getMockPlaceRecommendations(location, preferences);
    }
  }

  async optimizeItinerary(currentItinerary, feedback) {
    const prompt = `Optimize this travel itinerary based on the following feedback: ${feedback}

Current Itinerary: ${JSON.stringify(currentItinerary)}

Please provide an optimized version maintaining the same JSON structure but with improvements based on the feedback.`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'gpt-3.5-turbo-1106',
          messages: [
            {
              role: 'system',
              content: 'You are an expert travel optimizer. Improve itineraries based on traveler feedback.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Optimization Error:', error);
      return currentItinerary;
    }
  }

  // Mock itinerary for testing without API key
  getMockItinerary(tripDetails) {
    const { destination, startDate, endDate, budget, tripType, interests } = tripDetails;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const dailyItinerary = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      dailyItinerary.push({
        day: i + 1,
        date: currentDate.toDateString(),
        theme: i === 0 ? "Arrival & City Overview" : i === days - 1 ? "Final Exploration & Departure" : "Full Day Exploration",
        morning: {
          activity: i === 0 ? "Airport Transfer & Hotel Check-in" : "Local Attraction Visit",
          description: "Start your day with exciting activities",
          duration: "3-4 hours",
          cost: "$20-30"
        },
        afternoon: {
          activity: "Cultural Experience",
          description: "Immerse yourself in local culture",
          duration: "3-4 hours",
          cost: "$30-50"
        },
        evening: {
          activity: "Dinner & Entertainment",
          description: "Enjoy local cuisine and nightlife",
          duration: "2-3 hours",
          cost: "$40-60"
        },
        meals: {
          breakfast: "Hotel Restaurant or Local Café",
          lunch: "Traditional Local Restaurant",
          dinner: "Recommended Fine Dining"
        },
        transportation: "Use local public transport or ride-sharing apps",
        budgetBreakdown: {
          activities: "$50",
          meals: "$60",
          transportation: "$20",
          total: "$130"
        },
        tips: "Book attractions in advance for better prices"
      });
    }

    return {
      destination: destination,
      totalDays: days,
      dailyItinerary: dailyItinerary,
      overallTips: [
        "Download offline maps before you go",
        "Learn basic local phrases",
        "Keep copies of important documents"
      ],
      estimatedTotalCost: `$${days * 130 * (tripDetails.travelers || 1)}`
    };
  }

  // Enhanced mock recommendations for testing
  getMockPlaceRecommendations(location, preferences) {
    const allPlaces = [
      {
        name: 'The Local Kitchen',
        type: 'restaurant',
        category: 'restaurants',
        description: 'Farm-to-table restaurant featuring seasonal local ingredients and innovative dishes. Known for their weekend brunch and craft cocktails.',
        rating: 4.7,
        priceLevel: 3,
        address: '123 Main Street',
        hours: 'Open 11 AM - 10 PM',
        tags: ['Farm-to-Table', 'Local Cuisine', 'Vegetarian Options'],
        estimatedCost: '$30-50 per person',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        bestTimeToVisit: 'Weekend brunch or weekday dinner',
        whyRecommended: 'Perfect blend of local flavors and modern culinary techniques'
      },
      {
        name: 'Historic Art Museum',
        type: 'museum',
        category: 'culture',
        description: 'Stunning collection of contemporary and classical art spanning five centuries. Features rotating exhibitions and educational programs.',
        rating: 4.8,
        priceLevel: 2,
        address: '456 Museum Plaza',
        hours: 'Open 10 AM - 6 PM (Closed Mondays)',
        tags: ['Art', 'History', 'Family-Friendly'],
        estimatedCost: '$20 adults, $10 students',
        coordinates: { lat: 40.7589, lng: -73.9851 },
        bestTimeToVisit: 'Weekday mornings for fewer crowds',
        whyRecommended: 'World-class collection with unique local artist exhibitions'
      },
      {
        name: 'Sunset Beach Park',
        type: 'nature',
        category: 'nature',
        description: 'Beautiful beachfront park with walking trails, picnic areas, and stunning sunset views. Popular for swimming and water sports.',
        rating: 4.6,
        priceLevel: 0,
        address: 'Coastal Highway Mile 5',
        hours: 'Open sunrise to sunset',
        tags: ['Beach', 'Hiking', 'Photography'],
        estimatedCost: 'Free',
        coordinates: { lat: 40.6892, lng: -74.0445 },
        bestTimeToVisit: 'Early morning or before sunset',
        whyRecommended: 'Best sunset views in the area with excellent photo opportunities'
      },
      {
        name: 'Night Market',
        type: 'shopping',
        category: 'shopping',
        description: 'Vibrant evening market featuring local crafts, street food, and live entertainment. Over 100 vendors selling unique items.',
        rating: 4.5,
        priceLevel: 2,
        address: 'Downtown Market Square',
        hours: 'Friday-Sunday 5 PM - 11 PM',
        tags: ['Shopping', 'Street Food', 'Local Crafts'],
        estimatedCost: '$20-40 for food and shopping',
        coordinates: { lat: 40.7484, lng: -73.9857 },
        bestTimeToVisit: 'Friday evenings for live music',
        whyRecommended: 'Authentic local experience with the best street food in town'
      }
    ];

    // Filter based on preferences
    let filteredPlaces = allPlaces;

    if (preferences.type && preferences.type !== 'all') {
      filteredPlaces = allPlaces.filter(p =>
        p.category === preferences.type || p.type === preferences.type
      );
    }

    if (preferences.budget) {
      const budgetMap = {
        '$': 1,
        '$$': 2,
        '$$$': 3,
        '$$$$': 4
      };
      const maxBudget = budgetMap[preferences.budget] || 4;
      filteredPlaces = filteredPlaces.filter(p =>
        p.priceLevel <= maxBudget || p.priceLevel === 0
      );
    }

    // Return up to 8 places
    return filteredPlaces.slice(0, 8);
  }
}

export default new AIService();
