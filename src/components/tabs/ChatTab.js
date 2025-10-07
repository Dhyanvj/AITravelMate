import { format } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Icon } from 'react-native-elements';
import { supabase } from '../../services/supabase/supabaseClient';
import websocketService from '../../services/websocketService';

const { width: screenWidth } = Dimensions.get('window');

// Helper function to safely format dates
const safeFormatDate = (dateString, formatString = 'HH:mm') => {
  try {
    if (!dateString) {
      console.warn('No date string provided');
      return '--:--';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return '--:--';
    }
    return format(date, formatString);
  } catch (error) {
    console.warn('Date formatting error:', error, 'for date:', dateString);
    return '--:--';
  }
};

const ChatTab = ({ tripId, userRole }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tripMembers, setTripMembers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionType, setConnectionType] = useState('unknown');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMessageRef = useRef(null);

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  useEffect(() => {
    initializeChat();
    
    // Add keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setIsKeyboardVisible(true);
      // Scroll to bottom when keyboard appears
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });
    
    return () => {
      websocketService.disconnect();
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [tripId]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      console.log('Initializing chat for trip:', tripId);
      
      // Get current user
      console.log('Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Authentication failed: ' + userError.message);
      }
      setCurrentUser(user);
      console.log('User set:', user?.id);

      // Get trip members
      console.log('Getting trip members...');
      const { data: members, error: membersError } = await supabase
        .from('trip_members')
        .select(`
          user_id,
          role,
          profiles!trip_members_user_id_fkey(
            id,
            username,
            avatar_url
          )
        `)
        .eq('trip_id', tripId);

      if (membersError) {
        console.error('Error getting trip members:', membersError);
        throw new Error('Failed to load trip members: ' + membersError.message);
      }

      setTripMembers(members || []);
      console.log('Trip members loaded:', members?.length || 0);

      // Initialize WebSocket service
      console.log('Initializing WebSocket service...');
      await websocketService.initialize(tripId);
      console.log('WebSocket service initialized');

      // Load messages
      console.log('Loading messages...');
      const messageData = await websocketService.getMessages(tripId);
      console.log('Loaded messages:', messageData.length);
      console.log('Sample message:', messageData[0]);
      setMessages(messageData);

      // Set up message handlers
      websocketService.onMessage('message', handleNewMessage);
      websocketService.onMessage('reaction', handleReaction);
      websocketService.onMessage('typing', handleTyping);
      websocketService.onMessage('message_edit', handleMessageEdit);
      websocketService.onMessage('message_delete', handleMessageDelete);
      websocketService.onMessage('connection', (data) => {
        console.log('Connection status:', data);
        setConnectionStatus(data.status);
        setConnectionType('websocket');
      });

    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to load chat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to normalize message structure
  const normalizeMessage = (message) => {
    // If message is already properly structured, return as is
    if (message && message.id && message.sender_id) {
      return message;
    }
    
    // Try to extract from nested structure
    if (message && message.payload) {
      return message.payload;
    }
    
    // If still not valid, return null
    if (!message || (!message.id && !message.sender_id)) {
      console.warn('Invalid message structure:', message);
      return null;
    }
    
    return message;
  };

  const handleNewMessage = useCallback((message, action = 'new') => {
    console.log('handleNewMessage called with:', { message, action });
    
    // Normalize the message structure
    const normalizedMessage = normalizeMessage(message);
    if (!normalizedMessage) {
      console.warn('Skipping invalid message:', message);
      return;
    }
    
    console.log('Normalized message:', normalizedMessage);
    console.log('Message ID in handleNewMessage:', normalizedMessage?.id);
    console.log('Message sender in handleNewMessage:', normalizedMessage?.sender_id);
    console.log('Message content in handleNewMessage:', normalizedMessage?.message);
    console.log('Message sender object in handleNewMessage:', normalizedMessage?.sender);
    console.log('Message full structure:', JSON.stringify(normalizedMessage, null, 2));
    console.log('Current user ID:', currentUser?.id);
    
    if (action === 'deleted') {
      setMessages(prev => prev.filter(m => m.id !== normalizedMessage.id));
    } else if (action === 'updated') {
      setMessages(prev => prev.map(m => m.id === normalizedMessage.id ? normalizedMessage : m));
    } else {
      // Check if message already exists to prevent duplicates
      setMessages(prev => {
        // Safety check for message ID
        if (!normalizedMessage.id) {
          console.warn('Message missing ID, adding anyway:', normalizedMessage);
          return [...prev, normalizedMessage];
        }
        
        // Check if message has valid content or sender
        if (!normalizedMessage.message && !normalizedMessage.attachments && !normalizedMessage.sender_id) {
          console.warn('Message missing content and sender, skipping:', normalizedMessage);
          return prev;
        }
        
        // Additional validation for WebSocket messages
        if (!normalizedMessage.id && !normalizedMessage.sender_id) {
          console.warn('Message missing both ID and sender_id, skipping:', normalizedMessage);
          return prev;
        }
        
        const messageExists = prev.some(m => m.id === normalizedMessage.id);
        if (messageExists) {
          console.log('Message already exists, skipping duplicate:', normalizedMessage.id);
          return prev;
        }
        console.log('Adding new message to state:', normalizedMessage.id);
        return [...prev, normalizedMessage];
      });
      
      // Mark as read if not sent by current user
      if (normalizedMessage.sender_id !== currentUser?.id && normalizedMessage.id) {
        websocketService.markAsRead(normalizedMessage.id, currentUser?.id);
      }
    }
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  }, [currentUser, messages.length]);

  const handleReaction = useCallback((reactionData, action = 'added') => {
    console.log('handleReaction called with:', { reactionData, action });
    
    if (reactionData && reactionData.message_id) {
      // Only update if this is not from the current user (to avoid duplicate updates)
      // The current user's changes are handled optimistically in addReaction/removeReaction()
      if (reactionData.sender_id !== currentUser?.id) {
        setMessages(prev => prev.map(message => {
          if (message.id === reactionData.message_id) {
            console.log('Updating reactions from another user:', reactionData);
            
            if (action === 'removed' || reactionData.action === 'removed') {
              // Remove the specific reaction
              const updatedReactions = (message.reactions || []).filter(r => 
                !(r.user_id === reactionData.user_id && r.emoji === reactionData.emoji)
              );
              return { ...message, reactions: updatedReactions };
            } else {
              // Add the reaction (replace any existing reaction from this user)
              const filteredReactions = (message.reactions || []).filter(r => 
                r.user_id !== reactionData.user_id
              );
              return { 
                ...message, 
                reactions: [...filteredReactions, reactionData]
              };
            }
          }
          return message;
        }));
      } else {
        console.log('Skipping reaction update from current user (already handled optimistically)');
      }
    }
  }, [currentUser]);

  const handleTyping = useCallback((typingData) => {
    setTypingUsers(websocketService.getTypingUsers());
  }, []);

  const handleMessageEdit = useCallback((editData) => {
    console.log('handleMessageEdit called with:', editData);
    
    if (editData && editData.id) {
      // Only update if this is not from the current user (to avoid duplicate updates)
      // The current user's changes are handled optimistically in editMessage()
      if (editData.sender_id !== currentUser?.id) {
        setMessages(prev => prev.map(message => {
          if (message.id === editData.id) {
            console.log('Updating message with edit from another user:', editData);
            return {
              ...message,
              message: editData.message,
              edited_at: editData.edited_at,
              // Preserve other message properties
              sender: editData.sender || message.sender,
              sender_id: editData.sender_id || message.sender_id,
              reactions: editData.reactions || message.reactions,
              attachments: editData.attachments || message.attachments
            };
          }
          return message;
        }));
      } else {
        console.log('Skipping edit update from current user (already handled optimistically)');
      }
    }
  }, [currentUser]);

  const handleMessageDelete = useCallback((deleteData) => {
    console.log('handleMessageDelete called with:', deleteData);
    
    if (deleteData && deleteData.id) {
      // Only update if this is not from the current user (to avoid duplicate updates)
      // The current user's changes are handled optimistically in deleteMessage()
      if (deleteData.sender_id !== currentUser?.id) {
        setMessages(prev => prev.filter(message => message.id !== deleteData.id));
        console.log('Message deleted from UI by another user:', deleteData.id);
      } else {
        console.log('Skipping delete update from current user (already handled optimistically)');
      }
    }
  }, [currentUser]);

  // Manual refresh function
  const refreshMessages = async () => {
    try {
      await websocketService.reconnect();
      const messageData = await websocketService.getMessages(tripId);
      setMessages(messageData);
    } catch (error) {
      console.error('Error refreshing messages:', error);
    }
  };

  const sendMessage = async () => {
    if (sending) return;

    try {
      console.log('Sending message:', newMessage.trim(), 'to trip:', tripId);
      setSending(true);
      const message = await websocketService.sendMessage(newMessage.trim());
      console.log('Message sent successfully:', message);
      console.log('Message ID:', message.id);
      console.log('Message structure:', JSON.stringify(message, null, 2));
      
      // Add the sent message to the local state immediately for instant UI update
      console.log('Adding message to local state:', message.id);
      setMessages(prev => {
        console.log('Previous messages count:', prev.length);
        const newMessages = [...prev, message];
        console.log('New messages count:', newMessages.length);
        return newMessages;
      });
      
      // Auto-scroll to bottom after sending message
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      setNewMessage('');
      setEditingMessage(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleTypingStart = () => {
    websocketService.sendTypingIndicator(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      websocketService.sendTypingIndicator(false);
    }, 3000);
  };

  const handleTypingEnd = () => {
    websocketService.sendTypingIndicator(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const pickAndSendImage = async () => {
    setShowAttachmentOptions(false);
    Alert.alert('Coming Soon', 'Photo sharing feature is coming soon!');
  };

  const takeAndSendPhoto = async () => {
    setShowAttachmentOptions(false);
    Alert.alert('Coming Soon', 'Camera feature is coming soon!');
  };

  const pickAndSendFile = async () => {
    setShowAttachmentOptions(false);
    Alert.alert('Coming Soon', 'Document sharing feature is coming soon!');
  };

  const addReaction = async (messageId, emoji) => {
    try {
      // Optimistically update the UI immediately for the user who made the change
      setMessages(prev => prev.map(message => {
        if (message.id === messageId) {
          const existingReactions = message.reactions || [];
          // Remove any existing reaction from this user
          const filteredReactions = existingReactions.filter(r => r.user_id !== currentUser?.id);
          // Add the new reaction
          const newReaction = {
            id: `temp_${Date.now()}`, // Temporary ID for optimistic update
            message_id: messageId,
            user_id: currentUser?.id,
            emoji: emoji,
            user: {
              id: currentUser?.id,
              username: currentUser?.user_metadata?.username || 'You'
            }
          };
          return {
            ...message,
            reactions: [...filteredReactions, newReaction]
          };
        }
        return message;
      }));
      
      // Then send the update via WebSocket
      await websocketService.addReaction(messageId, emoji);
      setShowReactions(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert the optimistic update on error
      setMessages(prev => prev.map(message => {
        if (message.id === messageId) {
          const existingReactions = message.reactions || [];
          // Remove the temporary reaction
          const filteredReactions = existingReactions.filter(r => r.id !== `temp_${Date.now()}`);
          return {
            ...message,
            reactions: filteredReactions
          };
        }
        return message;
      }));
    }
  };

  const removeReaction = async (messageId, emoji) => {
    try {
      // Find the message to get the current reactions for potential rollback
      const message = messages.find(m => m.id === messageId);
      const originalReactions = message?.reactions || [];
      
      // Optimistically update the UI immediately for the user who made the change
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const filteredReactions = (msg.reactions || []).filter(r => 
            !(r.user_id === currentUser?.id && r.emoji === emoji)
          );
          return {
            ...msg,
            reactions: filteredReactions
          };
        }
        return msg;
      }));
      
      // Then send the update via WebSocket
      await websocketService.removeReaction(messageId, emoji);
    } catch (error) {
      console.error('Error removing reaction:', error);
      // Revert the optimistic update on error
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: originalReactions
          };
        }
        return msg;
      }));
    }
  };

  const editMessage = async () => {
    if (!editingMessage || !newMessage.trim()) return;

    try {
      setSending(true);
      
      // Optimistically update the UI immediately for the user who made the change
      const updatedMessage = {
        ...editingMessage,
        message: newMessage.trim(),
        edited_at: new Date().toISOString()
      };
      
      setMessages(prev => prev.map(message => 
        message.id === editingMessage.id ? updatedMessage : message
      ));
      
      // Clear the editing state immediately
      setNewMessage('');
      setEditingMessage(null);
      
      // Then send the update via WebSocket (which will also broadcast to other users)
      await websocketService.editMessage(editingMessage.id, newMessage.trim());
      
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message');
      
      // Revert the optimistic update on error
      setMessages(prev => prev.map(message => 
        message.id === editingMessage.id ? editingMessage : message
      ));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Find the message to delete for potential rollback
              const messageToDelete = messages.find(m => m.id === messageId);
              
              // Optimistically remove the message immediately for the user who made the change
              setMessages(prev => prev.filter(message => message.id !== messageId));
              
              // Then send the delete via WebSocket (which will also broadcast to other users)
              await websocketService.deleteMessage(messageId);
              
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', 'Failed to delete message');
              
              // Revert the optimistic update on error
              if (messageToDelete) {
                setMessages(prev => [...prev, messageToDelete].sort((a, b) => 
                  new Date(a.created_at) - new Date(b.created_at)
                ));
              }
            }
          }
        }
      ]
    );
  };

  const startEditing = (message) => {
    setEditingMessage(message);
    setNewMessage(message.message);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const handleMessageLongPress = (message) => {
    setSelectedMessage(message);
    setShowContextMenu(true);
  };

  const handleMessagePress = () => {
    // Close context menu if open
    if (showContextMenu) {
      setShowContextMenu(false);
      setSelectedMessage(null);
    }
  };

  const closeContextMenu = () => {
    setShowContextMenu(false);
    setSelectedMessage(null);
  };

  const handleAttachmentPress = (attachment) => {
    if (attachment.file_type.startsWith('image/')) {
      // Open image in full screen
      Alert.alert('Image Preview', 'Image preview functionality would open here');
    } else {
      // Download file
      Alert.alert('Download File', `Download ${attachment.file_name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => downloadFile(attachment) }
      ]);
    }
  };

  const downloadFile = async (attachment) => {
    try {
      // In a real implementation, you would use a library like expo-file-system
      // to download and save the file to the device
      Alert.alert('Download Started', `Downloading ${attachment.file_name}...`);
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return 'picture-as-pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'description';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'table-chart';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'slideshow';
    if (fileType.includes('text')) return 'text-fields';
    return 'insert-drive-file';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUserById = (userId, message = null) => {
    // First check if the message already has sender information
    if (message && message.sender) {
      return message.sender;
    }
    // Fall back to tripMembers if sender info not available
    return tripMembers.find(member => member.user_id === userId)?.profiles;
  };

  const getReactionCount = (message, emoji) => {
    return (message.reactions || []).filter(r => r.emoji === emoji).length;
  };

  const hasUserReacted = (message, emoji) => {
    return (message.reactions || []).some(r => 
      r.emoji === emoji && r.user_id === currentUser?.id
    );
  };

  const renderMessage = ({ item: message }) => {
    const isOwn = message.sender_id === currentUser?.id;
    const sender = getUserById(message.sender_id, message);
    
    // Debug logging for message structure
    if (!sender?.username) {
      console.log('Message missing sender info:', {
        messageId: message.id,
        senderId: message.sender_id,
        sender: message.sender,
        messageContent: message.message,
        tripMembers: tripMembers.length
      });
    }

    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessage]}>
        {!isOwn && (
          <View style={styles.messageHeader}>
            <Text style={styles.senderName}>
              {sender?.username || `User ${message.sender_id?.slice(-4) || 'Unknown'}`}
            </Text>
            <Text style={styles.messageTime}>
              {safeFormatDate(message.created_at)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}
          onPress={handleMessagePress}
          onLongPress={() => handleMessageLongPress(message)}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {message.attachments.map((attachment, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.attachmentItem}
                  onPress={() => handleAttachmentPress(attachment)}
                >
                  {attachment.file_type.startsWith('image/') ? (
                    <View style={styles.imageAttachmentContainer}>
                      <Image
                        source={{ uri: attachment.file_url }}
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                      <View style={styles.imageOverlay}>
                        <Icon name="zoom-in" type="material" size={20} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.fileAttachment}>
                      <View style={styles.fileIconContainer}>
                        <Icon 
                          name={getFileIcon(attachment.file_type)} 
                          type="material" 
                          color="#00BFA5" 
                          size={24} 
                        />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {attachment.file_name}
                        </Text>
                        <Text style={styles.fileSize}>
                          {formatFileSize(attachment.file_size)}
                        </Text>
                      </View>
                      <Icon name="download" type="material" color="#666" size={20} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Message Text */}
          {message.message && message.message.trim() && (
            <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
              {message.message}
            </Text>
          )}

          {/* Show placeholder for attachment-only messages */}
          {(!message.message || !message.message.trim()) && message.attachments && message.attachments.length > 0 && (
            <Text style={[styles.messageText, isOwn && styles.ownMessageText, styles.attachmentOnlyText]}>
              📎 {message.attachments.length === 1 ? 'File' : `${message.attachments.length} files`}
            </Text>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <View style={styles.reactionsContainer}>
              {commonReactions.map(emoji => {
                const count = getReactionCount(message, emoji);
                if (count === 0) return null;
                
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.reactionButton,
                      hasUserReacted(message, emoji) && styles.userReaction
                    ]}
                    onPress={() => 
                      hasUserReacted(message, emoji)
                        ? removeReaction(message.id, emoji)
                        : addReaction(message.id, emoji)
                    }
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </TouchableOpacity>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    return (
      <View style={styles.typingIndicator}>
        <ActivityIndicator size="small" color="#00BFA5" />
        <Text style={styles.typingText}>
          {typingUsers.length === 1 ? 'Someone is typing...' : 'Multiple people are typing...'}
        </Text>
      </View>
    );
  };

  const renderConnectionStatus = () => {
    if (connectionStatus === 'connected' || connectionStatus === 'websocket') return null;

    const getStatusText = () => {
      if (connectionStatus === 'connecting') return 'Connecting...';
      if (connectionStatus === 'realtime') return 'Using Realtime (WebSocket failed)';
      if (connectionStatus === 'error') return 'Connection error';
      return 'Connection lost';
    };

    const getStatusColor = () => {
      if (connectionStatus === 'realtime') return '#ffa500'; // Orange for fallback
      return '#ff6b6b'; // Red for error
    };

    return (
      <View style={[styles.connectionStatus, { backgroundColor: connectionStatus === 'realtime' ? '#fff8e1' : '#fff3cd' }]}>
        <ActivityIndicator size="small" color={getStatusColor()} />
        <Text style={[styles.connectionText, { color: connectionStatus === 'realtime' ? '#e65100' : '#856404' }]}>
          {getStatusText()}
        </Text>
        {connectionStatus !== 'connecting' && (
          <TouchableOpacity onPress={() => websocketService.reconnect()} style={styles.refreshButton}>
            <Icon name="refresh" type="material" size={16} color={connectionStatus === 'realtime' ? '#e65100' : '#856404'} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderContextMenu = () => {
    if (!showContextMenu || !selectedMessage) return null;

    const isOwn = selectedMessage.sender_id === currentUser?.id;

    return (
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={closeContextMenu}
      >
        <TouchableOpacity
          style={styles.contextMenuOverlay}
          activeOpacity={1}
          onPress={closeContextMenu}
        >
          <View style={styles.contextMenu}>
            {/* Quick Reactions */}
            <View style={styles.quickReactionsContainer}>
              <Text style={styles.quickReactionsTitle}>Quick Reactions</Text>
              <View style={styles.quickReactionsRow}>
                {commonReactions.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.quickReactionButton}
                    onPress={() => {
                      addReaction(selectedMessage.id, emoji);
                      closeContextMenu();
                    }}
                  >
                    <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.quickReactionButton}
                  onPress={() => {
                    setShowReactions(selectedMessage.id);
                    closeContextMenu();
                  }}
                >
                  <Icon name="add-reaction" type="material" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Message Actions */}
            <View style={styles.messageActionsContainer}>
              {isOwn && (
                <>
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      startEditing(selectedMessage);
                      closeContextMenu();
                    }}
                  >
                    <Icon name="edit" type="material" size={20} color="#666" />
                    <Text style={styles.contextMenuText}>Edit</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.contextMenuItem}
                    onPress={() => {
                      deleteMessage(selectedMessage.id);
                      closeContextMenu();
                    }}
                  >
                    <Icon name="delete" type="material" size={20} color="#f44336" />
                    <Text style={[styles.contextMenuText, { color: '#f44336' }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  // Copy message to clipboard
                  // You can implement clipboard functionality here
                  closeContextMenu();
                }}
              >
                <Icon name="content-copy" type="material" size={20} color="#666" />
                <Text style={styles.contextMenuText}>Copy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BFA5" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Messages List */}
      <View style={[styles.messagesWrapper, { marginBottom: isKeyboardVisible ? keyboardHeight : 0 }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item.id || `message-${index}`}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }}
          ListFooterComponent={renderTypingIndicator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
        />
      </View>

      {/* Message Input */}
      <View style={[
        styles.inputContainer,
        {
          position: 'absolute',
          bottom: isKeyboardVisible ? keyboardHeight : 0,
          left: 0,
          right: 0,
        }
      ]}>
        {editingMessage && (
          <View style={styles.editingIndicator}>
            <Text style={styles.editingText}>Editing message...</Text>
            <TouchableOpacity onPress={cancelEditing}>
              <Icon name="close" type="material" color="#666" />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={() => setShowAttachmentOptions(true)}
          >
            <Icon name="attach-file" type="material" color="#666" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
            onFocus={handleTypingStart}
            onBlur={handleTypingEnd}
            onTextInput={handleTypingStart}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (!sending) {
                if (editingMessage) {
                  editMessage();
                } else {
                  sendMessage();
                }
              }
            }}
          />
          
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={editingMessage ? editMessage : sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon 
                name={editingMessage ? "check" : "send"} 
                type="material" 
                color="#fff" 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Attachment Options Modal */}
      <Modal
        visible={showAttachmentOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachmentOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentOptions(false)}
        >
          <View style={styles.attachmentModal}>
            <Text style={styles.attachmentModalTitle}>Choose Attachment</Text>
            <Text style={styles.comingSoonText}>📎 File sharing features coming soon!</Text>
            
            <View style={styles.attachmentOptionsGrid}>
              <TouchableOpacity
                style={[styles.attachmentOption, styles.disabledOption]}
                onPress={pickAndSendImage}
              >
                <Icon name="photo-library" type="material" size={32} color="#ccc" />
                <Text style={[styles.attachmentOptionText, styles.disabledText]}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.attachmentOption, styles.disabledOption]}
                onPress={takeAndSendPhoto}
              >
                <Icon name="camera-alt" type="material" size={32} color="#ccc" />
                <Text style={[styles.attachmentOptionText, styles.disabledText]}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.attachmentOption, styles.disabledOption]}
                onPress={pickAndSendFile}
              >
                <Icon name="description" type="material" size={32} color="#ccc" />
                <Text style={[styles.attachmentOptionText, styles.disabledText]}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reactions Modal */}
      <Modal
        visible={!!showReactions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReactions(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReactions(null)}
        >
          <View style={styles.reactionsModal}>
            <Text style={styles.reactionsTitle}>Add Reaction</Text>
            <View style={styles.reactionsGrid}>
              {commonReactions.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionOption}
                  onPress={() => addReaction(showReactions, emoji)}
                >
                  <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Context Menu */}
      {renderContextMenu()}
    </View>
  );
};

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
    color: '#666',
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 100, // Add padding to account for input container
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageBubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: '#00BFA5',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 20,
    flexShrink: 1,
  },
  ownMessageText: {
    color: '#fff',
  },
  attachmentOnlyText: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  attachmentsContainer: {
    marginBottom: 8,
  },
  attachmentItem: {
    marginBottom: 8,
  },
  imageAttachmentContainer: {
    position: 'relative',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  userReaction: {
    backgroundColor: '#e3f2fd',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#666',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  typingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 15,
    minHeight: 70,
    paddingBottom: Platform.OS === 'ios' ? 15 : 20,
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
  editingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  editingText: {
    fontSize: 12,
    color: '#1976d2',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '90%',
  },
  attachmentModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  attachmentOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  attachmentOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    minWidth: 80,
  },
  attachmentOptionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  comingSoonText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  disabledOption: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  disabledText: {
    color: '#999',
  },
  reactionsModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reactionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  reactionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  reactionOption: {
    padding: 10,
    margin: 5,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: '90%',
  },
  quickReactionsContainer: {
    marginBottom: 20,
  },
  quickReactionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickReactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickReactionEmoji: {
    fontSize: 20,
  },
  messageActionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 15,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  contextMenuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});

export default ChatTab;
