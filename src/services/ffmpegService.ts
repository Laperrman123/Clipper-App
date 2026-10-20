import RNFS from 'react-native-fs';
import { FFmpegKit, FFmpegKitConfig, FFprobeKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { ClipRatio, CustomSegment } from '../types/navigation';

/** Rentang waktu generik — dipakai oleh mode AI maupun mode Custom. */
export interface TimeRange {
  startMs: number;
  endMs: number;
  subjectX?: number;
}

export interface CutOptions {
  ratio?: ClipRatio;
  /**
   * true  (default) = potong saja, resolusi & rasio persis seperti video asli
   * false = crop ke rasio + scale ke resolusi standar (mis. 1080x1920)
   */
  preserveResolution?: boolean;
  onProgress?: (percent: number, message: string) => void;
  signal?: { aborted: boolean };
}

const CLIPS_DIR_NAME = 'clips';

let initPromise: Promise<void> | null = null;

/** FFmpegKit harus di-init sekali sebelum session pertama. */
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = FFmpegKitConfig.init().catch((e) => {
      // Kalau gagal, jangan cache dulu — biar bisa dicoba lagi di panggilan berikutnya.
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

/**
 * Filter crop-to-fill: ambil bagian tengah video, potong ke rasio target
 * tanpa gepeng, lalu scale ke resolusi vertikal/horizontal yang lazim.
 * Pakai iw/ih supaya tidak perlu probing metadata lebih dulu.
 *
 * Hanya dipakai kalau preserveResolution = false. Crop saja sebenarnya juga
 * mengurangi jumlah piksel, jadi default selalu potong bersih tanpa filter.
 */
/**
 * Crop sadar-posisi-subjek.
 *
 * `subjectX` = posisi horizontal pusat orang bicara (0=kiri, 0.5=tengah,
 * 1=kanan). Tanpa ini, crop selalu di tengah — dan untuk talking-head 16:9
 * subjeknya sering di samping, sehingga hasilnya bisa memotong wajah.
 *
 * Rumus offset:
 *   lebar crop  = min(iw, ih * rasio)
 *   x           = clamp(subjectX * iw - lebar/2, 0, iw - lebar)
 *
 * max/min di dalam expression wajib ditulis dengan koma yang di-escape,
 * karena koma di filtergraph berarti pemisah argumen.
 */
function buildFilter(ratio: ClipRatio, subjectX?: number): string {
  const ratioValue = RATIO_VALUE[ratio] ?? 9 / 16;
  const sx = clamp01(subjectX ?? 0.5);

  // Lebar/tinggi crop, ditulis sebagai expression agar ikut menyesuaikan
  // orientasi video sumber (16:9 -> 9:16 dan sebaliknya).
  const w = `min(iw\\,ih*${round4(ratioValue)})`;
  const h = `min(ih\\,iw/${round4(ratioValue)})`;
  const x = `max(0\\,min(${sx}*iw-out_w/2\\,iw-out_w))`;
  const y = 'max(0\\,min((ih-out_h)/2\\,ih-out_h))';

  const crop = `crop='${w}':'${h}':'${x}':'${y}'`;

  switch (ratio) {
    case '1:1':
      return `${crop},scale=1080:1080,setsar=1`;
    case '16:9':
      return `${crop},scale=1920:-2,setsar=1`;
    case '9:16':
    default:
      return `${crop},scale=-2:1920,setsar=1`;
  }
}

const RATIO_VALUE: Record<ClipRatio, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '16:9': 16 / 9,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/** Hindari output seperti 0.5625000000000001 di dalam expression. */
function round4(value: number): number {
  return Number(value.toFixed(4));
}

/** ImagePicker di Android sering memberi content:// — FFmpeg butuh SAF param. */
async function toReadablePath(uri: string): Promise<string> {
  if (/^https?:\/\//i.test(uri)) {
    throw new Error(
      'FFmpeg hanya bisa memotong file lokal. Untuk sumber YouTube, simpan/unduh ' +
        'video ke perangkat dulu lalu pilih lewat menu Galeri.'
    );
  }
  if (uri.startsWith('content://')) {
    return FFmpegKitConfig.getSafParameterForRead(uri);
  }
  return uri.replace(/^file:\/\//, '');
}

/**
 * Cek apakah file sumber benar-benar punya track suara.
 *
 * Tanpa cek ini, video yang diunduh dari YouTube dalam format "video only"
 * dipotong dengan normal — hasilnya clip bisu, dan karena tidak ada error
 * FFmpeg, user tidak pernah tahu penyebabnya.
 *
* Kalau metadata-nya sendiri gagal dibaca (path SAF yang bermasalah, ffprobe
 * tidak bisa buka file), pemeriksaan ini DILEWATI — lebih baik potong dan
 * berhasil daripada menolak memotong file yang sebenarnya bersuara.
 */
async function assertHasAudio(inputPath: string): Promise<void> {
  try {
    const session = await FFprobeKit.getMediaInformation(inputPath);
    const info = await session.getMediaInformation();
    const streams = info?.getStreams?.() ?? [];

    // Tidak ada metadata sama sekali = tidak bisa dipastikan, jangan digagalkan.
    if (!info || streams.length === 0) return;

    const hasAudio = streams.some((s) => {
      try {
        return String(s.getType?.() ?? '').toLowerCase() === 'audio';
      } catch {
        return false;
      }
    });

    if (hasAudio) return;

    throw new Error(
      'File video ini tidak punya track suara, jadi hasil potongannya akan bisu.\n\n' +
        'Kalau videonya dari YouTube, unduh ulang dengan track audio ikut ' +
        '(pilih kualitas combined / "video + audio", bukan "video only").'
    );
  } catch (e) {
    // Error dari ffprobe sendiri (bukan error "tidak ada audio") = lewati.
    if (e instanceof Error && e.message.startsWith('File video ini tidak punya')) {
      throw e;
    }
  }
}

async function ensureOutputDir(): Promise<string> {
  const dir = `${RNFS.DocumentDirectoryPath}/${CLIPS_DIR_NAME}`;
  const exists = await RNFS.exists(dir);
  if (!exists) {
    await RNFS.mkdir(dir);
  }
  return `${dir}/`;
}

/**
 * Potong video jadi beberapa bagian sesuai daftar segmen.
 *
 * Strategi: `-ss` sebelum `-i` supaya seek cepat (tidak decode dari awal),
 * lalu re-encode H.264/AAC supaya batas potong presisi di frame.
 *
 * Secara default TIDAK ada filter video sama sekali — resolusi, rasio, dan
 * orientasi hasilnya identik dengan file asal. Filter crop/scale hanya
 * dipasang kalau preserveResolution=false secara eksplisit.
 */
export async function cutVideoSegments(
  inputUri: string,
  segments: (TimeRange | CustomSegment)[],
  options: CutOptions = {}
): Promise<string[]> {
  if (segments.length === 0) {
    throw new Error('Tidak ada segmen untuk dipotong.');
  }

  const {
    ratio = '9:16',
    preserveResolution = true,
    onProgress,
    signal,
  } = options;

  await ensureInit();

  const inputPath = await toReadablePath(inputUri);
  await assertHasAudio(inputPath);
  const outDir = await ensureOutputDir();

  const outputs: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) throw new Error('Pemotongan dibatalkan.');

    const { startMs, endMs } = segments[i];
    const durationMs = endMs - startMs;

    // Filter dibangun PER SEGEMEN, karena posisi subjek bisa berbeda antar
    // segmen — satu orang bicara di kiri, satu di kanan.
    const segment = segments[i];
    const subjectX = 'subjectX' in segment ? segment.subjectX : undefined;
    const segmentFilter = preserveResolution ? '' : buildFilter(ratio, subjectX);

    if (durationMs <= 0) {
      throw new Error(`Segmen ${i + 1} punya durasi tidak valid.`);
    }

    const safeStartMs = Math.max(0, Math.round(startMs));
    const outputPath = `${outDir}clip_${String(i + 1).padStart(2, '0')}_${safeStartMs}.mp4`;

    onProgress?.(
      Math.round((i / segments.length) * 100),
      `Memotong bagian ${i + 1} dari ${segments.length}...`
    );

    // -ss sebelum -i untuk seek cepat.
    // -t HARUS setelah -i supaya memotong durasi output, bukan membatasi input stream.
    //
    // -map ditulis EKSPLISIT. Tanpa itu FFmpeg memilih stream "terbaik" sendiri,
    // dan pada beberapa file (terutama hasil unduhan YouTube dengan beberapa
    // track audio) yang terpilih bisa track yang kosong — hasil potongannya
    // jadi bisu padahal file aslinya bersuara. Tanda `?` artinya "kalau memang
    // tidak ada audio, jangan gagal".
    const args = [
      '-ss',
      (safeStartMs / 1000).toFixed(3),
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-t',
      (durationMs / 1000).toFixed(3),
    ];

    // Hanya pasang filter kalau memang mengubah rasio/resolusi.
    if (segmentFilter) {
      args.push('-vf', segmentFilter);
    }

    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '48000',
      '-ac',
      '2',
      // Reset ulang timebase audio ke 0. Setelah input-seek, audio kadang
      // mulai dari timebase yang tidak nol, dan di beberapa perangkat itu
      // muncul sebagai suara terputus di awal clip.
      '-af',
      'aresample=async=1:first_pts=0',
      '-movflags',
      '+faststart',
      outputPath
    );

    const session = await FFmpegKit.executeWithArguments(args);

    const returnCode = await session.getReturnCode();
    if (!ReturnCode.isSuccess(returnCode)) {
      const logs = await session.getAllLogsAsString();
      const stackTrace = await session.getFailStackTrace();
      throw new Error(
        `FFmpeg gagal pada bagian ${i + 1}.\n${lastLines(stackTrace || logs, 12)}`
      );
    }

    outputs.push(`file://${outputPath}`);
  }

  onProgress?.(100, 'Selesai');
  return outputs;
}

/** Ambil hanya satu segmen — dipakai tombol "Potong & Simpan" di layar hasil. */
export async function cutSingleSegment(
  inputUri: string,
  range: TimeRange,
  options: CutOptions = {}
): Promise<string> {
  const [out] = await cutVideoSegments(inputUri, [range], options);
  return out;
}

/** Hanya ambil 12 baris terakhir — pesan error FFmpeg bisa sangat panjang. */
function lastLines(text: string, count: number): string {
  const lines = (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(-count).join('\n');
}
