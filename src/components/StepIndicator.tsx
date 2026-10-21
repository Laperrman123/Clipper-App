import React, { useMemo } from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/themes';
import { radius, spacing, type } from '../theme/tokens';

type Props = {
  steps: string[];
  /** Index langkah aktif (0-based). Langkah sebelumnya dianggap selesai. */
  current: number;
  style?: any;
};

const NODE = 28;

export default function StepIndicator({ steps, current, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const half = `${50 / steps.length}%` as DimensionValue;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.line, { left: half, right: half }]} />
      <View style={styles.row}>
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <View key={label} style={styles.step}>
              <View
                style={[
                  styles.node,
                  done && styles.nodeDone,
                  active && styles.nodeActive,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                ) : (
                  <Text
                    style={[styles.nodeText, active && styles.nodeTextActive]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  (active || done) && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { width: '100%', paddingVertical: spacing.xs },
    line: {
      position: 'absolute',
      top: NODE / 2 - 1,
      height: 2,
      backgroundColor: colors.border,
    },
    row: { flexDirection: 'row' },
    step: { flex: 1, alignItems: 'center' },
    node: {
      width: NODE,
      height: NODE,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nodeDone: { backgroundColor: colors.primaryDim, borderColor: colors.primaryDim },
    nodeActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.55,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    nodeText: { ...type.mono, color: colors.textMuted },
    nodeTextActive: { color: colors.onPrimary },
    label: { ...type.small, color: colors.textFaint, marginTop: spacing.sm, fontSize: 11 },
    labelActive: { color: colors.text },
  });
