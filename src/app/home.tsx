import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { colors } from '../theme/colors';

export default function HomeScreen() {
  const { user, profile, signOut } = useAuthStore();
  const { activeRooms, fetchActiveRooms, loading } = useRoomStore();

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  const handleSignOut = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    await signOut();
    router.replace('/login');
  };

  const handleCreatePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push('/create-room');
  };

  const handleJoinPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push('/join-room');
  };

  const handleRejoinRoom = (roomId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push(`/room/${roomId}`);
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Teammate';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchActiveRooms}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Header with User Info & Sign Out */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Primary Actions: Create Room & Join Room */}
        <View style={styles.actionsContainer}>
          {/* Create Room Card */}
          <Pressable
            onPress={handleCreatePress}
            style={({ pressed }) => [
              styles.actionCard,
              {
                borderColor: '#38BDF8',
                backgroundColor: pressed ? '#142234' : colors.panel,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create Room"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Text style={[styles.actionIcon, { color: '#38BDF8' }]}>+</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Create Room</Text>
              <Text style={styles.actionSubtitle}>
                Host a new voting session as operator
              </Text>
            </View>
          </Pressable>

          {/* Join Room Card */}
          <Pressable
            onPress={handleJoinPress}
            style={({ pressed }) => [
              styles.actionCard,
              {
                borderColor: '#34D399',
                backgroundColor: pressed ? '#112520' : colors.panel,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Join Room"
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
              <Text style={[styles.actionIcon, { color: '#34D399' }]}>→</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Join Room</Text>
              <Text style={styles.actionSubtitle}>
                Enter code to vote with your team
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Active Rooms Section */}
        {activeRooms.length > 0 && (
          <View style={styles.activeRoomsSection}>
            <Text style={styles.sectionTitle}>Active Sessions</Text>
            <View style={styles.roomsList}>
              {activeRooms.map((room) => (
                <Pressable
                  key={room.id}
                  onPress={() => handleRejoinRoom(room.id)}
                  style={({ pressed }) => [
                    styles.roomCard,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={styles.roomCardLeft}>
                    <View style={styles.roomCodeBadge}>
                      <Text style={styles.roomCodeText}>{room.room_code}</Text>
                    </View>
                    <View>
                      <Text style={styles.roomQuestionText}>
                        Question {room.current_question_number}
                      </Text>
                      <Text style={styles.roomRoleText}>
                        {room.role === 'operator' ? '👑 Host' : 'Teammate'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rejoinPill}>
                    <Text style={styles.rejoinText}>Rejoin →</Text>
                  </View>
                </Pressable>
              ))}
            </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 8,
  },
  greeting: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  signOutText: {
    color: colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 16,
    marginBottom: 36,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 24,
    fontWeight: '800',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 3,
  },
  activeRoomsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  roomsList: {
    gap: 12,
  },
  roomCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  roomCodeBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  roomCodeText: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  roomQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  roomRoleText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  rejoinPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  rejoinText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
});
