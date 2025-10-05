import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import encryptionService from './encryptionService';
import { supabase } from './supabase/supabaseClient';

class ChatService {
  constructor() {
    this.realtimeSubscription = null;
    this.typingUsers = new Set();
    this.typingTimeout = null;
  }

  // Get all messages for a trip
  async getMessages(tripId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(
            id,
            username,
            avatar_url
          ),
          attachments:chat_attachments(*),
          reactions:message_reactions(
            *,
            user:profiles!message_reactions_user_id_fkey(
              id,
              username
            )
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Decrypt messages if needed
      const decryptedMessages = data.map(message => ({
        ...message,
        message: message.encrypted 
          ? encryptionService.decryptMessage(message.message, tripId)
          : message.message
      }));

      return decryptedMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Send a new message
  async sendMessage(tripId, message, attachments = []) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Encrypt the message
        const encryptedData = encryptionService.encryptMessage(message, tripId);
      
      const messageData = {
        trip_id: tripId,
        sender_id: user.id,
        message: encryptedData.content,
        encrypted: encryptedData.encrypted,
        attachments: attachments.length > 0 ? attachments : null,
        read_by: [user.id] // Mark as read by sender
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(
            id,
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Upload attachments if any
      if (attachments.length > 0) {
        await this.uploadAttachments(data.id, attachments);
      }

      return {
        ...data,
        message: message // Return decrypted message for immediate display
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Upload file attachments
  async uploadAttachments(messageId, attachments) {
    try {
      const attachmentPromises = attachments.map(async (attachment) => {
        const fileExt = attachment.uri.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `chat-attachments/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, {
            uri: attachment.uri,
            type: attachment.type,
            name: attachment.name
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath);

        // Save attachment record
        const { data, error } = await supabase
          .from('chat_attachments')
          .insert({
            message_id: messageId,
            file_url: publicUrl,
            file_name: attachment.name,
            file_type: attachment.type,
            file_size: attachment.size,
            uploaded_by: (await supabase.auth.getUser()).data.user.id
          })
          .single();

        if (error) throw error;
        return data;
      });

      return await Promise.all(attachmentPromises);
    } catch (error) {
      console.error('Error uploading attachments:', error);
      throw error;
    }
  }

  // Pick and prepare file for upload
  async pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        return {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
          size: file.size
        };
      }
      return null;
    } catch (error) {
      console.error('Error picking file:', error);
      throw error;
    }
  }

  // Pick and prepare image for upload
  async pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];
        return {
          uri: image.uri,
          name: `image_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: image.fileSize || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      throw error;
    }
  }

  // Add reaction to message
  async addReaction(messageId, emoji) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Remove existing reaction from this user
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      // Add new reaction
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji: emoji
        })
        .select(`
          *,
          user:profiles!message_reactions_user_id_fkey(
            id,
            username
          )
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Remove reaction from message
  async removeReaction(messageId, emoji = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build the delete query
      let deleteQuery = supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      // If emoji is specified, only remove that specific emoji reaction
      if (emoji) {
        deleteQuery = deleteQuery.eq('emoji', emoji);
      }

      const { error } = await deleteQuery;

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }

  // Edit message
  async editMessage(messageId, newMessage, tripId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Encrypt the new message
      const encryptedData = encryptionService.encryptMessage(newMessage, tripId);

      // Try to update with edited_at first, fallback without it if column doesn't exist
      let updateData = {
        message: encryptedData.content,
        encrypted: encryptedData.encrypted
      };

      try {
        // First attempt with edited_at
        const { data, error } = await supabase
          .from('chat_messages')
          .update({
            ...updateData,
            edited_at: new Date().toISOString()
          })
          .eq('id', messageId)
          .eq('sender_id', user.id)
          .select(`
            *,
            sender:profiles!chat_messages_sender_id_fkey(
              id,
              username,
              avatar_url
            ),
            attachments:chat_attachments(*),
            reactions:message_reactions(
              *,
              user:profiles!message_reactions_user_id_fkey(
                id,
                username
              )
            )
          `)
          .single();

        if (error && error.code === 'PGRST204') {
          // Column doesn't exist, try without edited_at
          console.warn('edited_at column not found, updating without it');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chat_messages')
            .update(updateData)
            .eq('id', messageId)
            .eq('sender_id', user.id)
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey(
                id,
                username,
                avatar_url
              ),
              attachments:chat_attachments(*),
              reactions:message_reactions(
                *,
                user:profiles!message_reactions_user_id_fkey(
                  id,
                  username
                )
              )
            `)
            .single();

          if (fallbackError) throw fallbackError;
          return {
            ...fallbackData,
            message: newMessage
          };
        }

        if (error) throw error;

        return {
          ...data,
          message: newMessage
        };
      } catch (updateError) {
        if (updateError.code === 'PGRST204') {
          // Column doesn't exist, try without edited_at
          console.warn('edited_at column not found, updating without it');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chat_messages')
            .update(updateData)
            .eq('id', messageId)
            .eq('sender_id', user.id)
            .select(`
              *,
              sender:profiles!chat_messages_sender_id_fkey(
                id,
                username,
                avatar_url
              ),
              attachments:chat_attachments(*),
              reactions:message_reactions(
                *,
                user:profiles!message_reactions_user_id_fkey(
                  id,
                  username
                )
              )
            `)
            .single();

          if (fallbackError) throw fallbackError;
          return {
            ...fallbackData,
            message: newMessage
          };
        }
        throw updateError;
      }
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // Delete message
  async deleteMessage(messageId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id); // Ensure user can only delete their own messages

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (error) throw error;

      const readBy = data.read_by || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);

        await supabase
          .from('chat_messages')
          .update({ read_by: readBy })
          .eq('id', messageId);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  // Subscribe to real-time updates
  subscribeToMessages(tripId, onMessage, onReaction, onTyping) {
    this.realtimeSubscription = supabase
      .channel(`trip-${tripId}-chat`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          // Decrypt message for display
          const decryptedMessage = {
            ...payload.new,
            message: payload.new.encrypted 
              ? encryptionService.decryptMessage(payload.new.message, tripId)
              : payload.new.message
          };
          onMessage(decryptedMessage);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=in.(${tripId})`
        },
        (payload) => {
          onReaction(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          onReaction(payload.old, 'removed');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          const decryptedMessage = {
            ...payload.new,
            message: payload.new.encrypted 
              ? encryptionService.decryptMessage(payload.new.message, tripId)
              : payload.new.message
          };
          onMessage(decryptedMessage, 'updated');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          onMessage(payload.old, 'deleted');
        }
      )
      .subscribe();

    return this.realtimeSubscription;
  }

  // Send typing indicator
  async sendTypingIndicator(tripId, isTyping) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isTyping) {
        this.typingUsers.add(user.id);
        
        // Clear existing timeout
        if (this.typingTimeout) {
          clearTimeout(this.typingTimeout);
        }

        // Set timeout to stop typing indicator
        this.typingTimeout = setTimeout(() => {
          this.typingUsers.delete(user.id);
        }, 3000);
      } else {
        this.typingUsers.delete(user.id);
        if (this.typingTimeout) {
          clearTimeout(this.typingTimeout);
        }
      }
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  // Get typing users
  getTypingUsers() {
    return Array.from(this.typingUsers);
  }

  // Unsubscribe from real-time updates
  unsubscribe() {
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription);
      this.realtimeSubscription = null;
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.typingUsers.clear();
  }
}

export default new ChatService();