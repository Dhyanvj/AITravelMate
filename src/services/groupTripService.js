import { supabase } from './supabase/supabaseClient';

class GroupTripService {
  // Generate unique invite code
  generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Create trip with owner
  async createTrip(tripData, userId) {
    try {
      // Create the trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert([tripData]) // Remove created_by from here
        .select()
        .single();

      if (tripError) throw tripError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert([{
          trip_id: trip.id,
          user_id: userId,
          role: 'owner'
        }]);

      if (memberError) {
        // Rollback trip creation if member creation fails
        await supabase.from('trips').delete().eq('id', trip.id);
        throw memberError;
      }

      // Generate invite code
      const inviteCode = this.generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: inviteError } = await supabase
        .from('trip_invites')
        .insert([{
          trip_id: trip.id,
          invite_code: inviteCode,
          created_by: userId,
          expires_at: expiresAt.toISOString()
        }]);

      if (inviteError) {
        console.warn('Invite code creation failed:', inviteError);
        // Don't throw - trip is already created successfully
      }

      return { trip, inviteCode: inviteCode || 'MANUAL' };
    } catch (error) {
      console.error('Error creating trip:', error);
      throw error;
    }
  }

  // Join trip with invite code
  async joinTripWithCode(inviteCode, userId) {
    try {
      // Find valid invite
      const { data: invite, error: inviteError } = await supabase
        .from('trip_invites')
        .select('*, trips(*)')
        .eq('invite_code', inviteCode)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        throw new Error('Invalid or expired invite code');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', invite.trip_id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this trip');
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert([{
          trip_id: invite.trip_id,
          user_id: userId,
          role: 'member'
        }]);

      if (memberError) throw memberError;

      // Update invite usage count
      await supabase
        .from('trip_invites')
        .update({ uses_count: invite.uses_count + 1 })
        .eq('id', invite.id);

      // Log activity
      await this.logActivity(invite.trip_id, userId, 'member_joined', {
        invite_code: inviteCode
      });

      return invite.trips;
    } catch (error) {
      console.error('Error joining trip:', error);
      throw error;
    }
  }

  // Get trip members
  async getTripMembers(tripId) {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            username
          )
        `)
        .eq('trip_id', tripId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching members:', error);
      throw error;
    }
  }

  // Update member role
  async updateMemberRole(tripId, userId, newRole, requesterId) {
    try {
      // Check if requester is owner/admin
      const { data: requester } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', requesterId)
        .single();

      if (!requester || requester.role === 'member') {
        throw new Error('Insufficient permissions');
      }

      // Update role
      const { error } = await supabase
        .from('trip_members')
        .update({ role: newRole })
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) throw error;

      await this.logActivity(tripId, requesterId, 'role_updated', {
        target_user: userId,
        new_role: newRole
      });

      return true;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  // Log activity
  async logActivity(tripId, userId, actionType, actionDetails = {}) {
    try {
      await supabase
        .from('activity_logs')
        .insert([{
          trip_id: tripId,
          user_id: userId,
          action_type: actionType,
          action_details: actionDetails
        }]);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Get trip activities
  async getTripActivities(tripId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  }

  // Update trip details
  async updateTrip(tripId, tripData, userId) {
    try {
      // Check if user has permission to edit
      const { data: member } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new Error('Insufficient permissions to edit trip');
      }

      // Update trip
      const { data: trip, error } = await supabase
        .from('trips')
        .update(tripData)
        .eq('id', tripId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(tripId, userId, 'trip_updated', {
        updated_fields: Object.keys(tripData)
      });

      return trip;
    } catch (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  }

  // Update trip status
  async updateTripStatus(tripId, status, userId) {
    try {
      // Check if user has permission
      const { data: member } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        throw new Error('Insufficient permissions to update trip status');
      }

      // Update status
      const { data: trip, error } = await supabase
        .from('trips')
        .update({ status })
        .eq('id', tripId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(tripId, userId, 'status_updated', {
        new_status: status
      });

      return trip;
    } catch (error) {
      console.error('Error updating trip status:', error);
      throw error;
    }
  }


  // Delete trip (owner only)
  async deleteTrip(tripId, userId) {
    try {
      // Check if user is owner
      const { data: member } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!member || member.role !== 'owner') {
        throw new Error('Only trip owners can delete trips');
      }

      // Delete trip (cascade will handle related records)
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  }

  // Get user's trips with filters
  async getUserTrips(userId, filters = {}) {
    try {
      let query = supabase
        .from('trip_members')
        .select(`
          *,
          trip:trip_id (
            *,
            trip_members (
              count
            )
          )
        `)
        .eq('user_id', userId);

      // Apply filters
      if (filters.status) {
        query = query.eq('trip.status', filters.status);
      }

      if (filters.trip_type) {
        query = query.eq('trip.trip_type', filters.trip_type);
      }

      const { data, error } = await query.order('trip.start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user trips:', error);
      throw error;
    }
  }

  // Leave trip (any member can leave)
  async leaveTrip(tripId, userId) {
    try {
      // Check if user is a member
      const { data: member } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!member) {
        throw new Error('You are not a member of this trip');
      }

      // Check if user is the owner
      if (member.role === 'owner') {
        throw new Error('Trip owners cannot leave their own trip. Transfer ownership or delete the trip instead.');
      }

      // Remove from trip members
      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) throw error;

      // Log activity
      await this.logActivity(tripId, userId, 'member_left', {
        left_by: userId
      });

      return { success: true };
    } catch (error) {
      console.error('Error leaving trip:', error);
      throw error;
    }
  }

}

export default new GroupTripService();