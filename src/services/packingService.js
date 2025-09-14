import { supabase } from './supabase/supabaseClient';
import AIService from './ai/aiService';

class PackingService {
  // Create packing list
  async createPackingList(tripId, name, userId) {
    try {
      const { data, error } = await supabase
        .from('packing_lists')
        .insert([{
          trip_id: tripId,
          name: name,
          created_by: userId
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating packing list:', error);
      throw error;
    }
  }

  // Get AI suggestions for packing
  async getAISuggestions(tripDetails) {
    const { destination, duration, tripType, season } = tripDetails;

    // Mock AI suggestions - replace with actual AI call
    const suggestions = {
      essentials: [
        { name: 'Passport', quantity: 1, category: 'documents' },
        { name: 'Travel Insurance', quantity: 1, category: 'documents' },
        { name: 'Phone Charger', quantity: 1, category: 'electronics' },
        { name: 'Medications', quantity: 1, category: 'health' }
      ],
      clothing: [
        { name: 'T-shirts', quantity: Math.ceil(duration / 2), category: 'clothing' },
        { name: 'Pants/Shorts', quantity: Math.ceil(duration / 3), category: 'clothing' },
        { name: 'Underwear', quantity: duration + 2, category: 'clothing' },
        { name: 'Socks', quantity: duration + 2, category: 'clothing' }
      ],
      toiletries: [
        { name: 'Toothbrush', quantity: 1, category: 'toiletries' },
        { name: 'Toothpaste', quantity: 1, category: 'toiletries' },
        { name: 'Shampoo', quantity: 1, category: 'toiletries' },
        { name: 'Sunscreen', quantity: 1, category: 'toiletries' }
      ],
      destination_specific: this.getDestinationSpecificItems(destination, tripType, season)
    };

    return suggestions;
  }

  // Get destination specific items
  getDestinationSpecificItems(destination, tripType, season) {
    const items = [];

    if (tripType === 'beach' || destination.toLowerCase().includes('beach')) {
      items.push(
        { name: 'Swimsuit', quantity: 2, category: 'clothing' },
        { name: 'Beach Towel', quantity: 1, category: 'accessories' },
        { name: 'Sunglasses', quantity: 1, category: 'accessories' }
      );
    }

    if (tripType === 'hiking' || tripType === 'adventure') {
      items.push(
        { name: 'Hiking Boots', quantity: 1, category: 'footwear' },
        { name: 'Water Bottle', quantity: 1, category: 'accessories' },
        { name: 'First Aid Kit', quantity: 1, category: 'health' }
      );
    }

    if (season === 'winter' || destination.toLowerCase().includes('snow')) {
      items.push(
        { name: 'Winter Jacket', quantity: 1, category: 'clothing' },
        { name: 'Gloves', quantity: 1, category: 'accessories' },
        { name: 'Warm Hat', quantity: 1, category: 'accessories' }
      );
    }

    return items;
  }

  // Add items to packing list
  async addItems(listId, items) {
    try {
      const packingItems = items.map(item => ({
        list_id: listId,
        ...item
      }));

      const { data, error } = await supabase
        .from('packing_items')
        .insert(packingItems)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding packing items:', error);
      throw error;
    }
  }

  // Get packing list items
  async getPackingListItems(listId) {
    try {
      const { data, error } = await supabase
        .from('packing_items')
        .select(`
          *,
          assigned_user:assigned_to (
            full_name,
            username
          )
        `)
        .eq('list_id', listId)
        .order('category', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching packing items:', error);
      throw error;
    }
  }

  // Toggle item packed status
  async toggleItemPacked(itemId, isPacked) {
    try {
      const { error } = await supabase
        .from('packing_items')
        .update({ is_packed: isPacked })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  // Assign item to member
  async assignItem(itemId, userId) {
    try {
      const { error } = await supabase
        .from('packing_items')
        .update({ assigned_to: userId })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error assigning item:', error);
      throw error;
    }
  }

  // Get trip packing lists
  async getTripPackingLists(tripId) {
    try {
      const { data, error } = await supabase
        .from('packing_lists')
        .select(`
          *,
          creator:created_by (
            full_name,
            username
          ),
          packing_items (count)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching packing lists:', error);
      throw error;
    }
  }
}

export default new PackingService();