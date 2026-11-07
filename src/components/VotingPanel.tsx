import React from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LeaderboardOptionRow } from './LeaderboardOptionRow';
import { AllocationDraft, CommittedVote, OptionKey, OPTION_KEYS } from '../types/voting';
import { RoomAggregateResult } from '../types/database';
import { isAllocationCommittable } from '../utils/allocation';
import { colors } from '../theme/colors';

interface VotingPanelProps {
  draft: AllocationDraft;
  committedVote: CommittedVote | null;
  onOptionTap: (key: OptionKey) => void;
  onToggleDontKnow: () => void;
  onReset: () => void;
  onCommit: () => void;
  /** Aggregate data from server used to compute live leader */
  aggregate?: RoomAggregateResult | null;
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
  draft,
  committedVote,
  onOptionTap,
  onToggleDontKnow,
  onReset,
  onCommit,
  aggregate,
}) => {
  const isDontKnowActive = draft.isDontKnow;
  const isCommittable = isAllocationCommittable(draft);

  // Compare draft against committed vote to detect pending uncommitted changes
  const hasUncommittedChanges = React.useMemo(() => {
    if (!committedVote) {
      return isCommittable;
    }
    if (draft.isDontKnow !== committedVote.isDontKnow) return true;
    if (!draft.isDontKnow) {
      return OPTION_KEYS.some(
        (key) => draft.percentages[key] !== committedVote.percentages[key]
      );
    }
    return false;
  }, [draft, committedVote, isCommittable]);

  const canCommit = isCommittable && hasUncommittedChanges;

  // Compute global leader from server aggregate (not from local draft)
  const leaderKeys = React.useMemo((): Set<OptionKey> => {
    if (!aggregate || aggregate.total_votes === 0) return new Set();
    const meanA = aggregate.mean_a || 0;
    const meanB = aggregate.mean_b || 0;
    const meanC = aggregate.mean_c || 0;
    const meanD = aggregate.mean_d || 0;
    const max = Math.max(meanA, meanB, meanC, meanD);
    if (max === 0) return new Set();
    const leaders = new Set<OptionKey>();
    if (meanA === max) leaders.add('a');
    if (meanB === max) leaders.add('b');
    if (meanC === max) leaders.add('c');
    if (meanD === max) leaders.add('d');
    return leaders;
  }, [aggregate]);

  // Map option key to aggregate percentage for the leader overlay
  const getAggregatePct = (key: OptionKey): number => {
    if (!aggregate) return 0;
    if (key === 'a') return aggregate.mean_a || 0;
    if (key === 'b') return aggregate.mean_b || 0;
    if (key === 'c') return aggregate.mean_c || 0;
    return aggregate.mean_d || 0;
  };

  const handleDontKnowPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onToggleDontKnow();
  };

  const handleResetPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    onReset();
  };

  const handleCommitPress = () => {
    if (!canCommit) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onCommit();
  };

  return (
    <View style={styles.cardContainer}>
      {/* 4 Option Buttons: A, B, C, D — with live leader highlight */}
      <View style={styles.optionsList}>
        {OPTION_KEYS.map((key) => (
          <LeaderboardOptionRow
            key={key}
            optionKey={key}
            label={key.toUpperCase()}
            percentage={draft.percentages[key]}
            isLeader={leaderKeys.has(key)}
            accentColor={colors.options[key].accent}
            onPress={onOptionTap}
            disabled={isDontKnowActive}
            showFillBar
          />
        ))}
      </View>

      {/* Don't Know Option */}
      <Pressable
        onPress={handleDontKnowPress}
        style={({ pressed }) => [
          styles.dontKnowButton,
          {
            backgroundColor: isDontKnowActive
              ? colors.dontKnow.bgActive
              : colors.dontKnow.bgIdle,
            borderColor: isDontKnowActive
              ? colors.dontKnow.borderActive
              : colors.dontKnow.borderIdle,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Don't Know option"
      >
        <View style={styles.dontKnowRow}>
          <Text
            style={[
              styles.dontKnowIcon,
              { color: isDontKnowActive ? colors.dontKnow.text : colors.text.muted },
            ]}
          >
            ?
          </Text>
          <Text
            style={[
              styles.dontKnowText,
              {
                color: isDontKnowActive ? colors.dontKnow.text : colors.text.secondary,
                fontWeight: isDontKnowActive ? '700' : '500',
              },
            ]}
          >
            Don't Know
          </Text>
        </View>
        {isDontKnowActive && <View style={styles.activePill} />}
      </Pressable>

      {/* Action Footer: Reset & Commit */}
      <View style={styles.footerRow}>
        <Pressable
          onPress={handleResetPress}
          style={({ pressed }) => [
            styles.resetButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reset Draft"
        >
          <Text style={styles.resetButtonText}>Reset Draft</Text>
        </Pressable>

        <Pressable
          onPress={handleCommitPress}
          disabled={!canCommit}
          style={({ pressed }) => [
            styles.commitButton,
            {
              backgroundColor: canCommit
                ? colors.commitButton.bg
                : '#1E293B',
              borderColor: canCommit
                ? colors.commitButton.border
                : '#334155',
              opacity: !canCommit ? 0.5 : pressed ? 0.88 : 1,
              transform: [{ scale: pressed && canCommit ? 0.98 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            committedVote
              ? canCommit
                ? 'Recommit Vote'
                : 'Vote Committed'
              : 'Commit Vote'
          }
        >
          <Text
            style={[
              styles.commitButtonText,
              {
                color: canCommit
                  ? colors.commitButton.text
                  : colors.text.muted,
              },
            ]}
          >
            {committedVote
              ? canCommit
                ? 'Recommit'
                : 'Committed ✓'
              : 'Commit Vote'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.panel,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  optionsList: {
    width: '100%',
  },
  dontKnowButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 20,
  },
  dontKnowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dontKnowIcon: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  dontKnowText: {
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  activePill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    gap: 14,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  resetButtonText: {
    color: colors.resetButton.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  commitButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
});
