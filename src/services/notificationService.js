import { supabase } from './supabase/supabaseClient';
import * as Notifications from 'expo-notifications';

class NotificationService {
  constructor() {
    this.subscription = null;
  }

  async initialize() {
    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return;
    }

    // Configure notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  async createNotification(userId, tripId, type, title, message, data = {}) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          trip_id: tripId,
          type,
          title,
          message,
          data
        }]);

      if (error) throw error;

      // Send push notification
      await this.sendPushNotification(userId, title, message);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  async sendPushNotification(userId, title, body) {
    // Implement push notification logic here
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  }

  subscribeToTripUpdates(tripId) {
    this.subscription = supabase
      .channel(`trip-updates-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_logs',
        filter: `trip_id=eq.${tripId}`
      }, (payload) => {
        this.handleActivityUpdate(payload);
      })
      .subscribe();
  }

  handleActivityUpdate(payload) {
    // Handle real-time updates
    console.log('Activity update:', payload);
  }

  unsubscribe() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

export default new NotificationService();