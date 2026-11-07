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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { signIn, signUp, resetPassword, loading } = useAuthStore();

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async () => {
    setLocalError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (mode !== 'forgot' && (!password || password.length < 6)) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (mode === 'signin') {
      const res = await signIn(email, password);
      if (res.success) {
        router.replace('/home');
      } else {
        setLocalError(res.error || 'Failed to sign in');
      }
    } else if (mode === 'signup') {
      const res = await signUp(email, password, displayName);
      if (res.success) {
        router.replace('/home');
      } else {
        setLocalError(res.error || 'Failed to create account');
      }
    } else if (mode === 'forgot') {
      const res = await resetPassword(email);
      if (res.success) {
        setSuccessMsg('Password reset link sent! Check your inbox.');
      } else {
        setLocalError(res.error || 'Failed to send reset link');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding Header */}
          <View style={styles.brandSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoLetter}>C</Text>
            </View>
            <Text style={styles.brandTitle}>ClueMate</Text>
            <Text style={styles.brandSubtitle}>Team Voting Companion</Text>
          </View>

          {/* Charcoal Card */}
          <View style={styles.authCard}>
            {/* Mode Switcher Tabs */}
            {mode !== 'forgot' && (
              <View style={styles.tabContainer}>
                <Pressable
                  onPress={() => handleModeSwitch('signin')}
                  style={[styles.tab, mode === 'signin' && styles.activeTab]}
                >
                  <Text style={[styles.tabText, mode === 'signin' && styles.activeTabText]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleModeSwitch('signup')}
                  style={[styles.tab, mode === 'signup' && styles.activeTab]}
                >
                  <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>
                    Create Account
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'forgot' && (
              <View style={styles.forgotHeader}>
                <Text style={styles.forgotTitle}>Reset Password</Text>
                <Text style={styles.forgotSubtitle}>
                  Enter your email and we'll send a password recovery link.
                </Text>
              </View>
            )}

            {/* Error & Success Banners */}
            {localError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            )}
            {successMsg && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.fieldsContainer}>
              {mode === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Display Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alex"
                    placeholderTextColor={colors.text.muted}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.text.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {mode !== 'forgot' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.text.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              )}
            </View>

            {/* Forgot Password Link */}
            {mode === 'signin' && (
              <Pressable
                onPress={() => handleModeSwitch('forgot')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </Pressable>
            )}

            {mode === 'forgot' && (
              <Pressable
                onPress={() => handleModeSwitch('signin')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkText}>← Back to Sign In</Text>
              </Pressable>
            )}

            {/* Submit Action Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                { opacity: loading ? 0.6 : pressed ? 0.88 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signin'
                    ? 'Sign In'
                    : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoLetter: {
    fontSize: 26,
    fontWeight: '900',
    color: '#38BDF8',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  authCard: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0E1420',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  activeTabText: {
    color: colors.text.primary,
  },
  forgotHeader: {
    marginBottom: 16,
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  forgotSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '500',
  },
  fieldsContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 14,
    color: colors.text.primary,
    fontSize: 15,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 4,
  },
  forgotLinkText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '500',
  },
  submitButton: {
    height: 50,
    backgroundColor: colors.commitButton.bg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: colors.commitButton.border,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
