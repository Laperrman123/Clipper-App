import type { TextStyle, ViewStyle } from 'react-native';

/** Skala jarak — pakai ini alih-alih angka ajaib supaya ritme vertikal konsisten. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
};

/** Radius. Inner element lebih rapat, container lebih lembut. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

/**
 * Skala tipe. Warna TIDAK di-bake di sini — pemanggil yang menempelkan
 * `colors.text` / `colors.textMuted` sesuai hierarki.
 */
export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34 },
  h1: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, lineHeight: 27 },
  h2: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  small: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  /** Angka/teknis: pakai tabular figures supaya tidak goyang saat berubah. */
  mono: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

/** Bayangan ter-tint. Satu arah cahaya: dari bawah. */
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  } as ViewStyle,
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  } as ViewStyle,
};

/**
 * Glow berwarna yang mengikuti tema. Terima `colors.primary` supaya bayangannya
 * ikut berganti saat tema berubah — nilai warna tidak boleh di-bake di modul.
 */
export function glow(color: string, opacity = 0.5): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  };
}
