import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/tokens';

/**
 * Cahaya ambient di belakang konten. Bukan gambar — cuma dua bidang ungu
 * transparan ber-blur lembut supaya layar terasa punya kedalaman, bukan flat.
 */
function AmbientGlow() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
    </View>
  );
}

type Props = {
  children: React.ReactNode;
  /** true kalau konten bisa lebih panjang dari layar. */
  scroll?: boolean;
  /** Padding horizontal + bawah standar (16). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Dipakai FlatList dsb. yang butuh style container sendiri. */
  bare?: boolean;
};

export default function Screen({
  children,
  scroll = false,
  padded = true,
  bare = false,
  style,
  contentContainerStyle,
}: Props) {
  const padding = padded ? { paddingHorizontal: spacing.lg } : null;

  return (
    <View style={[styles.root, style]}>
      <AmbientGlow />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            padding,
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : bare ? (
        children
      ) : (
        <View style={[styles.flex, padding]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.huge },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  glowTop: {
    top: -140,
    right: -120,
    width: 320,
    height: 320,
    backgroundColor: colors.glowSoft,
  },
  glowBottom: {
    bottom: -180,
    left: -140,
    width: 380,
    height: 380,
    backgroundColor: 'rgba(139, 92, 246, 0.07)',
  },
});
