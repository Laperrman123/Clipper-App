import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha, type ThemeColors } from '../theme/themes';
import { radius, spacing, type, shadow } from '../theme/tokens';

type Variant = 'success' | 'error' | 'info';

interface ToastOptions {
  title: string;
  message?: string;
  variant?: Variant;
  /** ms; 0 = tidak auto-dismiss. */
  duration?: number;
}

interface CurrentToast extends ToastOptions {
  variant: Variant;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

/** Panggil dari screen mana pun untuk memunculkan notifikasi melayang. */
export const useToast = () => useContext(ToastContext);

const ICON: Record<Variant, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [toast, setToast] = useState<CurrentToast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TONE = useMemo<Record<Variant, string>>(
    () => ({
      success: colors.success,
      error: colors.danger,
      info: colors.primaryBright,
    }),
    [colors]
  );

  const TONE_BG = useMemo<Record<Variant, string>>(
    () => ({
      success: withAlpha(colors.success, 0.16),
      error: withAlpha(colors.danger, 0.16),
      info: colors.primarySoft,
    }),
    [colors]
  );

  const hide = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [anim]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ ...options, variant: options.variant ?? 'success' });
      anim.setValue(0);
      requestAnimationFrame(() => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 90,
        }).start();
      });

      const duration = options.duration ?? 2800;
      if (duration > 0) hideTimer.current = setTimeout(hide, duration);
    },
    [anim, hide]
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, 0],
  });

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={styles.root}>
        {children}
        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.wrap,
              {
                bottom: insets.bottom + spacing.lg,
                transform: [{ translateY }],
                opacity: anim,
              },
            ]}
          >
            <Pressable onPress={hide} style={styles.toast}>
              <View style={styles.accent} />
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: TONE_BG[toast.variant] },
                ]}
              >
                <Ionicons
                  name={ICON[toast.variant]}
                  size={20}
                  color={TONE[toast.variant]}
                />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{toast.title}</Text>
                {toast.message ? (
                  <Text style={styles.message} numberOfLines={2}>
                    {toast.message}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    wrap: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceHi,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingVertical: spacing.md,
      paddingRight: spacing.lg,
      paddingLeft: spacing.md,
      overflow: 'hidden',
      ...shadow.card,
    },
    accent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.primary,
    },
    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1 },
    title: { ...type.bodyStrong, color: colors.text },
    message: { ...type.small, color: colors.textMuted, marginTop: 2 },
  });
