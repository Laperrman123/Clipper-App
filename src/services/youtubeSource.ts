import { VideoAsset } from '../types/navigation';

const YT_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/|live\/)|youtu\.be\/)[\w-]+/i;

export function isValidYouTubeUrl(raw: string): boolean {
  return YT_PATTERN.test(raw.trim());
}

/**
 * Bikin VideoAsset dari URL YouTube. Durasi belum diketahui di tahap ini —
 * Gemini yang menganalisis videonya, jadi kita biarkan durasi tidak diketahui
 * dan memvalidasi batas segmen nanti (lihat finalize() di geminiService).
 */
export function makeYouTubeAsset(raw: string): VideoAsset {
  const uri = raw.trim();
  if (!isValidYouTubeUrl(uri)) {
    throw new Error(
      'URL YouTube tidak valid. Contoh yang benar:\nhttps://www.youtube.com/watch?v=xxxx'
    );
  }

  let fileName = 'youtube';
  try {
    const id = uri.includes('youtu.be/')
      ? uri.split('youtu.be/')[1]
      : new URL(uri).searchParams.get('v');
    if (id) fileName = `youtube_${id}`;
  } catch {
    // URL tidak bisa di-parse — nama file fallback sudah cukup.
  }

  return { uri, durationMs: 0, fileName, source: 'youtube', durationKnown: false };
}
