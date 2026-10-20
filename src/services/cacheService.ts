import RNFS from 'react-native-fs';

/**
 * Cache aplikasi = file yang dibuat aplikasi sendiri dan aman dihapus:
 *
 * 1. `<dokumen>/clips` — hasil potong FFmpeg. Ini file sementara; klip yang
 *    sudah disimpan lewat "Potong & Simpan" sudah DICOPY ke galeri oleh
 *    MediaStore, jadi menghapus folder ini TIDAK menghapus klip di galeri.
 * 2. File sementara `react-native-image-picker` di folder cache. Muncul saat
 *    user memilih video dari galeri di perangkat yang menyalin file dulu.
 *
 * Video asli milik user dan folder galeri tidak pernah disentuh.
 */
const CLIPS_DIR = `${RNFS.DocumentDirectoryPath}/clips`;
const PICKER_TEMP_PREFIX = 'rn_image_picker';

export interface CacheInfo {
  fileCount: number;
  totalBytes: number;
}

interface CacheFile {
  path: string;
  size: number;
}

async function collectFiles(): Promise<CacheFile[]> {
  const files: CacheFile[] = [];

  // Hasil potong FFmpeg.
  try {
    if (await RNFS.exists(CLIPS_DIR)) {
      const entries = await RNFS.readDir(CLIPS_DIR);
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push({ path: entry.path, size: Number(entry.size) || 0 });
        }
      }
    }
  } catch {
    // Folder belum ada / tidak bisa dibaca: anggap kosong.
  }

  // Salinan sementara dari image picker.
  try {
    const entries = await RNFS.readDir(RNFS.CachesDirectoryPath);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith(PICKER_TEMP_PREFIX)) {
        files.push({ path: entry.path, size: Number(entry.size) || 0 });
      }
    }
  } catch {
    // Cache dir tidak terbaca: lewati.
  }

  return files;
}

function toInfo(files: CacheFile[]): CacheInfo {
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.size, 0),
  };
}

/** Hitung isi cache tanpa menghapus apa pun — dipakai untuk isi dialog konfirmasi. */
export async function getCacheInfo(): Promise<CacheInfo> {
  return toInfo(await collectFiles());
}

/**
 * Hapus semua file cache. Mengembalikan jumlah/ukuran yang BENAR-BENAR
 * terhapus (file yang gagal dihapus tidak ikut dihitung).
 */
export async function clearAppCache(): Promise<CacheInfo> {
  const files = await collectFiles();
  let fileCount = 0;
  let totalBytes = 0;

  for (const file of files) {
    try {
      await RNFS.unlink(file.path);
      fileCount += 1;
      totalBytes += file.size;
    } catch {
      // File sedang dipakai / sudah hilang: lanjut ke file berikutnya.
    }
  }

  return { fileCount, totalBytes };
}

/** Format byte menjadi "12 MB" / "820 KB" untuk ditampilkan di dialog. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, index);

  return `${index === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
