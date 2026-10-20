import { launchImageLibrary } from 'react-native-image-picker';
import { VideoAsset } from '../types/navigation';

// Membuka galeri, biarkan user pilih 1 video, lalu kembalikan info dasarnya.
// react-native-image-picker (Android) memakai system photo picker di Android 13+,
// jadi tidak perlu minta izin galeri secara manual.
export async function pickVideoFromLibrary(): Promise<VideoAsset | null> {
  const result = await launchImageLibrary({
    mediaType: 'video',
    videoQuality: 'high',
  });

  if (result.didCancel || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset.uri) {
    throw new Error('Video yang dipilih tidak punya URI yang valid.');
  }

  // react-native-image-picker mengembalikan duration dalam DETIK.
  const durationSec = asset.duration ?? 0;
  const durationMs = Math.round(durationSec * 1000);

  return {
    uri: asset.uri,
    durationMs,
    fileName: asset.fileName ?? asset.uri.split('/').pop() ?? 'video.mp4',
    source: 'file',
    durationKnown: durationMs > 0,
  };
}
