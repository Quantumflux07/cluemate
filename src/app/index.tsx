import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

export default function Index() {
  const { session, initialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    if (session) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [session, initialized]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#38BDF8" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
