import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { VotingPanel } from '../../components/VotingPanel';
import { AllocationDraft, CommittedVote, OptionKey, OPTION_KEYS } from '../../types/voting';
import {
  handleOptionTap,
  handleToggleDontKnow,
  INITIAL_ALLOCATION,
  isAllocationCommittable,
  resetDraft,
} from '../../utils/allocation';
import { useVolumeShortcut } from '../../hooks/useVolumeShortcut';
import { useRoomRealtime } from '../../hooks/useRoomRealtime';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { RoomRow } from '../../types/database';

export default function VotingRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { currentRoom, userRole, fetchRoom, leaveRoom, setCurrentRoom, loading: roomLoading } = useRoomStore();
  const { user } = useAuthStore();

  const [draft, setDraft] = useState<AllocationDraft>(INITIAL_ALLOCATION);
  const [committedVote, setCommittedVote] = useState<CommittedVote | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [isAdvancingPoll, setIsAdvancingPoll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);

  // Initial room fetch
  useEffect(() => {
    if (!id) return;
    fetchRoom(id).then((res) => {
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to connect to room');
      }
    });
  }, [id, fetchRoom]);

  // Stable callbacks for Realtime Hook
  const handleRoomUpdate = useCallback((updatedRoom: RoomRow) => {
    setCurrentRoom(updatedRoom);
  }, [setCurrentRoom]);

  const handlePollVersionChanged = useCallback((_newVersion: number, _newQuestionNumber: number) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  const handleRoomEnded = useCallback(() => {
    setRoomEnded(true);
  }, []);

  // Synchronized Realtime Hook
  const {
    aggregate,
    broadcastPollAdvance,
    manualAdvance,
  } = useRoomRealtime({
    roomId: id || '',
    userId: user?.id,
    currentRoom,
    onRoomUpdate: handleRoomUpdate,
    onPollVersionChanged: handlePollVersionChanged,
    onRoomEnded: handleRoomEnded,
    setDraft,
    setCommittedVote,
  });

  // Synchronized timer based on server timer_started_at
  useEffect(() => {
    if (!currentRoom?.timer_started_at) return;

    const calcElapsed = () => {
      const start = new Date(currentRoom.timer_started_at).getTime();
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
      setSecondsElapsed(diffSecs);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [currentRoom?.timer_started_at]);

  // Load existing committed vote for this user and current poll version
  useEffect(() => {
    if (!id || !currentRoom?.current_poll_version || !user?.id) return;

    const loadMyVote = async () => {
      const { data } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('room_id', id)
        .eq('poll_version', currentRoom.current_poll_version)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCommittedVote({
          isDontKnow: data.response_type === 'dont_know',
          percentages: {
            a: data.allocation_a,
            b: data.allocation_b,
            c: data.allocation_c,
            d: data.allocation_d,
          },
          committedAt: data.committed_at,
        });
      } else {
        setCommittedVote(null);
      }
    };

    loadMyVote();
  }, [id, currentRoom?.current_poll_version, user?.id]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const onOptionTap = (key: OptionKey) => {
    setDraft((prev) => handleOptionTap(prev, key));
  };

  const onToggleDontKnow = () => {
    setDraft((prev) => handleToggleDontKnow(prev));
  };

  useVolumeShortcut({
    onTrigger: onToggleDontKnow,
    enabled: true,
  });

  const onReset = () => {
    setDraft(resetDraft());
  };

  const onCommit = async () => {
    if (!isAllocationCommittable(draft) || !currentRoom || !id) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc('commit_vote', {
        p_room_id: id,
        p_poll_version: currentRoom.current_poll_version,
        p_response_type: draft.isDontKnow ? 'dont_know' : 'allocation',
        p_a: draft.percentages.a,
        p_b: draft.percentages.b,
        p_c: draft.percentages.c,
        p_d: draft.percentages.d,
      });

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      setCommittedVote({
        isDontKnow: draft.isDontKnow,
        percentages: { ...draft.percentages },
        committedAt: data?.committed_at || new Date().toISOString(),
      });
      setSubmitting(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit vote');
      setSubmitting(false);
    }
  };

  // Operator Action: Advance to Next Question
  const handleNextQuestion = async () => {
    if (!id || userRole !== 'operator' || isAdvancingPoll || !currentRoom) return;

    setIsAdvancingPoll(true);
    setErrorMessage(null);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    try {
      // 1. Authoritative server advancement via existing RPC
      const { data, error } = await supabase.rpc('refresh_poll', {
        p_room_id: id,
      });

      if (error) {
        Alert.alert('Advancement Error', error.message);
        setIsAdvancingPoll(false);
        return;
      }

      // 2. Broadcast to Realtime channel for zero-latency peer notification
      await broadcastPollAdvance(
        data.current_poll_version,
        data.current_question_number,
        data.timer_started_at
      );

      // 3. Process new state on operator client (after server confirms)
      manualAdvance(
        data.current_poll_version,
        data.current_question_number,
        data.timer_started_at
      );

      setIsAdvancingPoll(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to advance question');
      setIsAdvancingPoll(false);
    }
  };

  // Operator Action: End Room — updates DB, Realtime propagates to all clients
  const handleEndRoom = async () => {
    if (!id || userRole !== 'operator') return;

    Alert.alert(
      'End Session',
      'Are you sure you want to end this voting session for all teammates?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('rooms')
              .update({ status: 'ended' })
              .eq('id', id);
            if (error) {
              Alert.alert('Error', 'Failed to end session: ' + error.message);
              return;
            }
            // Realtime will fire onRoomEnded for all clients including operator
            setRoomEnded(true);
          },
        },
      ]
    );
  };

  const handleCopyCode = async () => {
    if (!currentRoom?.room_code) return;
    await Clipboard.setStringAsync(currentRoom.room_code);
    setCopiedCode(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLeaveRoom = async () => {
    if (id) {
      await leaveRoom(id);
    }
    router.replace('/home');
  };

  const isCommittable = isAllocationCommittable(draft);

  const isDirty = React.useMemo(() => {
    if (!committedVote) return isCommittable;
    if (draft.isDontKnow !== committedVote.isDontKnow) return true;
    if (!draft.isDontKnow) {
      return OPTION_KEYS.some(
        (key) => draft.percentages[key] !== committedVote.percentages[key]
      );
    }
    return false;
  }, [draft, committedVote, isCommittable]);

  // Loading state
  if (roomLoading && !currentRoom) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Connecting to room...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Room Ended screen — shown to ALL clients (operator and participants)
  if (roomEnded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.endedContainer}>
          <Text style={styles.endedIcon}>🏁</Text>
          <Text style={styles.endedTitle}>Session Ended</Text>
          <Text style={styles.endedSubtitle}>
            The voting session has been closed by the host.
          </Text>
          <Pressable
            onPress={() => router.replace('/home')}
            style={({ pressed }) => [styles.returnHomeButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.returnHomeText}>Return Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOperator = userRole === 'operator';
  const totalVotes = aggregate?.total_votes || 0;
  const totalMembers = aggregate?.total_members || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar: Leave | Room Code | (nothing — Results button removed) */}
        <View style={styles.topBar}>
          <Pressable onPress={handleLeaveRoom} style={styles.leaveButton}>
            <Text style={styles.leaveText}>← Leave</Text>
          </Pressable>

          <View style={styles.topBarCenter}>
            {currentRoom && (
              <Pressable
                onPress={handleCopyCode}
                style={({ pressed }) => [
                  styles.roomCodePill,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Copy room code"
              >
                <Text style={styles.roomCodePillText}>
                  {currentRoom.room_code} {copiedCode ? '✓' : ''}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Vote count badge (replaces the Results trigger) */}
          <View style={styles.voteCountBadge}>
            <Text style={styles.voteCountText}>
              {totalVotes}{totalMembers > 0 ? `/${totalMembers}` : ''} voted
            </Text>
          </View>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Question Number + Timer Header */}
        <View style={styles.header}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionText}>
              Q{currentRoom?.current_question_number || 1}
            </Text>
          </View>
          <View style={styles.timerBadge}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formatTimer(secondsElapsed)}</Text>
          </View>
        </View>

        {/* Central Voting Panel — VotingPanel now shows leader border inline */}
        <View style={styles.panelWrapper}>
          <VotingPanel
            draft={draft}
            committedVote={committedVote}
            onOptionTap={onOptionTap}
            onToggleDontKnow={onToggleDontKnow}
            onReset={onReset}
            onCommit={onCommit}
            aggregate={aggregate}
          />
        </View>

        {/* Status Indicator */}
        <View style={styles.statusFooter}>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: committedVote
                  ? isDirty
                    ? colors.status.draft
                    : colors.status.committed
                  : colors.status.draft,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {submitting
              ? 'Submitting vote...'
              : committedVote
              ? isDirty
                ? 'Editing draft (committed vote is active)'
                : 'Vote committed'
              : isCommittable
              ? 'Draft (uncommitted)'
              : 'Draft (unallocated)'}
          </Text>
        </View>

        {/* Operator Controls — Next Question + End Session */}
        {isOperator && (
          <View style={styles.operatorControlArea}>
            <View style={styles.operatorControlHeader}>
              <Text style={styles.operatorControlTitle}>👑 Host Controls</Text>
              <Text style={styles.operatorControlSubtitle}>
                {totalVotes} of {totalMembers} committed
              </Text>
            </View>

            <Pressable
              onPress={handleNextQuestion}
              disabled={isAdvancingPoll}
              style={({ pressed }) => [
                styles.nextQuestionButton,
                {
                  opacity: isAdvancingPoll ? 0.6 : pressed ? 0.88 : 1,
                  transform: [{ scale: pressed && !isAdvancingPoll ? 0.985 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next Question"
            >
              {isAdvancingPoll ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.nextQuestionButtonText}>Advancing Question...</Text>
                </View>
              ) : (
                <Text style={styles.nextQuestionButtonText}>
                  Next Question (Q{(currentRoom?.current_question_number || 1) + 1}) →
                </Text>
              )}
            </Pressable>

            <Pressable onPress={handleEndRoom} style={styles.endRoomMainButton}>
              <Text style={styles.endRoomMainText}>End Session</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  // Room Ended screen
  endedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  endedIcon: {
    fontSize: 56,
  },
  endedTitle: {
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  endedSubtitle: {
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  returnHomeButton: {
    marginTop: 8,
    backgroundColor: colors.commitButton.bg,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.commitButton.border,
  },
  returnHomeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Main screen
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  topBarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  leaveText: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  roomCodePill: {
    backgroundColor: '#151D2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  roomCodePillText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  voteCountBadge: {
    backgroundColor: '#151D2A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  voteCountText: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginVertical: 6,
  },
  errorBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  questionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#151D2A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  questionText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#151D2A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  timerText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  panelWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  operatorControlArea: {
    backgroundColor: '#131A26',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FB923C',
    padding: 16,
    marginTop: 10,
    gap: 12,
  },
  operatorControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  operatorControlTitle: {
    color: '#FB923C',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  operatorControlSubtitle: {
    color: colors.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  nextQuestionButton: {
    height: 48,
    backgroundColor: colors.commitButton.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.commitButton.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextQuestionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  endRoomMainButton: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  endRoomMainText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
