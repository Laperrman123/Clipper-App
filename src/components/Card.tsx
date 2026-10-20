import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
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

const styles = StyleSheet.create({
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
