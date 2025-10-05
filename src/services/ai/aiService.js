import axios from 'axios';

// You'll need to add your OpenAI API key here
<<<<<<< HEAD
const OPENAI_API_KEY = 'YOUR_OPENAI_KEY'; // Store this securely in environment variables
=======
const OPENAI_API_KEY = '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'; // Store this securely in environment variables
>>>>>>> e8d8f0c (Add initial database schemas and features for chat, packing, and expense management. Implemented real-time messaging with WebSocket support, enhanced chat attachments, and packing list functionalities. Updated app layout and added settings tab. Removed unused features and optimized existing code for better performance.)

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
}

export default new AIService();
