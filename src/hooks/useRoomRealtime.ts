import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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

  // Stable references for callbacks to prevent subscription recreation
  const onRoomUpdateRef = useRef(onRoomUpdate);
  onRoomUpdateRef.current = onRoomUpdate;

  const onPollVersionChangedRef = useRef(onPollVersionChanged);
  onPollVersionChangedRef.current = onPollVersionChanged;

  const onRoomEndedRef = useRef(onRoomEnded);
  onRoomEndedRef.current = onRoomEnded;

  const setDraftRef = useRef(setDraft);
  setDraftRef.current = setDraft;

  const setCommittedVoteRef = useRef(setCommittedVote);
  setCommittedVoteRef.current = setCommittedVote;

  const activePollVersionRef = useRef<number>(currentRoom?.current_poll_version || 1);
  if (currentRoom?.current_poll_version && currentRoom.current_poll_version > activePollVersionRef.current) {
    activePollVersionRef.current = currentRoom.current_poll_version;
  }

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Authoritative Aggregate Fetcher
  const fetchAggregate = useCallback(async (pollVersion: number) => {
    if (!roomId) return;
    setAggregateLoading(true);
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
    } finally {
      setAggregateLoading(false);
    }
  }, [roomId]);

  // Unified Handler for Poll Advancement (ensures strictly increasing version, no stale overwrites)
  const handlePollAdvancement = useCallback((
    newVersion: number,
    newQuestionNumber: number,
    timerStartedAt: string
  ) => {
    // Only accept strictly newer poll versions
    if (newVersion <= activePollVersionRef.current) {
      return;
    }

    activePollVersionRef.current = newVersion;

    // 1. Immediately invalidate local draft -> all zeros
    setDraftRef.current(resetDraft());

    // 2. Clear previous committed vote for new question
    setCommittedVoteRef.current(null);

    // 3. Clear previous leaderboard immediately so old results are not shown
    setAggregate(null);

    // 4. Update room details in parent
    onRoomUpdateRef.current({
      id: roomId,
      current_poll_version: newVersion,
      current_question_number: newQuestionNumber,
      timer_started_at: timerStartedAt,
    } as RoomRow);

    // 5. Notify parent callback
    onPollVersionChangedRef.current(newVersion, newQuestionNumber);

    // 6. Fetch clean aggregate for new question
    fetchAggregate(newVersion);
  }, [roomId, fetchAggregate]);

  // Re-synchronize authoritative room state from server
  const checkLatestRoomState = useCallback(async () => {
    if (!roomId) return;
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (error || !room) return;

      if (room.status === 'ended') {
        onRoomEndedRef.current();
        return;
      }

      onRoomUpdateRef.current(room as RoomRow);

      if (room.current_poll_version > activePollVersionRef.current) {
        handlePollAdvancement(
          room.current_poll_version,
          room.current_question_number,
          room.timer_started_at
        );
      } else {
        fetchAggregate(room.current_poll_version);
      }
    } catch (err) {
      console.warn('Error syncing room state:', err);
    }
  }, [roomId, handlePollAdvancement, fetchAggregate]);

  // Realtime Channel Setup — Bound ONLY to roomId
  useEffect(() => {
    if (!roomId) return;

    // Clean up previous channel instance
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `room_realtime_${roomId}`;
    const channel = supabase.channel(channelName);

    // 1. Listen for PostgreSQL changes on `rooms` table
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const updated = payload.new as RoomRow;
        if (!updated) return;

        if (updated.status === 'ended') {
          onRoomEndedRef.current();
          return;
        }

        if (updated.current_poll_version > activePollVersionRef.current) {
          handlePollAdvancement(
            updated.current_poll_version,
            updated.current_question_number,
            updated.timer_started_at
          );
        } else {
          onRoomUpdateRef.current(updated);
        }
      }
    );

    // 2. Realtime Broadcast event for instant peer-to-peer notification
    channel.on(
      'broadcast',
      { event: 'poll_advanced' },
      ({ payload }) => {
        if (!payload) return;
        if (payload.poll_version > activePollVersionRef.current) {
          handlePollAdvancement(
            payload.poll_version,
            payload.question_number,
            payload.timer_started_at
          );
        }
      }
    );

    // 3. Listen for PostgreSQL changes on `poll_responses`
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'poll_responses',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const activeVersion = activePollVersionRef.current;
        fetchAggregate(activeVersion);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as PollResponseRow;
          if (row.user_id === userId && row.poll_version === activeVersion) {
            setCommittedVoteRef.current({
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
    );

    // 4. Listen for membership changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        fetchAggregate(activePollVersionRef.current);
      }
    );

    // Subscribe and check status
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Fetch authoritative server state immediately upon connecting
        checkLatestRoomState();
      }
    });

    channelRef.current = channel;

    // Periodic Heartbeat check (every 3.5s) to guarantee zero desync
    const heartbeatTimer = setInterval(() => {
      checkLatestRoomState();
    }, 3500);

    // App state listener (waking up from background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkLatestRoomState();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(heartbeatTimer);
      appStateSub.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, userId, checkLatestRoomState, handlePollAdvancement, fetchAggregate]);

  // Operator Broadcast Helper
  const broadcastPollAdvance = useCallback(async (
    pollVersion: number,
    questionNumber: number,
    timerStartedAt: string
  ) => {
    if (!channelRef.current) return;
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'poll_advanced',
        payload: {
          poll_version: pollVersion,
          question_number: questionNumber,
          timer_started_at: timerStartedAt,
        },
      });
    } catch (err) {
      console.warn('Broadcast send error:', err);
    }
  }, []);

  return {
    aggregate,
    aggregateLoading,
    broadcastPollAdvance,
    manualAdvance: handlePollAdvancement,
    refetchAggregate: () => fetchAggregate(activePollVersionRef.current),
    resyncRoom: checkLatestRoomState,
  };
}
