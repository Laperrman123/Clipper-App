# POTONGIN

Aplikasi pemotong video dengan dua mode:

- **AI Auto-Clip** — tempel link YouTube, Gemini menganalisis transkrip & memilih
  momen paling menarik, lalu memotongnya.
- **Custom Manual** — pilih video dari galeri dan tentukan sendiri bagian mana
  yang mau dipotong.

Aplikasi ini **React Native bare (tanpa Expo)**. Semua modul native dikelola via
autolinking RN CLI.

## Fitur

- Dua tema bawaan: **Shinobi** (default, hijau daun & oranye chakra) dan
  **Neon Purple** — bisa diganti seketika dari Settings tanpa restart.
- Pilih beberapa rasio output: **9:16**, **1:1**, **16:9** (opsional crop ke rasio).
- Manajemen banyak **API key Google AI Studio** (tambah/edit/hapus, pilih yang aktif).
- Salin judul klip hasil analisis ke clipboard dengan sekali ketuk.
- Simpan hasil potongan ke galeri perangkat.
- Notifikasi in-app (toast) saat klip selesai disimpan.

## Stack

| Bagian | Library |
| --- | --- |
| Framework | React Native 0.74.0, React 18.2.0 |
| Navigasi | `@react-navigation/native` + `native-stack` |
| Pemotong video | `ffmpeg-kit-react-native` (fork `@nikhil-cephei/ffmpeg-kit-react-native`, varian full-gpl) |
| Ikon | `react-native-vector-icons` (Ionicons) |
| Galeri | `@react-native-camera-roll/camera-roll`, `react-native-image-picker` |
| Penyimpanan file | `react-native-fs` |
| API key | `react-native-keychain` |
| Clipboard | `@react-native-clipboard/clipboard` |
| AI | Google Gemini API (dipanggil langsung dari app) |

## Prasyarat

- Node.js 18+
- **Android**: JDK 17, Android SDK (platform 34, build-tools 34.0.0), NDK `26.1.10909125`.
- **iOS**: macOS + Xcode + CocoaPods (tidak bisa di-build di Windows).

## Menjalankan (development)

```bash
npm install
npm start            # Metro bundler
```

Di terminal lain:

```bash
npm run android      # build & install ke perangkat/emulator
npm run ios          # khusus macOS
```

## Build Android (release)

`android/app/build.gradle` sudah dikonfigurasi untuk ukuran kecil:

- ABI dibatasi **arm64-v8a** + **armeabi-v7a** saja (x86/x86_64 emulator dibuang).
- `splits.abi` aktif → menghasilkan **satu APK per ABI**.
- ProGuard + `shrinkResources` aktif di build release.

```bash
cd android
.\gradlew.bat :app:assembleRelease       # APK per-ABI -> android/app/build/outputs/apk/release/
.\gradlew.bat :app:bundleRelease          # .aab untuk Play Store -> android/app/build/outputs/bundle/release/
```

Untuk **Play Store pakai `.aab`** — Play memilih ABI sesuai perangkat, jadi ukuran
unduhan user lebih kecil.

### Ganti keystore produksi (wajib sebelum rilis)

`android/app/build.gradle` masih memakai `signingConfigs.debug`. Buat keystore
sendiri dan ganti `signingConfig` pada `buildTypes.release`. Jangan lupa ubah
`applicationId` (`com.yourcompany.clipperapp`) jadi milikmu.

## iOS (di Mac)

Karena config plugin Expo sudah dibuang, hal berikut harus disetel **manual**:

1. Tambah kunci izin di `Info.plist`:
   - `NSPhotoLibraryUsageDescription` — memilih video.
   - `NSPhotoLibraryAddUsageDescription` — menyimpan hasil ke galeri.
2. `cd ios && pod install`
3. Tambahkan font `Ionicons.ttf` ke project Xcode (atau jalankan `npx react-native-asset`
   yang membaca `react-native.config.js`), lalu daftarkan di `UIAppFonts`.

## Struktur folder

```
App.tsx                          # Root: providers + StatusBar + navigasi
index.js                         # Registrasi AppRegistry ("POTONGIN")
src/
  navigation/AppNavigator.tsx    # Definisi semua route
  types/navigation.ts            # Tipe param tiap screen (single source of truth)
  theme/themes.ts                # Palet: Neon Purple & Shinobi (Naruto-style)
  theme/ThemeContext.tsx         # Provider tema + useTheme() (persist ke Keychain)
  theme/tokens.ts                # Spacing, radius, tipografi, glow()
  assets/naruto/                 # Aset gambar tema Shinobi (lihat README di sana)
  utils/time.ts                  # Format waktu MM.SS
  components/                    # Screen, Button, Card, Chip, Badge, Toast, dll.
  screens/
    HomeScreen.tsx               # Pilih mode: AI atau Custom
    SettingsScreen.tsx           # Kelola API key
    ai/                          # ApiKeySetup, AIVideoPicker, AIClipConfig,
                                 # AIAnalyzing, AIResult
    custom/                      # CustomVideoPicker, CustomTrim,
                                 # CustomProcessing, CustomResult
  services/
    apiKeyStore.ts               # Simpan/ambil API key (Keychain)
    useVideoPicker.ts            # Pilih video dari galeri
    geminiService.ts             # Pipeline analisis Gemini
    youtubeTranscript.ts         # Ambil transkrip YouTube
    youtubeSource.ts             # Validasi URL & buat VideoAsset YouTube
    ffmpegService.ts             # Trim + crop/scale via FFmpeg
    galleryService.ts            # Simpan hasil ke galeri
types/                           # Deklarasi tipe tambahan (.d.ts)
```

## Catatan FFmpeg & ukuran

Package resmi `ffmpeg-kit-react-native` dari Arthenica **sudah di-retire** (awal 2025).
Project ini memakai fork yang menerbitkan kembali binary-nya:

```json
"ffmpeg-kit-react-native": "npm:@nikhil-cephei/ffmpeg-kit-react-native@^6.0.12"
```

- Saat `npm install`, `postinstall` fork ini mengunduh `ffmpeg-kit-full-gpl.aar`
  (~57 MB) ke `node_modules/ffmpeg-kit-react-native/android/libs/`. AAR itu berisi
  native lib untuk **semua** ABI — itulah alasan utama ABI dibatasi di Gradle.
- Fork ini **hanya menyediakan varian full-gpl**; varian `min-gpl` tidak tersedia.
  Untuk mencocokkan kebutuhan kita (encode `libx264` + `aac`), full-gpl lebih dari
  cukup, tapi ukurannya paling besar.
- Hasil build release saat ini: **~23 MB per ABI** (arm64 / armv7).

Kalau nanti butuh lebih kecil lagi, opsi yang tersedia adalah mengganti mesin
pemotong ke solusi native platform (Android Media3 Transformer / iOS
`AVAssetExportSession`) sehingga FFmpeg bisa dibuang sepenuhnya.
