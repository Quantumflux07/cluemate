import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { RoomAggregateResult, MemberRole } from '../types/database';
import { colors } from '../theme/colors';

interface ResultsModalProps {
  visible: boolean;
  onClose: () => void;
  aggregate: RoomAggregateResult | null;
  questionNumber: number;
  userRole: MemberRole | null;
  onRefreshPoll?: () => void;
  onEndRoom?: () => void;
  refreshingPoll?: boolean;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  visible,
  onClose,
  aggregate,
  questionNumber,
  userRole,
  onRefreshPoll,
  onEndRoom,
  refreshingPoll = false,
}) => {
  const isOperator = userRole === 'operator';

  const handleRefresh = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    onRefreshPoll?.();
  };

  const handleEnd = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    onEndRoom?.();
  };

  const totalVotes = aggregate?.total_votes || 0;
  const totalMembers = aggregate?.total_members || 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Group Results</Text>
              <Text style={styles.subtitle}>
                Question {questionNumber} • {totalVotes}/{totalMembers} teammates committed
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Aggregates Breakdown */}
          <View style={styles.breakdownContainer}>
            {/* Option A */}
            <View style={styles.resultRow}>
              <View style={styles.rowLabelGroup}>
                <View style={[styles.letterBadge, { backgroundColor: colors.options.a.accent }]}>
                  <Text style={styles.letterText}>A</Text>
                </View>
                <Text style={styles.optionLabel}>Option A</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${aggregate?.mean_a || 0}%`,
                      backgroundColor: colors.options.a.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: colors.options.a.accent }]}>
                {aggregate?.mean_a || 0}%
              </Text>
            </View>

            {/* Option B */}
            <View style={styles.resultRow}>
              <View style={styles.rowLabelGroup}>
                <View style={[styles.letterBadge, { backgroundColor: colors.options.b.accent }]}>
                  <Text style={styles.letterText}>B</Text>
                </View>
                <Text style={styles.optionLabel}>Option B</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${aggregate?.mean_b || 0}%`,
                      backgroundColor: colors.options.b.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: colors.options.b.accent }]}>
                {aggregate?.mean_b || 0}%
              </Text>
            </View>

            {/* Option C */}
            <View style={styles.resultRow}>
              <View style={styles.rowLabelGroup}>
                <View style={[styles.letterBadge, { backgroundColor: colors.options.c.accent }]}>
                  <Text style={styles.letterText}>C</Text>
                </View>
                <Text style={styles.optionLabel}>Option C</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${aggregate?.mean_c || 0}%`,
                      backgroundColor: colors.options.c.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: colors.options.c.accent }]}>
                {aggregate?.mean_c || 0}%
              </Text>
            </View>

            {/* Option D */}
            <View style={styles.resultRow}>
              <View style={styles.rowLabelGroup}>
                <View style={[styles.letterBadge, { backgroundColor: colors.options.d.accent }]}>
                  <Text style={styles.letterText}>D</Text>
                </View>
                <Text style={styles.optionLabel}>Option D</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${aggregate?.mean_d || 0}%`,
                      backgroundColor: colors.options.d.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: colors.options.d.accent }]}>
                {aggregate?.mean_d || 0}%
              </Text>
            </View>

            {/* Don't Know Summary */}
            <View style={styles.dontKnowRow}>
              <View style={styles.dontKnowLeft}>
                <View style={styles.dontKnowBadge}>
                  <Text style={styles.dontKnowIcon}>?</Text>
                </View>
                <Text style={styles.dontKnowLabel}>Don't Know</Text>
              </View>
              <Text style={styles.dontKnowCount}>
                {aggregate?.dont_know_count || 0} {aggregate?.dont_know_count === 1 ? 'vote' : 'votes'}
              </Text>
            </View>
          </View>

          {/* Operator Action Controls */}
          {isOperator && (
            <View style={styles.operatorActions}>
              <Pressable
                onPress={handleRefresh}
                disabled={refreshingPoll}
                style={({ pressed }) => [
                  styles.refreshButton,
                  { opacity: refreshingPoll ? 0.6 : pressed ? 0.88 : 1 },
                ]}
              >
                {refreshingPoll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.refreshButtonText}>
                    Next Question (Refresh Poll) →
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={handleEnd}
                style={({ pressed }) => [
                  styles.endRoomButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.endRoomText}>End Room Session</Text>
              </Pressable>
            </View>
          )}

          {!isOperator && (
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Close</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    width: '100%',
    maxWidth: 420,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.text.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownContainer: {
    gap: 14,
    marginBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    gap: 8,
  },
  letterBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    color: '#090D14',
    fontSize: 13,
    fontWeight: '900',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  barWrapper: {
    flex: 1,
    height: 12,
    backgroundColor: '#0B0F17',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    width: 44,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dontKnowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1622',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 4,
  },
  dontKnowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dontKnowBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dontKnowIcon: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  dontKnowLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  dontKnowCount: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  operatorActions: {
    gap: 10,
  },
  refreshButton: {
    height: 50,
    backgroundColor: colors.commitButton.bg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.commitButton.border,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  endRoomButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  endRoomText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  doneButton: {
    height: 46,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
