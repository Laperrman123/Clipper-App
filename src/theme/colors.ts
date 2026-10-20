// Palet "dark-first + electric purple".
//
// Latar memakai near-black ber-tint ungu (bukan #000) supaya thumbnail video
// dan preview klip terasa lebih "menyala" di atasnya. Ungu listrik jadi satu-
// satunya warna identitas; satu aksen hangat (pink) dipakai khusus untuk skor
// viral supaya kontrasnya terasa, bukan untuk branding.
export const colors = {
  // --- Latar ---
  background: '#0A0910',
  backgroundDeep: '#060509',
  surface: '#151320',
  surfaceAlt: '#1D1A2C',
  surfaceHi: '#272238',

  // --- Identitas electric purple ---
  primary: '#8B5CF6',
  primaryBright: '#B49BFF',
  primaryDim: '#5B3FBF',
  primaryMuted: '#4E3BA8',
  /** Latar lembut ber-ungu untuk tombol sekunder / highlight. */
  primarySoft: '#241C3D',
  onPrimary: '#FFFFFF',

  // --- Aksen hangat (hanya untuk skor viral) ---
  accent: '#FF6B9D',

  // --- Teks ---
  text: '#F4F3FB',
  textMuted: '#9C99B4',
  textFaint: '#6E6B85',

  // --- Garis ---
  border: '#272336',
  borderStrong: '#3A3353',

  // --- Status ---
  success: '#34D399',
  danger: '#F87171',

  // --- Glow ungu untuk bayangan berwarna ---
  glow: 'rgba(139, 92, 246, 0.45)',
  glowSoft: 'rgba(139, 92, 246, 0.16)',
  scrim: 'rgba(6, 5, 9, 0.72)',
};
