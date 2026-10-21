import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/themes';
import { radius, spacing, type } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  /** Nama ikon Ionicons, mis. "sparkles" atau "download-outline". */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const off = disabled || loading;
  const fg = variant === 'primary' ? colors.onPrimary : colors.primaryBright;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        variant === 'primary' && !off && styles.primaryGlow,
        off && styles.disabled,
        pressed && !off && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color={fg} style={styles.icon} />
          ) : null}
          <Text style={[styles.label, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      minHeight: 54,
    },
    primary: { backgroundColor: colors.primary },
    secondary: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryDim,
    },
    ghost: { backgroundColor: 'transparent', minHeight: 44 },
    primaryGlow: {
      shadowColor: colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
    icon: { marginRight: spacing.sm },
    label: { ...type.h2, letterSpacing: 0 },
  });
