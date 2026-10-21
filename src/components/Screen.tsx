import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Image,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/themes';
import { spacing } from '../theme/tokens';

type Styles = ReturnType<typeof createStyles>;

/**
 * Cahaya ambient di belakang konten. Bukan gambar — cuma dua bidang transparan
 * ber-blur lembut supaya layar terasa punya kedalaman, bukan flat.
 */
function AmbientGlow({ styles }: { styles: Styles }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
    </View>
  );
}

/**
 * Tekstur latar opsional dari tema (mis. pola daun Konoha). Dipasang di atas
 * warna latar dengan opacity rendah supaya tidak mengganggu keterbacaan.
 */
function BackgroundTexture() {
  const { assets } = useTheme();
  if (!assets.backgroundTexture) return null;
  return (
    <Image
      source={assets.backgroundTexture}
      style={[StyleSheet.absoluteFill, textureStyle]}
      resizeMode="repeat"
    />
  );
}

const textureStyle = StyleSheet.create({ texture: { opacity: 0.08 } }).texture;

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const padding = padded ? { paddingHorizontal: spacing.lg } : null;

  return (
    <View style={[styles.root, style]}>
      <BackgroundTexture />
      <AmbientGlow styles={styles} />
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      backgroundColor: colors.glowSoft,
      opacity: 0.45,
    },
  });
