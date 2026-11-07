import React from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { OptionKey } from '../types/voting';
import { colors } from '../theme/colors';

interface OptionCardProps {
  optionKey: OptionKey;
  label: string;
  percentage: number;
  onPress: (key: OptionKey) => void;
  disabled?: boolean;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  optionKey,
  label,
  percentage,
  onPress,
  disabled = false,
}) => {
  const config = colors.options[optionKey];
  const isSelected = percentage > 0;

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress(optionKey);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isSelected ? config.bgActive : config.bgIdle,
          borderColor: isSelected ? config.borderActive : config.borderIdle,
          opacity: disabled ? 0.35 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Option ${label}, ${percentage} percent allocated`}
    >
      {/* Background Progress Fill Bar */}
      {percentage > 0 && (
        <View
          style={[
            styles.fillBar,
            {
              width: `${percentage}%`,
              backgroundColor: config.barFill,
            },
          ]}
        />
      )}

      {/* Content Row */}
      <View style={styles.contentRow}>
        <View style={styles.leftSection}>
          <View
            style={[
              styles.letterBadge,
              {
                backgroundColor: isSelected ? config.accent : 'rgba(255, 255, 255, 0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.letterText,
                {
                  color: isSelected ? '#090D14' : config.accent,
                },
              ]}
            >
              {label}
            </Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <Text
            style={[
              styles.percentageText,
              {
                color: isSelected ? config.accent : colors.text.muted,
                fontWeight: isSelected ? '700' : '500',
              },
            ]}
          >
            {percentage}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 68,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fillBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letterBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 19,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  percentageText: {
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
});
