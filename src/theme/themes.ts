// Tema aplikasi:
//  - "purple": tema lama, dark + electric purple (default).
//  - "naruto": tema desa Daun, hijau shinobi + oranye chakra + aksen merah.
//
// Semua warna yang dipakai UI didefinisikan di sini. Komponen TIDAK boleh
// meng-hardcode warna supaya bisa diganti saat runtime lewat ThemeContext.

import type { ImageSourcePropType } from 'react-native';

// --- Aset tema Shinobi (dibuat oleh scripts/generate-naruto-assets.ps1) ---
import narutoLogoMark from '../assets/naruto/logo-mark.png';
import narutoHeroPattern from '../assets/naruto/hero-pattern.png';
import narutoBackgroundTexture from '../assets/naruto/background-texture.png';
import narutoLauncherIcon from '../assets/naruto/launcher-icon.png';
import narutoCornerOrnament from '../assets/naruto/corner-ornament.png';
import narutoChakraRing from '../assets/naruto/chakra-ring.png';
import narutoEmptyState from '../assets/naruto/empty-state.png';
import narutoDivider from '../assets/naruto/divider.png';

/**
 * Kontrak warna. Bentuknya dikunci supaya semua tema dijamin punya key yang
 * sama — kalau ada yang kurang, TypeScript langsung marah.
 */
export interface ThemeColors {
  // --- Latar ---
  background: string;
  backgroundDeep: string;
  surface: string;
  surfaceAlt: string;
  surfaceHi: string;

  // --- Identitas ---
  primary: string;
  primaryBright: string;
  primaryDim: string;
  primaryMuted: string;
  /** Latar lembut untuk tombol sekunder / highlight. */
  primarySoft: string;
  onPrimary: string;

  // --- Aksen hangat (skor viral) ---
  accent: string;
  /** Latar lembut untuk aksen (badge merah). */
  accentSoft: string;
  /** Warna di atas aksen (mis. teks di badge). */
  onAccent: string;

  // --- Teks ---
  text: string;
  textMuted: string;
  textFaint: string;

  // --- Garis ---
  border: string;
  borderStrong: string;

  // --- Status ---
  success: string;
  danger: string;

  // --- Glow / bayangan berwarna ---
  glow: string;
  glowSoft: string;
  scrim: string;
}

/**
 * Slot aset gambar per tema. Semua opsional: kalau kosong, UI fallback ke ikon
 * vektor / warna solid, jadi app tetap jalan tanpa gambar.
 */
export interface ThemeAssets {
  /** Logo kotak di header Home (1:1, transparan). */
  logoMark?: ImageSourcePropType;
  /** Latar kartu hero "AI Auto-Clip". */
  heroPattern?: ImageSourcePropType;
  /** Tekstur latar penuh layar (opacity rendah). */
  backgroundTexture?: ImageSourcePropType;
  /** Ikon launcher untuk build terpisah. */
  launcherIcon?: ImageSourcePropType;
  /** Ornamen daun di sudut kartu. */
  cornerOrnament?: ImageSourcePropType;
  /** Cincin chakra di belakang orb analisis. */
  chakraRing?: ImageSourcePropType;
  /** Ilustrasi kondisi kosong. */
  emptyState?: ImageSourcePropType;
  /** Garis pemisah dengan motif daun. */
  divider?: ImageSourcePropType;
}

export type ThemeKey = 'purple' | 'naruto';

/** Palet lama: dark-first + electric purple. */
export const purpleTheme: ThemeColors = {
  background: '#0A0910',
  backgroundDeep: '#060509',
  surface: '#151320',
  surfaceAlt: '#1D1A2C',
  surfaceHi: '#272238',

  primary: '#8B5CF6',
  primaryBright: '#B49BFF',
  primaryDim: '#5B3FBF',
  primaryMuted: '#4E3BA8',
  primarySoft: '#241C3D',
  onPrimary: '#FFFFFF',

  accent: '#FF6B9D',
  accentSoft: '#3A1B2A',
  onAccent: '#1A0A12',

  text: '#F4F3FB',
  textMuted: '#9C99B4',
  textFaint: '#6E6B85',

  border: '#272336',
  borderStrong: '#3A3353',

  success: '#34D399',
  danger: '#F87171',

  glow: 'rgba(139, 92, 246, 0.45)',
  glowSoft: 'rgba(139, 92, 246, 0.16)',
  scrim: 'rgba(6, 5, 9, 0.72)',
};

/**
 * Tema Konoha: hijau shinobi gelap, oranye chakra seperti jumpsuit Naruto,
 * aksen merah lambang Uzumaki. Netral hangat, bukan abu dingin.
 */
export const narutoTheme: ThemeColors = {
  background: '#070D0A',
  backgroundDeep: '#030705',
  surface: '#0F1E17',
  surfaceAlt: '#16291F',
  surfaceHi: '#1F3A2B',

  primary: '#F97316',
  primaryBright: '#FFC061',
  primaryDim: '#A94E0D',
  primaryMuted: '#8A4512',
  primarySoft: '#241A0F',
  onPrimary: '#180E02',

  accent: '#DC2626',
  accentSoft: '#3A1512',
  onAccent: '#FFF3E0',

  text: '#F7F3E8',
  textMuted: '#A9A38C',
  textFaint: '#726C5C',

  border: '#263B2E',
  borderStrong: '#3A5A44',

  success: '#3FBF6F',
  danger: '#E5544B',

  glow: 'rgba(249, 115, 22, 0.45)',
  glowSoft: 'rgba(220, 38, 38, 0.16)',
  scrim: 'rgba(3, 7, 5, 0.74)',
};

export const themes: Record<ThemeKey, ThemeColors> = {
  purple: purpleTheme,
  naruto: narutoTheme,
};

/** Aset gambar per tema. */
export const themeAssets: Record<ThemeKey, ThemeAssets> = {
  purple: {},
  naruto: {
    logoMark: narutoLogoMark,
    heroPattern: narutoHeroPattern,
    backgroundTexture: narutoBackgroundTexture,
    launcherIcon: narutoLauncherIcon,
    cornerOrnament: narutoCornerOrnament,
    chakraRing: narutoChakraRing,
    emptyState: narutoEmptyState,
    divider: narutoDivider,
  },
};

/** Metadata tema untuk UI pemilih & branding. */
export const themeMeta: Record<
  ThemeKey,
  { label: string; tagline: string; appName: string }
> = {
  purple: {
    label: 'Neon Purple',
    tagline: 'Dark & electric',
    appName: 'POTONGIN',
  },
  naruto: {
    label: 'Shinobi',
    tagline: 'Hijau daun & oranye chakra',
    appName: 'POTONGIN',
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = 'naruto';

export function isThemeKey(value: unknown): value is ThemeKey {
  return value === 'purple' || value === 'naruto';
}

/**
 * Ubah warna `#RRGGBB` jadi `rgba(...)` dengan alpha tertentu — dipakai untuk
 * latar badge/toast yang perlu versi transparan dari warna tema.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
