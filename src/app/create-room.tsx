import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useRoomStore } from '../stores/roomStore';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

export default function CreateRoomScreen() {
  const { createRoom, loading } = useRoomStore();
  const { profile, user } = useAuthStore();

  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Automatically trigger room creation on mount
    const initRoom = async () => {
      const displayName = profile?.display_name || user?.email?.split('@')[0];
      const res = await createRoom(displayName);
      if (res.success && res.roomId && res.roomCode) {
        setCreatedRoomId(res.roomId);
        setCreatedRoomCode(res.roomCode);
      } else {
        setErrorMsg(res.error || 'Failed to generate room');
      }
    };

    initRoom();
  }, []);

  const handleCopyCode = async () => {
    if (!createdRoomCode) return;
    await Clipboard.setStringAsync(createdRoomCode);
    setCopied(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEnterRoom = () => {
    if (!createdRoomId) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.replace(`/room/${createdRoomId}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        </View>

        {/* Content Card */}
        <View style={styles.contentWrapper}>
          <View style={styles.card}>
            <Text style={styles.title}>Room Created</Text>
            <Text style={styles.subtitle}>
              Share this code with your teammates so they can join this session.
            </Text>

            {loading && !createdRoomCode && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#38BDF8" />
                <Text style={styles.loadingText}>Generating secure room code...</Text>
              </View>
            )}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {createdRoomCode && (
              <View style={styles.codeSection}>
                <Pressable
                  onPress={handleCopyCode}
                  style={({ pressed }) => [
                    styles.codeBox,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy room code"
                >
                  <Text style={styles.codeText}>{createdRoomCode}</Text>
                  <View style={styles.copyPill}>
                    <Text style={styles.copyPillText}>
                      {copied ? 'Copied ✓' : 'Tap to Copy'}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>👑 You are the room operator</Text>
                </View>

                {/* Primary Enter Action */}
                <Pressable
                  onPress={handleEnterRoom}
                  style={({ pressed }) => [
                    styles.enterButton,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Enter Voting Room"
                >
                  <Text style={styles.enterButtonText}>Enter Room →</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  navBar: {
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: colors.text.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.text.muted,
    fontSize: 14,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  codeSection: {
    width: '100%',
    alignItems: 'center',
  },
  codeBox: {
    backgroundColor: '#0A0E17',
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
    position: 'relative',
  },
  codeText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  copyPill: {
    marginTop: 8,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadge: {
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderWidth: 1,
    borderColor: '#FB923C',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  roleBadgeText: {
    color: '#FB923C',
    fontSize: 13,
    fontWeight: '600',
  },
  enterButton: {
    width: '100%',
    height: 52,
    backgroundColor: colors.commitButton.bg,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.commitButton.border,
  },
  enterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
