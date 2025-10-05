import { supabase } from './supabase/supabaseClient';

class PackingService {
  // Create packing item
  async createPackingItem(itemData) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .insert([itemData])
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating packing item:', error);
      throw error;
    }
  }

  // Update packing item
  async updatePackingItem(itemId, itemData) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .update(itemData)
        .eq('id', itemId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating packing item:', error);
      throw error;
    }
  }

  // Delete packing item
  async deletePackingItem(itemId) {
    try {
      const { error } = await supabase
        .from('packing_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting packing item:', error);
      throw error;
    }
  }

  // Get trip packing items
  async getTripPackingItems(tripId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching packing items:', error);
      throw error;
    }
  }

  // Get shared packing items
  async getSharedPackingItems(tripId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .eq('is_personal', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching shared packing items:', error);
      throw error;
    }
  }

  // Get personal packing items
  async getPersonalPackingItems(tripId, userId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .eq('is_personal', true)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching personal packing items:', error);
      throw error;
    }
  }

  // Toggle item packed status
  async toggleItemPacked(itemId, isPacked) {
    try {
      const updateData = { is_packed: isPacked };
      
      if (isPacked) {
        updateData.packed_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        updateData.packed_by = user?.id || null;
      } else {
        updateData.packed_at = null;
        updateData.packed_by = null;
      }

      const { data, error } = await supabase
        .from('packing_items')
        .update(updateData)
        .eq('id', itemId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling item packed status:', error);
      throw error;
    }
  }

  // Assign item to member
  async assignItemToMember(itemId, memberId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .update({ assigned_to: memberId })
        .eq('id', itemId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning item to member:', error);
      throw error;
    }
  }

  // Get packing categories
  async getPackingCategories() {
    try {
      const { data, error } = await supabase
        .from('packing_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching packing categories:', error);
      // Return default categories if database fetch fails
      return this.getDefaultCategories();
    }
  }

  // Get default categories (fallback)
  getDefaultCategories() {
    return [
      { id: 'clothing', name: 'Clothing', icon: 'checkroom', color: '#FF6B6B' },
      { id: 'toiletries', name: 'Toiletries', icon: 'face', color: '#4ECDC4' },
      { id: 'electronics', name: 'Electronics', icon: 'devices', color: '#45B7D1' },
      { id: 'documents', name: 'Documents', icon: 'description', color: '#96CEB4' },
      { id: 'medications', name: 'Medications', icon: 'local-pharmacy', color: '#FFEAA7' },
      { id: 'accessories', name: 'Accessories', icon: 'style', color: '#DDA0DD' },
      { id: 'snacks', name: 'Snacks & Food', icon: 'restaurant', color: '#FFB347' },
      { id: 'other', name: 'Other', icon: 'more-horiz', color: '#C7C7CC' }
    ];
  }

  // Get packing statistics
  async getPackingStats(tripId) {
    try {
      const { data, error } = await supabase
        .from('packing_stats')
        .select('*')
        .eq('trip_id', tripId);

      if (error) throw error;
      
      // If no data found, return default stats
      if (!data || data.length === 0) {
        return {
          trip_id: tripId,
          total_items: 0,
          packed_items: 0,
          shared_items: 0,
          personal_items: 0,
          packing_progress_percentage: 0
        };
      }
      
      return data[0];
    } catch (error) {
      console.error('Error fetching packing stats:', error);
      // Calculate stats manually if view doesn't exist
      return this.calculatePackingStats(tripId);
    }
  }

  // Calculate packing statistics manually
  async calculatePackingStats(tripId) {
    try {
      const items = await this.getTripPackingItems(tripId);
      
      const totalItems = items.length;
      const packedItems = items.filter(item => item.is_packed).length;
      const sharedItems = items.filter(item => !item.is_personal).length;
      const personalItems = items.filter(item => item.is_personal).length;
      const packingProgress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

      return {
        trip_id: tripId,
        total_items: totalItems,
        packed_items: packedItems,
        shared_items: sharedItems,
        personal_items: personalItems,
        packing_progress_percentage: packingProgress
      };
    } catch (error) {
      console.error('Error calculating packing stats:', error);
      return {
        trip_id: tripId,
        total_items: 0,
        packed_items: 0,
        shared_items: 0,
        personal_items: 0,
        packing_progress_percentage: 0
      };
    }
  }

  // Get items by category
  async getItemsByCategory(tripId, category) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching items by category:', error);
      throw error;
    }
  }

  // Get items assigned to specific member
  async getItemsAssignedToMember(tripId, memberId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .eq('assigned_to', memberId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching items assigned to member:', error);
      throw error;
    }
  }

  // Bulk update items (for batch operations)
  async bulkUpdateItems(itemIds, updateData) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .update(updateData)
        .in('id', itemIds)
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error bulk updating items:', error);
      throw error;
    }
  }

  // Search packing items
  async searchPackingItems(tripId, searchTerm) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select('*')
        .eq('trip_id', tripId)
        .or(`item_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching packing items:', error);
      throw error;
    }
  }
}

export default new PackingService();