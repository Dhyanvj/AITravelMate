import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Icon } from 'react-native-elements';
import groupTripService from '../../services/groupTripService';
import packingService from '../../services/packingService';
import { supabase } from '../../services/supabase/supabaseClient';
import PackingItemForm from '../packing/PackingItemForm';

export default function PackingTab({ tripId, userRole }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [packingItems, setPackingItems] = useState([]);
  const [personalItems, setPersonalItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [packingStats, setPackingStats] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Form states
  const [itemForm, setItemForm] = useState({
    title: '',
    description: '',
    category: 'other',
    isPersonal: false,
    assignedTo: '',
    priority: 'medium',
    quantity: 1,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [tripId]);

  const fetchData = async () => {
    await Promise.all([
      fetchPackingItems(),
      fetchMembers(),
      fetchCurrentUser(),
      fetchPackingStats()
    ]);
  };

  const fetchPackingItems = async () => {
    try {
      setLoading(true);
      const sharedItems = await packingService.getSharedPackingItems(tripId);
      setPackingItems(sharedItems || []);
      
      if (currentUser) {
        const personalItems = await packingService.getPersonalPackingItems(tripId, currentUser.id);
        setPersonalItems(personalItems || []);
      }
    } catch (error) {
      console.error('Error fetching packing items:', error);
      Alert.alert('Error', 'Failed to load packing items');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersData = await groupTripService.getTripMembers(tripId);
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchPackingStats = async () => {
    try {
      const stats = await packingService.getPackingStats(tripId);
      setPackingStats(stats);
    } catch (error) {
      console.error('Error fetching packing stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setItemForm({
      title: '',
      description: '',
      category: 'other',
      isPersonal: false,
      assignedTo: '',
      priority: 'medium',
      quantity: 1,
      notes: ''
    });
  };

  const handleAddItem = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setItemForm({
      title: item.title,
      description: item.description || '',
      category: item.category,
      isPersonal: item.is_personal,
      assignedTo: item.assigned_to || '',
      priority: item.priority,
      quantity: item.quantity,
      notes: item.notes || ''
    });
    setShowEditModal(true);
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this packing item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await packingService.deletePackingItem(item.id);
              await fetchData();
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const handleTogglePacked = async (item) => {
    try {
      await packingService.toggleItemPacked(item.id, !item.is_packed);
      await fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item status');
    }
  };

  const toggleItemExpanded = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const saveItem = async () => {
    if (!itemForm.title.trim()) {
      Alert.alert('Error', 'Please enter an item title');
      return;
    }

    try {
      setLoading(true);
      
      const itemData = {
        trip_id: tripId,
        title: itemForm.title.trim(),
        description: itemForm.description.trim(),
        category: itemForm.category,
        is_personal: itemForm.isPersonal,
        assigned_to: itemForm.assignedTo || null,
        priority: itemForm.priority,
        quantity: itemForm.quantity,
        notes: itemForm.notes.trim(),
        created_by: currentUser.id
      };

      if (selectedItem) {
        await packingService.updatePackingItem(selectedItem.id, itemData);
        Alert.alert('Success', 'Item updated successfully');
        setShowEditModal(false);
      } else {
        await packingService.createPackingItem(itemData);
        Alert.alert('Success', 'Item added successfully');
        setShowAddModal(false);
      }

      resetForm();
      setSelectedItem(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const renderPackingItem = (item) => {
    const category = packingService.getDefaultCategories().find(cat => cat.id === item.category);
    const assignedUser = members.find(member => member.user_id === item.assigned_to);
    const isExpanded = expandedItems.has(item.id);
    const hasDetails = item.description || item.notes;
    
    // Get priority color for left border
    const priorityColor = item.priority === 'high' ? '#FF3B30' : 
                         item.priority === 'medium' ? '#FF9500' : '#34C759';
    
    // Get user initials for avatar
    const getUserInitials = (user) => {
      if (!user) return 'U';
      const name = user.profiles?.full_name || user.profiles?.username || 'User';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };
    
    return (
      <View key={item.id} style={[styles.modernCard, { borderLeftColor: priorityColor }]}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleTogglePacked(item)}
          >
            <Icon
              name={item.is_packed ? 'check-box' : 'check-box-outline-blank'}
              type="material"
              color={item.is_packed ? '#34C759' : '#8E8E93'}
              size={20}
            />
          </TouchableOpacity>
          
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={[
                styles.modernTitle,
                item.is_packed && styles.itemTitlePacked
              ]}>
                {item.title}
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditItem(item)}
                >
                  <Icon name="edit" type="material" size={16} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteItem(item)}
                >
                  <Icon name="delete" type="material" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.metadataRow}>
              <View style={[styles.categoryTag, { backgroundColor: category?.color || '#C7C7CC' }]}>
                <Text style={styles.categoryTagText}>{category?.name || 'Other'}</Text>
              </View>
              
              {item.quantity > 1 && (
                <View style={styles.quantityTag}>
                  <Text style={styles.quantityTagText}>×{item.quantity}</Text>
                </View>
              )}
              
              {assignedUser && (
                <View style={styles.assignmentTag}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>{getUserInitials(assignedUser)}</Text>
                  </View>
                  <Text style={styles.assignmentText}>
                    {assignedUser.profiles?.full_name || assignedUser.profiles?.username}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {hasDetails && (
          <TouchableOpacity
            style={styles.showDetailsButton}
            onPress={() => toggleItemExpanded(item.id)}
          >
            <Text style={styles.showDetailsText}>Show details</Text>
            <Icon
              name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              type="material"
              size={16}
              color="#8E8E93"
            />
          </TouchableOpacity>
        )}

        {isExpanded && (
          <View style={styles.detailsSection}>
            {item.description && (
              <Text style={styles.descriptionText}>{item.description}</Text>
            )}

            {item.notes && (
              <Text style={styles.notesText}>{item.notes}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderPackingStats = () => {
    if (!packingStats) return null;

    return (
      <Card containerStyle={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Icon name="luggage" type="material" size={24} color="#007AFF" />
          <Text style={styles.statsTitle}>Packing Progress</Text>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{packingStats.total_items}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{packingStats.packed_items}</Text>
            <Text style={styles.statLabel}>Packed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{packingStats.shared_items}</Text>
            <Text style={styles.statLabel}>Shared</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{packingStats.personal_items}</Text>
            <Text style={styles.statLabel}>Personal</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${packingStats.packing_progress_percentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {packingStats.packing_progress_percentage}% Complete
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Packing List</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
          <Icon name="add" type="material" color="white" size={24} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.activeTab]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.activeTabText]}>
            Shared
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
          onPress={() => setActiveTab('personal')}
        >
          <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
            Personal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'summary' && (
          <View>
            {renderPackingStats()}
          </View>
        )}

        {activeTab === 'shared' && (
          <View>
            {packingItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="luggage" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No shared items yet</Text>
                <Text style={styles.emptySubtext}>Add items that everyone can see</Text>
              </View>
            ) : (
              packingItems.map(item => renderPackingItem(item))
            )}
          </View>
        )}

        {activeTab === 'personal' && (
          <View>
            {personalItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="person" type="material" size={64} color="#C7C7CC" />
                <Text style={styles.emptyText}>No personal items yet</Text>
                <Text style={styles.emptySubtext}>Add your personal packing items</Text>
              </View>
            ) : (
              personalItems.map(item => renderPackingItem(item))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Item Modal */}
      <Modal
        visible={showAddModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedItem ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={saveItem} disabled={loading}>
              <Text style={[styles.saveText, loading && styles.disabledText]}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <PackingItemForm
              formData={itemForm}
              setFormData={setItemForm}
              members={members}
              currentUser={currentUser}
              onSave={saveItem}
              loading={loading}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  modernCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 4,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryTagText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  quantityTag: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quantityTagText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
  assignmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  avatarText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  assignmentText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
  showDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  showDetailsText: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 4,
  },
  detailsSection: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  descriptionText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
    lineHeight: 20,
  },
  notesText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  createdText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  disabledText: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
  },
});
