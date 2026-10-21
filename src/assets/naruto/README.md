# Aset Tema "Shinobi" (Naruto-style)

Folder ini berisi aset gambar tema Shinobi. **Semua aset sudah di-generate
secara prosedural dan sudah terpasang di app** — tidak perlu render manual.

Generator (reproducible): `scripts/generate-naruto-assets.ps1`

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate-naruto-assets.ps1
```

Mapping aset ada di `themeAssets.naruto` (`src/theme/themes.ts`) dan otomatis
dipakai lewat `useTheme().assets`. Kalau sebuah aset dihapus/dikosongkan, UI
jatuh ke fallback (ikon vektor / warna solid), jadi app tidak pernah crash.

---

## Daftar aset

| Field | File | Ukuran | Format | Dipakai di |
|---|---|---|---|---|
| `logoMark` | `logo-mark.png` | 512×512 | PNG transparan | Header Home (40×40) + preview pemilih tema di Settings |
| `heroPattern` | `hero-pattern.png` | 1024×768 | PNG | Latar kartu "AI Auto-Clip" |
| `backgroundTexture` | `background-texture.png` | 256×256 seamless | PNG transparan | Latar semua layar (opacity 8%) |
| `launcherIcon` | `launcher-icon.png` | 512×512 | PNG | Ikon launcher Android (legacy + round) |
| `cornerOrnament` | `corner-ornament.png` | 512×512 | PNG transparan | Ornamen sudut kartu hero Home |
| `chakraRing` | `chakra-ring.png` | 512×512 | PNG transparan | Cincin di belakang orb layar analisis AI |
| `emptyState` | `empty-state.png` | 512×512 | PNG transparan | Ilustrasi saat daftar klip kosong |
| `divider` | `divider.png` | 512×96 | PNG transparan | Pemisah di Settings |

Ikon Android sudah ditimpa di `android/app/src/main/res/`:
- `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` → 48/72/96/144/192
- `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_round.png` → 48/72/96/144/192
- `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png` → 108/162/216/324/432
- `values/colors.xml`: `ic_launcher_background`, `splashscreen_background`,
  `colorPrimaryDark` = `#070D0A`; `colorPrimary` = `#F97316`

> Ikon launcher & splash tidak bisa berubah saat runtime. Saat ini build
> memakai ikon Shinobi. Kalau ingin dua ikon berbeda, perlu dua APK terpisah
> (atau ikon netral).

---

## Palet tema

Sumber kebenaran: `narutoTheme` di `src/theme/themes.ts`.

| Peran | Hex |
|---|---|
| Latar | `#070D0A` |
| Latar dalam | `#030705` |
| Permukaan | `#0F1E17` / `#16291F` / `#1F3A2B` |
| Primary (oranye chakra) | `#F97316` |
| Primary bright | `#FFC061` |
| Primary dim | `#A94E0D` |
| Primary muted | `#8A4512` |
| Aksen (merah Uzumaki) | `#DC2626` |
| Teks | `#F7F3E8` |
| Teks muted | `#A9A38C` |
| Teks faint | `#726C5C` |
| Border | `#263B2E` / `#3A5A44` |

**Jangan pakai**: biru dingin, ungu, atau abu netral. Semua harus hangat atau
hijau/oranye.

---

## PROMPT GAMBAR (kalau mau mengganti versi AI-generated)

Gaya bersama — tambahkan di akhir:

> flat vector illustration, dark background, cinematic, premium app UI asset,
> clean vector shapes, subtle grain, no text, no watermark, no signature,
> centered composition, high contrast

> **Catatan legal:** ini gaya *terinspirasi* ninja/desa daun, BUKAN reproduksi
> karakter atau logo resmi berhak cipta. Hindari meniru Naruto, spiral Uzumaki,
> atau headband bertanda persis. Pakai metafora orisinal: daun, pusaran angin
> oranye, shuriken abstrak, siluet ninja.

### 1. `logo-mark.png`

> App icon mark for a video-clipping app: an abstract orange wind vortex
> (concentric swirl) fused with a sharp leaf silhouette, geometric and
> minimal, glowing amber-orange (#F97316) on transparent background,
> single centered symbol, no letters, negative space used to suggest a scissor
> cut, flat vector illustration, premium app UI asset, high contrast, no text,
> no watermark

### 2. `hero-pattern.png`

> Dark cinematic background art for an app hero card: misty Konoha-style
> forest at night, tall tree silhouettes, floating orange chakra embers,
> a faint red spiral of wind in the sky, deep forest-green (#16291F) and
> near-black palette with amber-orange (#F97316) and crimson (#DC2626)
> accents, atmospheric, moody, paintable texture, space in the center for
> overlaid text, no characters, no text, no watermark, landscape 4:3

### 3. `background-texture.png` (seamless)

> Seamless tileable texture pattern: scattered minimal leaf and shuriken
> outlines, thin line art, amber-orange and muted forest-green strokes at low
> opacity on transparent background, subtle ninja-desa motif, uniform density,
> flat vector, seamless edges, no text, no watermark, square 256px

### 4. `launcher-icon.png`

> Android adaptive app icon: bold abstract orange chakra swirl forming the
> shape of a lightning-fast rolling leaf, thick clean strokes, glowing
> amber-orange (#F97316) on deep black-green (#070D0A), full-bleed safe-zone
> centered mark, minimal, memorable, flat vector, no text, no watermark,
> 512x512

---

## Regenerasi / kustomisasi

- Ubah parameter warna & ukuran di blok terkait pada
  `scripts/generate-naruto-assets.ps1`, lalu jalankan ulang script.
- Untuk mematikan aset tertentu, cukup hapus properti terkait dari
  `themeAssets.naruto` (atau ganti file-nya).
- Tema tetap berfungsi 100% tanpa gambar: warna, kartu, badge, dan glow sudah
  bertema Shinobi.
