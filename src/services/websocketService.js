import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import encryptionService from './encryptionService';
import { supabase } from './supabase/supabaseClient';

class WebSocketService {
  constructor() {
    this.realtimeChannel = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
    this.connectionStatus = 'disconnected';
    this.tripId = null;
    this.currentUser = null;
    this.typingUsers = new Set();
    this.typingTimeout = null;
    this.healthCheckInterval = null;
  }

  // Initialize WebSocket connection using Supabase Realtime
  async initialize(tripId) {
    try {
      this.tripId = tripId;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      this.currentUser = user;

      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Initializing WebSocket Realtime for trip:', tripId);
      this.connectRealtime();
      
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      throw error;
    }
  }

  // Connect to Supabase Realtime WebSocket with persistent connection
  connectRealtime() {
    try {
      this.connectionStatus = 'connecting';
      
      // Create a persistent realtime channel for this trip
      this.realtimeChannel = supabase
        .channel(`trip-${this.tripId}-websocket`, {
          config: {
            broadcast: { self: true }, // Allow sender to receive their own broadcasts
            presence: { key: this.tripId },
            // Ensure persistent connection with better error handling
            reconnect_after_ms: [1000, 2000, 5000, 10000],
            heartbeat_interval_ms: 30000,
            // Add timeout configuration
            timeout: 10000
          }
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          console.log('WebSocket typing indicator received:', payload);
          // Extract the actual typing data from payload
          const typingData = payload.payload || payload;
          this.handleTypingIndicator(typingData);
        })
        .on('broadcast', { event: 'message' }, (payload) => {
          console.log('WebSocket message received - full payload:', payload);
          console.log('WebSocket message received - payload structure:', JSON.stringify(payload, null, 2));
          
          // The actual message data is in payload.payload when sent via broadcast
          const messageData = payload.payload || payload;
          console.log('Extracted message data:', messageData);
          console.log('Message ID from broadcast:', messageData.id);
          console.log('Message content from broadcast:', messageData.message);
          console.log('Message sender from broadcast:', messageData.sender);
          console.log('Message sender_id from broadcast:', messageData.sender_id);
          
          // Pass the extracted message data to handlers
          this.notifyHandlers('message', messageData);
        })
        .on('broadcast', { event: 'reaction' }, (payload) => {
          console.log('WebSocket reaction received:', payload);
          // Extract the actual reaction data from payload
          const reactionData = payload.payload || payload;
          this.notifyHandlers('reaction', reactionData);
        })
        .on('broadcast', { event: 'message_edit' }, (payload) => {
          console.log('WebSocket message edit received:', payload);
          // Extract the actual edit data from payload
          const editData = payload.payload || payload;
          this.notifyHandlers('message_edit', editData);
        })
        .on('broadcast', { event: 'message_delete' }, (payload) => {
          console.log('WebSocket message delete received:', payload);
          // Extract the actual delete data from payload
          const deleteData = payload.payload || payload;
          this.notifyHandlers('message_delete', deleteData);
        })
        .on('system', {}, (status) => {
          console.log('WebSocket system status:', status);
          if (status.status === 'ok') {
            this.connectionStatus = 'connected';
            this.reconnectAttempts = 0;
            this.notifyHandlers('connection', { status: 'connected' });
            console.log('WebSocket Realtime connected successfully - persistent connection established');
          } else if (status.status === 'error') {
            this.connectionStatus = 'error';
            this.notifyHandlers('connection', { status: 'error' });
            console.error('WebSocket Realtime system error:', status);
            this.scheduleReconnect();
          } else if (status.status === 'disconnected') {
            this.connectionStatus = 'disconnected';
            this.notifyHandlers('connection', { status: 'disconnected' });
            console.log('WebSocket Realtime disconnected');
            this.scheduleReconnect();
          }
        })
        .subscribe((status, err) => {
          console.log('WebSocket Realtime subscription status:', status);
          if (err) {
            console.error('WebSocket Realtime subscription error details:', err);
          }
          
          if (status === 'SUBSCRIBED') {
            this.connectionStatus = 'connected';
            this.reconnectAttempts = 0;
            this.notifyHandlers('connection', { status: 'connected' });
            console.log('WebSocket Realtime subscribed - persistent connection active');
            
            // Start periodic health checks to ensure connection persistence
            this.startHealthCheck();
          } else if (status === 'CHANNEL_ERROR') {
            this.connectionStatus = 'error';
            this.notifyHandlers('connection', { status: 'error', error: err });
            console.error('WebSocket Realtime subscription error:', err);
            this.scheduleReconnect();
          } else if (status === 'CLOSED') {
            this.connectionStatus = 'disconnected';
            this.notifyHandlers('connection', { status: 'disconnected' });
            console.log('WebSocket Realtime connection closed - attempting reconnection');
            this.scheduleReconnect();
          } else if (status === 'TIMED_OUT') {
            this.connectionStatus = 'disconnected';
            this.notifyHandlers('connection', { status: 'disconnected' });
            console.log('WebSocket Realtime connection timed out - attempting reconnection');
            this.scheduleReconnect();
          } else if (status === 'SUBSCRIBING') {
            console.log('WebSocket Realtime subscribing...');
            this.connectionStatus = 'connecting';
          }
        });

    } catch (error) {
      console.error('Error creating WebSocket Realtime connection:', error);
      this.connectionStatus = 'error';
      this.notifyHandlers('connection', { status: 'error', error });
      this.scheduleReconnect();
    }
  }

  // Handle typing indicator
  handleTypingIndicator(payload) {
    const { user_id, is_typing } = payload;
    
    if (is_typing) {
      this.typingUsers.add(user_id);
    } else {
      this.typingUsers.delete(user_id);
    }
    
    this.notifyHandlers('typing', { user_id, is_typing });
  }

  // Send message via WebSocket with instant broadcasting
  async sendMessage(message, attachments = []) {
    try {
      // First, send the message to the database via HTTP
      const messageData = await this.sendMessageViaHTTP(message, attachments);
      console.log('Message saved to database:', messageData.id);
      
      // Then instantly broadcast it via WebSocket to all connected clients
      console.log('WebSocket connection status:', this.connectionStatus);
      console.log('WebSocket channel exists:', !!this.realtimeChannel);
      console.log('Channel state:', this.realtimeChannel?.state);
      
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'message',
          payload: {
            ...messageData,
            message: message, // Send decrypted message for instant display
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        console.log('Sending broadcast payload:', broadcastPayload);
        console.log('Broadcast payload sender info:', broadcastPayload.payload.sender);
        console.log('Broadcast payload message content:', broadcastPayload.payload.message);
        this.realtimeChannel.send(broadcastPayload);
        console.log('Message instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, message saved but not broadcasted');
        console.warn('Connection status:', this.connectionStatus);
        console.warn('Channel exists:', !!this.realtimeChannel);
        console.warn('Channel state:', this.realtimeChannel?.state);
        
        // Try to reconnect if not connected
        if (this.connectionStatus !== 'connected') {
          console.log('Attempting to reconnect WebSocket...');
          this.reconnect();
        }
      }
      
      return messageData;
    } catch (error) {
      console.error('Error sending message via WebSocket:', error);
      throw error;
    }
  }

  // Upload file to Supabase storage
  async uploadFile(file) {
    try {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat-files/${this.tripId}/${fileName}`;

      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        path: filePath
      });

      // Check if storage bucket exists
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        console.error('Error checking buckets:', bucketError);
        throw new Error('Storage service unavailable');
      }

      const chatFilesBucket = buckets.find(bucket => bucket.id === 'chat-files');
      if (!chatFilesBucket) {
        console.error('chat-files bucket not found');
        throw new Error('Storage bucket not configured');
      }

      console.log('Found chat-files bucket:', chatFilesBucket);

      // For React Native, we need to read the file as a blob
      const response = await fetch(file.uri);
      const blob = await response.blob();

      console.log('File blob created, size:', blob.size);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, blob, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('File uploaded successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', publicUrl);

      return {
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Fallback: Create a temporary file record without storage
      console.log('Creating fallback file record...');
      return {
        file_url: file.uri, // Use local URI as fallback
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: `temp/${this.tripId}/${file.name}`,
        is_temp: true // Flag to indicate this is a temporary file
      };
    }
  }

  // Save attachment records to database
  async saveAttachmentRecords(messageId, attachments) {
    try {
      const attachmentRecords = attachments.map(attachment => ({
        message_id: messageId,
        file_url: attachment.file_url,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_size: attachment.file_size,
        uploaded_by: this.currentUser.id,
      }));

      const { error } = await supabase
        .from('chat_attachments')
        .insert(attachmentRecords);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving attachment records:', error);
      throw error;
    }
  }

  // Fallback: Send message via HTTP
  async sendMessageViaHTTP(message, attachments = []) {
    try {
      // Upload attachments first if any
      let uploadedAttachments = [];
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const uploadedFile = await this.uploadFile(attachment);
          uploadedAttachments.push(uploadedFile);
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          trip_id: this.tripId,
          sender_id: this.currentUser.id,
          message: encryptionService.encryptMessage(message, this.tripId).content,
          encrypted: true,
          read_by: [this.currentUser.id]
        })
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

      if (error) throw error;

      // Save attachment records to database
      if (uploadedAttachments.length > 0) {
        await this.saveAttachmentRecords(data.id, uploadedAttachments);
      }
      
      // Return the message with decrypted content for immediate display
      return {
        ...data,
        message: message // Return decrypted message for immediate display
      };
    } catch (error) {
      console.error('Error sending message via HTTP fallback:', error);
      throw error;
    }
  }

  // Get messages for a trip
  async getMessages(tripId) {
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
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Decrypt messages
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

  // Send typing indicator with instant broadcasting
  sendTypingIndicator(isTyping) {
    if (!this.realtimeChannel || this.connectionStatus !== 'connected') {
      console.log('WebSocket not connected, cannot send typing indicator');
      return;
    }

    try {
      const broadcastPayload = {
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: this.currentUser.id,
          is_typing: isTyping,
          trip_id: this.tripId,
          timestamp: new Date().toISOString(),
          broadcasted: true
        }
      };
      
      this.realtimeChannel.send(broadcastPayload);
      console.log('Typing indicator instantly broadcasted to all connected clients:', isTyping);
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  // Send reaction via WebSocket with instant broadcasting
  async sendReaction(messageId, emoji) {
    try {
      // First, save the reaction to the database via HTTP
      const reactionData = await this.sendReactionViaHTTP(messageId, emoji);
      
      // Then instantly broadcast it via WebSocket to all connected clients
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'reaction',
          payload: {
            ...reactionData,
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        this.realtimeChannel.send(broadcastPayload);
        console.log('Reaction instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, reaction saved but not broadcasted');
      }
      
      return reactionData;
    } catch (error) {
      console.error('Error sending reaction via WebSocket:', error);
      throw error;
    }
  }

  // Fallback: Send reaction via HTTP
  async sendReactionViaHTTP(messageId, emoji) {
    try {
      // Remove existing reaction from this user
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', this.currentUser.id);

      // Add new reaction
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: this.currentUser.id,
          emoji: emoji
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending reaction via HTTP fallback:', error);
      throw error;
    }
  }

  // Get typing users
  getTypingUsers() {
    return Array.from(this.typingUsers);
  }

  // Schedule automatic reconnection
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling WebSocket reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.connectionStatus === 'disconnected' || this.connectionStatus === 'error') {
        console.log('Attempting WebSocket reconnection...');
        this.connectRealtime();
      }
    }, delay);
  }

  // Register message handler
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);
  }

  // Remove message handler
  offMessage(type, handler) {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Notify handlers
  notifyHandlers(type, data) {
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Start periodic health checks
  startHealthCheck() {
    this.stopHealthCheck(); // Clear any existing interval
    
    // Run health check only once when connection is established
    this.checkConnectionHealth();
    
    console.log('Connection health check completed - single check performed');
  }

  // Stop health checks
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Check connection health and ensure persistence
  checkConnectionHealth() {
    if (this.realtimeChannel && this.connectionStatus === 'connected') {
      // Send a single ping to verify connection
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'ping',
          payload: {
            timestamp: new Date().toISOString(),
            user_id: this.currentUser?.id
          }
        });
        console.log('Connection health check - ping sent once');
      } catch (error) {
        console.error('Connection health check failed:', error);
        this.connectionStatus = 'error';
        this.scheduleReconnect();
      }
    } else if (this.connectionStatus === 'disconnected' || this.connectionStatus === 'error') {
      console.log('Connection unhealthy, attempting reconnection...');
      this.scheduleReconnect();
    }
  }

  // Disconnect WebSocket
  disconnect() {
    this.stopHealthCheck(); // Stop health checks
    
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.connectionStatus = 'disconnected';
    this.typingUsers.clear();
    this.messageHandlers.clear();
  }

  // Reconnect manually
  reconnect() {
    console.log('Disconnecting WebSocket for reconnection...');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connectRealtime();
  }

  // Check if WebSocket is properly connected
  isConnected() {
    return this.connectionStatus === 'connected' && this.realtimeChannel;
  }

  // Test WebSocket connection by sending a ping
  async testConnection() {
    try {
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const testPayload = {
          type: 'broadcast',
          event: 'ping',
          payload: {
            timestamp: new Date().toISOString(),
            user_id: this.currentUser?.id
          }
        };
        
        this.realtimeChannel.send(testPayload);
        console.log('WebSocket connection test ping sent');
        return true;
      } else {
        console.log('WebSocket not connected for test');
        return false;
      }
    } catch (error) {
      console.error('WebSocket connection test failed:', error);
      return false;
    }
  }

  // Force reconnection
  forceReconnect() {
    console.log('Force reconnecting WebSocket...');
    this.reconnectAttempts = 0;
    this.reconnect();
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
          size: file.size,
          type: file.mimeType,
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
          size: image.fileSize,
          type: 'image/jpeg',
        };
      }
      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      throw error;
    }
  }

  // Take photo with camera
  async takePhoto() {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission not granted');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];
        return {
          uri: image.uri,
          name: `photo_${Date.now()}.jpg`,
          size: image.fileSize,
          type: 'image/jpeg',
        };
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  }

  // Add reaction to message
  async addReaction(messageId, emoji) {
    try {
      // First, remove any existing reaction from this user for this message
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', this.currentUser.id);

      // Then add the new reaction
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: this.currentUser.id,
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

      // Broadcast reaction via WebSocket
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'reaction',
          payload: {
            ...data,
            action: 'added',
            sender_id: this.currentUser.id,
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        console.log('Broadcasting reaction addition:', broadcastPayload);
        this.realtimeChannel.send(broadcastPayload);
        console.log('Reaction addition instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, reaction added but not broadcasted');
      }

      return data;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Remove reaction from message
  async removeReaction(messageId, emoji = null) {
    try {
      // Build the delete query
      let deleteQuery = supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', this.currentUser.id);

      // If emoji is specified, only remove that specific emoji reaction
      if (emoji) {
        deleteQuery = deleteQuery.eq('emoji', emoji);
      }

      const { error } = await deleteQuery;

      if (error) throw error;

      // Broadcast reaction removal via WebSocket
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'reaction',
          payload: {
            message_id: messageId,
            user_id: this.currentUser.id,
            emoji: emoji,
            action: 'removed',
            sender_id: this.currentUser.id,
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        console.log('Broadcasting reaction removal:', broadcastPayload);
        this.realtimeChannel.send(broadcastPayload);
        console.log('Reaction removal instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, reaction removed but not broadcasted');
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }

  // Edit message with instant broadcasting
  async editMessage(messageId, newContent) {
    try {
      // First, update the message in the database
      const { data, error } = await supabase
        .from('chat_messages')
        .update({
          message: encryptionService.encryptMessage(newContent, this.tripId).content,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('sender_id', this.currentUser.id)
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

      if (error) throw error;

      const editedMessage = {
        ...data,
        message: newContent // Return decrypted message for immediate display
      };

      // Then instantly broadcast the edit to all connected clients
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'message_edit',
          payload: {
            ...editedMessage,
            action: 'edited',
            sender_id: this.currentUser.id, // Include sender_id for proper handling
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        console.log('Broadcasting message edit:', broadcastPayload);
        this.realtimeChannel.send(broadcastPayload);
        console.log('Message edit instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, message edited but not broadcasted');
      }

      return editedMessage;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // Delete message with instant broadcasting
  async deleteMessage(messageId) {
    try {
      // First, delete the message from the database
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', this.currentUser.id);

      if (error) throw error;

      // Then instantly broadcast the deletion to all connected clients
      if (this.realtimeChannel && this.connectionStatus === 'connected') {
        const broadcastPayload = {
          type: 'broadcast',
          event: 'message_delete',
          payload: {
            id: messageId,
            action: 'deleted',
            sender_id: this.currentUser.id, // Include sender_id for proper handling
            timestamp: new Date().toISOString(),
            broadcasted: true
          }
        };
        
        console.log('Broadcasting message deletion:', broadcastPayload);
        this.realtimeChannel.send(broadcastPayload);
        console.log('Message deletion instantly broadcasted to all connected clients via WebSocket');
      } else {
        console.warn('WebSocket not connected, message deleted but not broadcasted');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId) {
    try {
      // First get the current message to check read_by array
      const { data: message, error: fetchError } = await supabase
        .from('chat_messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      // Check if user already marked as read
      const readBy = message.read_by || [];
      if (readBy.includes(userId)) {
        return; // Already marked as read
      }

      // Add user to read_by array
      const updatedReadBy = [...readBy, userId];
      
      const { error } = await supabase
        .from('chat_messages')
        .update({
          read_by: updatedReadBy
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }
}

export default new WebSocketService();
