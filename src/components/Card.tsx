import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/themes';
import { radius, spacing, shadow } from '../theme/tokens';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Latar lebih terang untuk kartu yang di-highlight (mis. pilihan aktif). */
  tone?: 'default' | 'raised' | 'accent';
  padded?: boolean;
};

export default function Card({
  children,
  style,
  tone = 'default',
  padded = true,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        tone === 'raised' && styles.raised,
        tone === 'accent' && styles.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    padded: { padding: spacing.lg },
    raised: { backgroundColor: colors.surfaceAlt },
    accent: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryDim,
    },
  });
