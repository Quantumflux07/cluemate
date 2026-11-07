import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { RoomRow, RoomAggregateResult, PollResponseRow } from '../types/database';
import { resetDraft } from '../utils/allocation';
import { AllocationDraft, CommittedVote } from '../types/voting';

interface UseRoomRealtimeOptions {
  roomId: string;
  userId?: string;
  currentRoom: RoomRow | null;
  onRoomUpdate: (updatedRoom: RoomRow) => void;
  onPollVersionChanged: (newVersion: number, newQuestionNumber: number) => void;
  onRoomEnded: () => void;
  setDraft: React.Dispatch<React.SetStateAction<AllocationDraft>>;
  setCommittedVote: React.Dispatch<React.SetStateAction<CommittedVote | null>>;
}

export function useRoomRealtime({
  roomId,
  userId,
  currentRoom,
  onRoomUpdate,
  onPollVersionChanged,
  onRoomEnded,
  setDraft,
  setCommittedVote,
}: UseRoomRealtimeOptions) {
  const [aggregate, setAggregate] = useState<RoomAggregateResult | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchAggregate = useCallback(async (pollVersion: number) => {
    if (!roomId) return;
    try {
      const { data, error } = await supabase.rpc('get_room_aggregate', {
        p_room_id: roomId,
        p_poll_version: pollVersion,
      });

      if (!error && data) {
        setAggregate(data as RoomAggregateResult);
      }
    } catch (err) {
      console.warn('Error fetching room aggregate:', err);
    }
  }, [roomId]);

  // Initial fetch of aggregates whenever room changes or poll version changes
  useEffect(() => {
    if (currentRoom?.current_poll_version) {
      fetchAggregate(currentRoom.current_poll_version);
    }
  }, [currentRoom?.current_poll_version, fetchAggregate]);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!roomId) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`room_sync_${roomId}`)
      // 1. Listen for changes on `rooms` table
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newRoom = payload.new as RoomRow;
          onRoomUpdate(newRoom);

          if (newRoom.status === 'ended') {
            onRoomEnded();
            return;
          }

          // Check if poll version advanced (Operator refreshed poll)
          if (
            currentRoom &&
            newRoom.current_poll_version !== currentRoom.current_poll_version
          ) {
            // Invalidate local participant drafts for the old poll
            setDraft(resetDraft());
            // Clear previous committed vote for new poll version
            setCommittedVote(null);
            // Notify parent
            onPollVersionChanged(
              newRoom.current_poll_version,
              newRoom.current_question_number
            );
            // Fetch clean aggregates for new version
            fetchAggregate(newRoom.current_poll_version);
          }
        }
      )
      // 2. Listen for changes on `poll_responses` table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_responses',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const activeVersion = currentRoom?.current_poll_version;
          if (activeVersion) {
            fetchAggregate(activeVersion);
          }

          // If the change corresponds to current user's committed vote
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as PollResponseRow;
            if (row.user_id === userId && row.poll_version === activeVersion) {
              setCommittedVote({
                isDontKnow: row.response_type === 'dont_know',
                percentages: {
                  a: row.allocation_a,
                  b: row.allocation_b,
                  c: row.allocation_c,
                  d: row.allocation_d,
                },
                committedAt: row.committed_at,
              });
            }
          }
        }
      )
      // 3. Listen for changes on `room_members` table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          const activeVersion = currentRoom?.current_poll_version;
          if (activeVersion) {
            fetchAggregate(activeVersion);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [
    roomId,
    userId,
    currentRoom,
    onRoomUpdate,
    onPollVersionChanged,
    onRoomEnded,
    setDraft,
    setCommittedVote,
    fetchAggregate,
  ]);

  return {
    aggregate,
    aggregateLoading,
    refetchAggregate: () => {
      if (currentRoom?.current_poll_version) {
        fetchAggregate(currentRoom.current_poll_version);
      }
    },
  };
}
