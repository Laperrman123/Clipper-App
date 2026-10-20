import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { radius, spacing, type } from '../theme/tokens';

type Tone = 'primary' | 'accent' | 'muted' | 'success';

type Props = {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primarySoft, fg: colors.primaryBright },
  accent: { bg: 'rgba(255, 107, 157, 0.14)', fg: colors.accent },
  muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
  success: { bg: 'rgba(52, 211, 153, 0.14)', fg: colors.success },
};

export default function Badge({ label, icon, tone = 'primary', style }: Props) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? (
        <Ionicons name={icon} size={12} color={fg} style={styles.icon} />
      ) : null}
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
