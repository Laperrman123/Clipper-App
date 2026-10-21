import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha, type ThemeColors } from '../theme/themes';
import { radius, spacing, type } from '../theme/tokens';

type Tone = 'primary' | 'accent' | 'muted' | 'success';

type Props = {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export default function Badge({ label, icon, tone = 'primary', style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tones: Record<Tone, { bg: string; fg: string }> = {
    primary: { bg: colors.primarySoft, fg: colors.primaryBright },
    accent: { bg: withAlpha(colors.accent, 0.16), fg: colors.accent },
    muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
    success: { bg: withAlpha(colors.success, 0.16), fg: colors.success },
  };
  const { bg, fg } = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? (
        <Ionicons name={icon} size={12} color={fg} style={styles.icon} />
      ) : null}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    icon: { marginRight: 5 },
    text: { ...type.label, fontSize: 10, letterSpacing: 0.8 },
  });
