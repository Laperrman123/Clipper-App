import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing, type } from '../theme/tokens';

type Props = {
  /** 0-100. */
  percent: number;
  /** Label tahap yang sedang berjalan. */
  label?: string;
  /** Tampilkan angka persen di kanan. */
  showValue?: boolean;
};

export default function ProgressBar({
  percent,
  label,
  showValue = true,
}: Props) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: Math.min(100, Math.max(0, percent)),
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, value]);

  const width = value.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.wrap}>
      {label || showValue ? (
        <View style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {label ?? ''}
          </Text>
          {showValue ? (
            <Text style={styles.value}>{Math.round(percent)}%</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: { ...type.bodyStrong, color: colors.text, flex: 1, marginRight: spacing.md },
  value: { ...type.mono, color: colors.primaryBright },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
