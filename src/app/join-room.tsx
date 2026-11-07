import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRoomStore } from '../stores/roomStore';
import { colors } from '../theme/colors';

export default function JoinRoomScreen() {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { joinRoom, loading } = useRoomStore();

  const handleCodeChange = (text: string) => {
    // Only allow alphanumeric, uppercase, max 6 characters
    const clean = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    setCode(clean);
    if (errorMsg) setErrorMsg(null);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setErrorMsg('Please enter a valid 6-character room code');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const res = await joinRoom(code);
    if (res.success && res.roomId) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.replace(`/room/${res.roomId}`);
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setErrorMsg(res.error || 'Unable to join room. Verify the code and try again.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        </View>

        {/* Content Card */}
        <View style={styles.contentWrapper}>
          <View style={styles.card}>
            <Text style={styles.title}>Join a Room</Text>
            <Text style={styles.subtitle}>
              Enter the 6-character room code provided by your session operator.
            </Text>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Room Code Input Box */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.codeInput}
                placeholder="ABCXYZ"
                placeholderTextColor={colors.text.muted}
                value={code}
                onChangeText={handleCodeChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                editable={!loading}
                autoFocus
              />
            </View>

            {/* Join Action Button */}
            <Pressable
              onPress={handleJoin}
              disabled={loading || code.length !== 6}
              style={({ pressed }) => [
                styles.joinButton,
                {
                  opacity: loading || code.length !== 6 ? 0.45 : pressed ? 0.88 : 1,
                  backgroundColor: code.length === 6 ? '#34D399' : '#1E293B',
                  borderColor: code.length === 6 ? '#10B981' : '#334155',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join Room"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#090D14" />
              ) : (
                <Text
                  style={[
                    styles.joinButtonText,
                    { color: code.length === 6 ? '#090D14' : colors.text.muted },
                  ]}
                >
                  Join Room
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  codeInput: {
    height: 72,
    borderRadius: 18,
    backgroundColor: '#0A0E17',
    borderWidth: 2,
    borderColor: '#34D399',
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  joinButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
