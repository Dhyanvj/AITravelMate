import { supabase } from './supabase/supabaseClient';
import encryptionService from './encryptionService';

class ChatService {
  constructor() {
    this.subscriptions = {};
  }

  // Subscribe to trip chat
  subscribeToChatRoom(tripId, onMessage) {
    // Unsubscribe from existing if any
    if (this.subscriptions[tripId]) {
      this.subscriptions[tripId].unsubscribe();
    }

    // Create new subscription
    const subscription = supabase
      .channel(`trip-chat-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          // Decrypt message if encrypted
          if (payload.new.encrypted) {
            payload.new.message = encryptionService.decryptMessage(
              payload.new.message,
              tripId
            );
          }
          onMessage(payload.new);
        }
      )
      .subscribe();

    this.subscriptions[tripId] = subscription;
    return subscription;
  }

  // Send message
  async sendMessage(tripId, userId, message, encrypted = true) {
    try {
      let messageContent = message;

      // Encrypt if requested
      if (encrypted) {
        const encryptedData = encryptionService.encryptMessage(message, tripId);
        messageContent = encryptedData.content;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          trip_id: tripId,
          sender_id: userId,
          message: messageContent,
          encrypted: encrypted
        }])
        .select(`
          *,
          sender:sender_id (
            full_name,
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Decrypt for local display
      if (data.encrypted) {
        data.message = encryptionService.decryptMessage(data.message, tripId);
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Get chat history
  async getChatHistory(tripId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:sender_id (
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Decrypt messages
      const decryptedMessages = data.map(msg => {
        if (msg.encrypted) {
          msg.message = encryptionService.decryptMessage(msg.message, tripId);
        }
        return msg;
      });

      return decryptedMessages.reverse();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId) {
    try {
      const { data: message } = await supabase
        .from('chat_messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      const readBy = message.read_by || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);

        await supabase
          .from('chat_messages')
          .update({ read_by: readBy })
          .eq('id', messageId);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  // Unsubscribe from chat
  unsubscribeFromChat(tripId) {
    if (this.subscriptions[tripId]) {
      this.subscriptions[tripId].unsubscribe();
      delete this.subscriptions[tripId];
    }
  }

  // Unsubscribe from all chats
  unsubscribeAll() {
    Object.keys(this.subscriptions).forEach(tripId => {
      this.unsubscribeFromChat(tripId);
    });
  }
}

export default new ChatService();