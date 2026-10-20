import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Simpan file clip hasil potong ke galeri device lewat CameraRoll.
 *
 * Di Android 10+ (API 29+) penyimpanan lewat MediaStore tidak butuh izin
 * eksplisit, jadi permintaan izin hanya dilakukan di versi lama.
 *
 * Input boleh berupa path biasa atau file:// URI; CameraRoll butuh file://.
 */
async function ensureSavePermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (Number(Platform.Version) >= 29) return;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
  );
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error(
      'Izin akses galeri ditolak. Aktifkan di Pengaturan aplikasi lalu coba lagi.'
    );
  }
}

export async function saveClipToGallery(fileUri: string): Promise<void> {
  await ensureSavePermission();

  const normalized = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;

  await CameraRoll.save(normalized, { type: 'video' });
}

/** Simpan banyak clip sekaligus; kembalikan jumlah berhasil vs gagal. */
export async function saveClipsToGallery(
  fileUris: string[]
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;

  for (const uri of fileUris) {
    try {
      await saveClipToGallery(uri);
      saved += 1;
    } catch {
      failed += 1;
    }
  }

  return { saved, failed };
}
