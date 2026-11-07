import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Platform,
  LayoutChangeEvent,
  Pressable,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { OptionKey } from '../types/voting';
import { colors } from '../theme/colors';

interface LeaderboardOptionRowProps {
  optionKey: OptionKey;
  label: string;
  percentage: number;
  isLeader: boolean;
  accentColor: string;
  // When provided, the row becomes a tappable voting option card
  onPress?: (key: OptionKey) => void;
  disabled?: boolean;
  // When rendering as a voting card, show draft fill bar
  showFillBar?: boolean;
}

export const LeaderboardOptionRow: React.FC<LeaderboardOptionRowProps> = ({
  optionKey,
  label,
  percentage,
  isLeader,
  accentColor,
  onPress,
  disabled = false,
  showFillBar = false,
}) => {
  const [layout, setLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 68,
  });
  const [dashOffset, setDashOffset] = useState(0);

  const fadeAnim = useRef(new Animated.Value(isLeader ? 1 : 0)).current;

  // Smooth fade-in/out when leader changes
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isLeader ? 1 : 0,
      duration: 400,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isLeader, fadeAnim]);

  // Rotating dotted border animation
  useEffect(() => {
    if (!isLeader) {
      setDashOffset(0);
      return;
    }
    let animId: number;
    let currentOffset = 0;
    const step = () => {
      currentOffset = (currentOffset + 0.5) % 1200;
      setDashOffset(currentOffset);
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isLeader]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress(optionKey);
  };

  const isSelected = percentage > 0;
  const optionColors = colors.options[optionKey];

  const inner = (
    <View
      style={[
        styles.cardInner,
        {
          backgroundColor: showFillBar
            ? (isSelected ? optionColors.bgActive : optionColors.bgIdle)
            : (isLeader ? 'rgba(18, 25, 38, 0.95)' : '#101622'),
          borderColor: isLeader
            ? 'transparent'
            : showFillBar
              ? (isSelected ? optionColors.borderActive : optionColors.borderIdle)
              : '#1E293B',
        },
      ]}
    >
      {/* Background fill bar (only for voting card mode) */}
      {showFillBar && percentage > 0 && (
        <View
          style={[
            styles.fillBar,
            {
              width: `${percentage}%`,
              backgroundColor: optionColors.barFill,
            },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles.contentRow}>
        <View style={styles.leftSection}>
          <View
            style={[
              styles.letterBadge,
              {
                backgroundColor: showFillBar
                  ? (isSelected ? accentColor : 'rgba(255,255,255,0.08)')
                  : accentColor,
              },
            ]}
          >
            <Text
              style={[
                styles.letterText,
                { color: showFillBar && isSelected ? '#090D14' : showFillBar ? accentColor : '#090D14' },
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
                color: isSelected ? accentColor : colors.text.muted,
                fontWeight: isSelected ? '700' : '500',
              },
            ]}
          >
            {percentage}%
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {/* Rotating dotted border glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowBorderContainer,
          { opacity: fadeAnim, shadowColor: accentColor },
        ]}
      >
        {layout.width > 0 && layout.height > 0 && (
          <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
            <Rect
              x="1.5"
              y="1.5"
              width={layout.width - 3}
              height={layout.height - 3}
              rx="18"
              ry="18"
              fill="none"
              stroke={accentColor}
              strokeWidth="2.5"
              strokeDasharray="6, 6"
              strokeDashoffset={-dashOffset}
            />
          </Svg>
        )}
      </Animated.View>

      {onPress ? (
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.pressableWrapper,
            {
              opacity: disabled ? 0.35 : pressed ? 0.88 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Option ${label}, ${percentage} percent allocated`}
        >
          {inner}
        </Pressable>
      ) : (
        inner
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: 12,
  },
  glowBorderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2,
  },
  pressableWrapper: {
    width: '100%',
  },
  cardInner: {
    width: '100%',
    height: 68,
    borderRadius: 20,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    zIndex: 1,
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
