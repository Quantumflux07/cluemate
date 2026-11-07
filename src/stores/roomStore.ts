import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RoomRow, MemberRole } from '../types/database';

export interface ActiveRoomSummary {
  id: string;
  room_code: string;
  role: MemberRole;
  current_question_number: number;
  current_poll_version: number;
  created_at: string;
}

interface RoomState {
  currentRoom: RoomRow | null;
  userRole: MemberRole | null;
  activeRooms: ActiveRoomSummary[];
  loading: boolean;
  error: string | null;

  createRoom: (displayName?: string) => Promise<{ success: boolean; roomId?: string; roomCode?: string; error?: string }>;
  joinRoom: (roomCode: string) => Promise<{ success: boolean; roomId?: string; roomCode?: string; role?: MemberRole; error?: string }>;
  fetchActiveRooms: () => Promise<void>;
  fetchRoom: (roomId: string) => Promise<{ success: boolean; room?: RoomRow; role?: MemberRole; error?: string }>;
  leaveRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
  setCurrentRoom: (room: RoomRow | null, role?: MemberRole | null) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  userRole: null,
  activeRooms: [],
  loading: false,
  error: null,

  createRoom: async (displayName?: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('create_room', {
        p_display_name: displayName || null,
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({ loading: false });
      return {
        success: true,
        roomId: data.room_id,
        roomCode: data.room_code,
      };
    } catch (err: any) {
      const msg = err.message || 'Failed to create room';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  joinRoom: async (roomCode: string) => {
    set({ loading: true, error: null });
    try {
      const normalizedCode = roomCode.trim().toUpperCase();
      if (normalizedCode.length !== 6) {
        set({ loading: false, error: 'Room code must be 6 characters' });
        return { success: false, error: 'Room code must be 6 characters' };
      }

      const { data, error } = await supabase.rpc('join_room', {
        p_room_code: normalizedCode,
      });

      if (error) {
        set({ loading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({ loading: false });
      return {
        success: true,
        roomId: data.room_id,
        roomCode: data.room_code,
        role: data.role as MemberRole,
      };
    } catch (err: any) {
      const msg = err.message || 'Failed to join room';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  fetchActiveRooms: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('room_members')
        .select(`
          room_id,
          role,
          rooms:room_id (
            id,
            room_code,
            status,
            current_question_number,
            current_poll_version,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (error || !data) return;

      const activeList: ActiveRoomSummary[] = [];
      for (const row of data as any[]) {
        if (row.rooms && row.rooms.status === 'active') {
          activeList.push({
            id: row.rooms.id,
            room_code: row.rooms.room_code,
            role: row.role as MemberRole,
            current_question_number: row.rooms.current_question_number,
            current_poll_version: row.rooms.current_poll_version,
            created_at: row.rooms.created_at,
          });
        }
      }

      set({ activeRooms: activeList });
    } catch (err) {
      console.warn('Error fetching active rooms:', err);
    }
  },

  fetchRoom: async (roomId: string) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false, error: 'Not authenticated' });
        return { success: false, error: 'Not authenticated' };
      }

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomErr || !room) {
        set({ loading: false, error: 'Room not found' });
        return { success: false, error: 'Room not found' };
      }

      const { data: member } = await supabase
        .from('room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      const role = (member?.role as MemberRole) || (room.operator_id === user.id ? 'operator' : 'participant');

      set({
        currentRoom: room as RoomRow,
        userRole: role,
        loading: false,
      });

      return {
        success: true,
        room: room as RoomRow,
        role,
      };
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch room';
      set({ loading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  leaveRoom: async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false };

      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      set((prev) => ({
        activeRooms: prev.activeRooms.filter((r) => r.id !== roomId),
        currentRoom: prev.currentRoom?.id === roomId ? null : prev.currentRoom,
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  setCurrentRoom: (room, role) => {
    set({
      currentRoom: room,
      userRole: role !== undefined ? role : get().userRole,
    });
  },
}));
