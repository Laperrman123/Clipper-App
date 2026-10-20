import {
  AISegment,
  AnalysisProgress,
  ClipRatio,
  VideoAsset,
} from '../types/navigation';
import {
  fetchYouTubeTranscript,
  TranscriptSegment,
} from './youtubeTranscript';

/**
 * Rantai fallback model. Yang pertama = pilihan utama.
 *
 * Dipakai karena ketersediaan model berbeda-beda per API key (khususnya
 * free tier vs paid) dan tidak semua model punya akses video input.
 * Model yang berhasil dipakai di-cache supaya request berikutnya langsung ke
 * model itu tanpa mencoba-coba lagi.
 */
const MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
] as const;

/** Model terakhir yang sukses, supaya request berikutnya tidak menebak lagi. */
let cachedModel: string | null = null;

/**
 * Dimatikan otomatis kalau sebuah model menolak mediaResolution dengan 400.
 * Tidak semua model mendukungnya, dan kita lebih suka kehilangan penghematan
 * token daripada gagal total.
 */
let mediaResolutionSupported = true;

/**
 * Dimatikan kalau server menolak metadata.videoMetadata pada bagian video.
 * Field ini dipakai untuk mengirim hanya jendela waktu tertentu (biar hemat
 * token dan framing lebih akurat). Kalau tidak didukung, jatah ke video penuh.
 */
let videoWindowSupported = true;

/**
 * Dimatikan kalau model menolak thinkingLevel.
 *
 * Penting: Gemini 3 secara default memakai thinking level "high". Token
 * thinking dihitung sebagai bagian dari maxOutputTokens, jadi untuk video
 * panjang, thinking bisa memakan seluruh jatah dan JSON hasilnya jadi kepotong
 * di tengah — yang muncul sebagai "jawaban bukan JSON yang valid".
 * Semua tahap di sini lowered ke "low" karena tugasnya persepsi/seleksi,
 * bukan penalaran berat.
 */
let thinkingLevelSupported = true;

/** Model yang diprioritaskan kalau daftar fallback perlu dicoba satu per satu. */
function modelCandidates(): string[] {
  if (!cachedModel) return [...MODEL_FALLBACKS];
  return [cachedModel, ...MODEL_FALLBACKS.filter((m) => m !== cachedModel)];
}

/**
 * Kode yang artinya "coba model berikutnya".
 *
 * 404 = model tidak ada
 * 403 = key ini tidak punya akses ke model itu
 * 429 = rate/quota limit model ini habis.
 * 503 = service overloaded / high demand.
 * 500 dengan pesan overload juga dicoba ke model berikutnya.
 *
 * 400 sengaja TIDAK memicu fallback: itu masalah request/schema, dan mencoba
 * semua model hanya akan menyembunyikan pesan error aslinya.
 */
function shouldTryNextModel(status: number, raw = ''): boolean {
  if (status === 404 || status === 403 || status === 429 || status === 503) return true;
  if (status !== 500) return false;
  return /high demand|overload|overloaded|temporarily unavailable|unavailable/i.test(raw);
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Batas durasi satu klip. Di luar ini bukan "momen" lagi, tapi potongan video. */
const MIN_CLIP_MS = 30_000;
const MAX_CLIP_MS = 120_000;

/**
 * Seberapa jauh batas clip boleh digeser saat verifikasi audio.
 *
 * Cutatan dari transkrip biasanya sudah dalam ±5-10 detik, jadi 8 detik cukup
 * untuk mengoreksinya tanpa risiko model menyeret clip ke tempat lain.
 * Versi lama memakai 20 detik — terlalu longgar, sehingga jawaban model yang
 * salah baca masih diterima dan klip bisa bergeser sampai 20 detik.
 */
const SNAP_PADDING_MS = 8_000;

/** Batas ukuran chunk transkrip: cukup pendek untuk clip pendek, cukup panjang untuk konteks. */
const CHUNK_MAX_MS = 45_000;
const CHUNK_MIN_MS = 15_000;
/**
 * Batas keras. Kalau subtitle tidak punya tanda baca sama sekali (umum pada
 * ASR), chunk tetap harus ditutup di sini supaya tidak membengkak.
 */
const CHUNK_HARD_MAX_MS = 60_000;

/** Jeda antar kalimat di atas ini dianggap pergantian topik. */
const GAP_MS = 2_500;

/**
 * Transkrip panjang bisa kena batas output token. Kalau terpangkas, kita
 * minta Gemini melanjutkan dari titik terpotong — maksimal beberapa ronde.
 */
const MAX_TRANSCRIPT_ROUNDS = 3;

export interface AnalyzeParams {
  apiKey: string;
  video: VideoAsset;
  parts: number;
  ratio: ClipRatio;
  /** Instruksi bebas dari user. Kalau kosong, model memakai arahan netral. */
  customPrompt?: string;
  /** true = hasil akhir akan di-crop ke rasio, jadi framing ikut dihitung. */
  changeRatio?: boolean;
}

export interface AnalyzeOptions {
  onProgress?: (progress: AnalysisProgress) => void;
  signal?: { aborted: boolean };
  /** Dipanggil saat chain pindah model karena rate limit / tidak tersedia. */
  onFallback?: (message: string) => void;
}

export interface AnalysisResult {
  segments: AISegment[];
  /**
   * Durasi video hasil pembacaan Gemini (ms). Untuk sumber YouTube ini
   * baru diketahui setelah analisis, dipakai untuk clamp batas segmen.
   */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Skema output terstruktur
//
// Catatan penting: waktu SELALU diminta sebagai string "MM:SS", bukan angka
// milidetik. Gemini hanya punya cap waktu per detik di konteksnya, jadi
// meminta presisi milidetik justru mendorong model mengarang angka.
// Format MM:SS juga menghapus satu sumber error lama: tebakan detik-vs-milidetik.
// ---------------------------------------------------------------------------

const TRANSCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    durationSec: {
      type: 'integer',
      description: 'Durasi total video dalam detik bulat, sesuai panjang video.',
    },
    hasSpeech: {
      type: 'boolean',
      description: 'true kalau ada ucapan manusia yang terdengar di video.',
    },
    chunks: {
      type: 'array',
      description: 'Transkrip verbatim, berurutan dari detik 0 sampai video habis.',
      items: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Mulai chunk, format MM:SS' },
          end: { type: 'string', description: 'Akhir chunk, format MM:SS' },
          text: {
            type: 'string',
            description: 'Ucapan verbatim di chunk ini, maksimal 400 karakter.',
          },
        },
        required: ['start', 'end', 'text'],
        propertyOrdering: ['start', 'end', 'text'],
      },
    },
  },
  required: ['durationSec', 'hasSpeech', 'chunks'],
  propertyOrdering: ['durationSec', 'hasSpeech', 'chunks'],
} as const;

const SELECTION_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      description: 'Satu entri per momen yang dipilih.',
      items: {
        type: 'object',
        properties: {
          chunkIndexes: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Nomor chunk (1-based) yang membentuk momen ini, urut naik dan bersambung.',
          },
          title: { type: 'string', description: 'Label singkat momen, maksimal 60 karakter' },
          reason: {
            type: 'string',
            description: 'Alasan singkat kenapa momen ini menarik, maksimal 200 karakter',
          },
          viralScore: { type: 'integer', description: 'Skor daya tarik 0-100' },
        },
        required: ['chunkIndexes', 'title', 'reason', 'viralScore'],
        propertyOrdering: ['chunkIndexes', 'title', 'reason', 'viralScore'],
      },
    },
  },
  required: ['picks'],
} as const;

/**
 * Tahap deskripsi — dijalankan setelah rentang waktu FINAL sudah ditetapkan
 * kode, supaya title/reason/quote pasti menggambarkan isi clip yang benar-benar
 * dipotong, bukan rentang sebelum dipangkas.
 */
const DESCRIBE_SCHEMA = {
  type: 'object',
  properties: {
    descriptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Nomor potongan, sama seperti di prompt' },
          title: { type: 'string', description: 'Judul clip, maksimal 60 karakter' },
          reason: {
            type: 'string',
            description: 'Kenapa potongan ini menarik, maksimal 200 karakter',
          },
          quote: {
            type: 'string',
            description:
              'Kalimat PERSIS dari teks yang terdengar di detik pertama potongan, ' +
              'maksimal 120 karakter.',
          },
          viralScore: { type: 'integer', description: 'Skor daya tarik 0-100' },
        },
        required: ['index', 'title', 'reason', 'quote', 'viralScore'],
        propertyOrdering: ['index', 'title', 'reason', 'quote', 'viralScore'],
      },
    },
  },
  required: ['descriptions'],
} as const;

/** Dipakai kalau video tidak punya bicara sama sekali (musik/montase). */
const VISUAL_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Mulai momen, format MM:SS' },
          end: { type: 'string', description: 'Akhir momen, format MM:SS' },
          title: { type: 'string', description: 'Judul clip, maksimal 60 karakter' },
          reason: { type: 'string', description: 'Alasan singkat, maksimal 200 karakter' },
          quote: { type: 'string', description: 'Deskripsi singkat visual pembuka klip' },
          viralScore: { type: 'integer', description: 'Skor daya tarik 0-100' },
        },
        required: ['start', 'end', 'title', 'reason', 'quote', 'viralScore'],
        propertyOrdering: ['start', 'end', 'title', 'reason', 'quote', 'viralScore'],
      },
    },
  },
  required: ['picks'],
} as const;

/**
 * Tahap verifikasi batas di atas audio sungguhan (+ posisi subjek sekaligus).
 *
 * startOffsetSec/endOffsetSec = detik RELATIF terhadap awal potongan video
 * yang dikirim untuk klip tersebut.
 */
const SNAP_SCHEMA = {
  type: 'object',
  properties: {
    frames: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Nomor klip, sama seperti di prompt' },
          startOffsetSec: {
            type: 'number',
            description: 'Detik relatif saat kata pertama kalimat pembuka diucapkan',
          },
          endOffsetSec: {
            type: 'number',
            description: 'Detik relatif tepat setelah kalimat terakhir selesai',
          },
          subjectX: {
            type: 'number',
            description:
              'Posisi horizontal pusat orang bicara di frame, 0-1. 0 = paling kiri, ' +
              '0.5 = tengah, 1 = paling kanan.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Keyakinan terhadap ketepatan detik yang dikembalikan',
          },
        },
        required: ['index', 'startOffsetSec', 'endOffsetSec', 'confidence'],
        propertyOrdering: ['index', 'startOffsetSec', 'endOffsetSec', 'subjectX', 'confidence'],
      },
    },
  },
  required: ['frames'],
} as const;



const RATIO_HINT: Record<ClipRatio, string> = {
  '9:16': 'vertical 9:16 untuk Shorts/Reels/TikTok',
  '1:1': 'persegi 1:1 untuk feed',
  '16:9': 'horizontal 16:9 untuk YouTube',
};

const clipRangeSec = () =>
  `${MIN_CLIP_MS / 1000}-${MAX_CLIP_MS / 1000} detik`;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Model yang berhasil dipakai, atau null kalau belum ada request sukses. */
export function getResolvedModel(): string | null {
  return cachedModel;
}

/**
 * Alur 4 tahap, semua timestamp berasal dari pembacaan audio sungguhan.
 *
 * 1. Transkrip (video ikut dikirim): Gemini menuliskan SELURUH pembicaraan
 *    verbatim, dipecah jadi chunk 20-60 detik dengan batas MM:SS. Ini jadi
 *    ground truth — cap waktu model dipegang per detik, jadi meminta milidetik
 *    hanya mendorong model mengarang angka, sedangkan MM:SS cocok dengan apa
 *    yang benar-benar ia dengar.
 * 2. Seleksi (teks saja): model memilih nomor chunk, BUKAN menebak waktu.
 *    Batas waktu dipetakan ke kode dari chunk yang dipilih, jadi mustahil
 *    keluar timestamp yang tidak ada di transkrip.
 * 3. Resolusi rentang (kode): durasi video, batas 30-120 detik, dan tumpang
 *    tindih antar klip diselesaikan DI SINI — sebelum ada deskripsi ditulis.
 * 4. Deskripsi (teks saja): title/reason/quote ditulis untuk rentang waktu
 *    final yang sudah dikunci tahap 3. Karena itu deskripsi yang tampil
 *    selalu sesuai dengan isi klip yang benar-benar dipotong.
 * 5. Framing (video dikirim per jendela, hanya kalau changeRatio): posisi
 *    subjek dibaca dari frame sungguhan, bukan dikarang.
 *
 * Kenapa deskripsi harus paling akhir: kalau model menulis deskripsi dulu lalu
 * kode memangkas batasnya, teks yang ditampilkan jadi menggambarkan potongan
 * yang sudah dibuang. Inilah keluhan "batas potong dan deskripsi tidak
 * selaras" yang paling sering muncul.
 *
 * Kenapa tidak langsung minta "momen terbaik + timestamp" dalam satu panggilan:
 * model harus menebak batas kalimat dari peta video yang hanya beresolusi
 * 1 frame/detik. Hasilnya meleset belasan detik dan sering memotong kalimat
 * di tengah — itu penyebab utama hasil terasa "ngawur".
 */
export async function analyzeVideoWithGemini(
  params: AnalyzeParams,
  options: AnalyzeOptions = {}
): Promise<AnalysisResult> {
  const { apiKey, video, parts, ratio, changeRatio } = params;
  const { onProgress, signal, onFallback } = options;

  // Tanpa instruksi user, pakai arahan netral supaya prompt tetap punya
  // konteks seleksi (bukan tema bawaan yang mengunci arah konten).
  const intent = params.customPrompt?.trim()
    ? `Instruksi user (prioritas utama): "${params.customPrompt.trim()}"`
    : 'Pilih momen yang paling menarik dan berpotensi viral untuk audiens umum';

  const report = (stage: AnalysisProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  report('preparing', 5, 'Menyiapkan sumber video...');

  const media = resolveMedia(video);

  // --- Tahap 1: transkrip bertimestamp --------------------------------------
  //
  // Coba dulu subtitle bawaan YouTube: cap waktunya berasal dari ASR atas
  // audio yang sama dengan file video, jadi jauh lebih akurat daripada
  // perkiraan model — dan membebaskan kita dari panggilan video termahal.
  // Kalau subtitle tidak ada, baru Gemini yang mendengarkan sendiri.
  report('outline', 12, 'Mengambil transkrip YouTube...');
  let transcript = await transcriptFromYouTube(video.uri);

  if (!transcript) {
    report('outline', 18, 'Transkrip tidak ada, Gemini mendengarkan video...');
    transcript = await transcribe(apiKey, media, signal, onFallback, (round) => {
      if (round > 0) {
        report('outline', 18 + round * 10, 'Transkrip terpotong, melanjutkan...');
      }
    });
  }

  // Durasi jangan pernah lebih kecil dari yang sudah kita ketahui — kalau
  // transkrip berhenti sebelum video habis (outro tanpa subtitle), memakai
  // durasi transkrip saja akan memotong klip valid di ujung video.
  const durationMs = Math.max(
    transcript.durationSec > 0 ? transcript.durationSec * 1000 : 0,
    video.durationMs || 0
  );
  const usedYouTubeTranscript = transcript.source === 'youtube';

  let segments: AISegment[] = [];

  if (transcript.chunks.length > 0) {
    // --- Tahap 2: pilih dari transkrip ---------------------------------------
    report('refining', 50, 'Memilih momen terbaik dari transkrip...');
    const provisional = await selectMoments(
      apiKey,
      transcript.chunks,
      ratio,
      intent,
      parts,
      signal,
      onFallback
    );

    if (provisional.length === 0) {
      throw new Error(
        `Tidak ada momen yang muat di rentang ${clipRangeSec()} detik. ` +
          `Coba turunkan jumlah clip, atau ganti instruksi/tema.`
      );
    }

    // --- Tahap 3: verifikasi batas di atas audio ------------------------------
    //
    // Transkrip YouTube cap waktunya presisi, jadi tidak perlu verifikasi audio
    // — KECUALI saat crop aktif (butuh posisi subjek). Untuk sumber Gemini,
    // batas harus selalu diverifikasi.
    const needsVideoCheck = !!changeRatio || !usedYouTubeTranscript;
    if (needsVideoCheck) {
      report('refining', 70, 'Memverifikasi batas potong dari audio...');
      await snapBoundaries(apiKey, media, provisional, !!changeRatio, signal, onFallback);
    }

    // --- Tahap 4: kunci rentang final ----------------------------------------
    const windows = finalizeWindows(provisional, parts, durationMs);
    if (windows.length === 0) {
      throw new Error(
        `Tidak ada momen yang muat di rentang ${clipRangeSec()} detik. ` +
          `Coba turunkan jumlah clip, atau ganti instruksi/tema.`
      );
    }

    // --- Tahap 5: deskripsi untuk rentang yang SUDAH final --------------------
    report('refining', 88, 'Menyusun deskripsi tiap klip...');
    segments = await describeWindows(apiKey, windows, intent, signal, onFallback);
  } else {
    // Video tanpa bicara (montase, musik, gameplay): andalkan visual.
    report('refining', 60, 'Tidak ada pembicaraan, menganalisa visual...');
    segments = await pickVisualMoments(apiKey, media, parts, ratio, intent, signal, onFallback);
  }

  report('done', 100, 'Selesai');

  // Rentang waktu sudah final sejak finalizeWindows; di sini hanya diurutkan
  // dan dibatasi jumlahnya, TIDAK diubah batasnya — kalau dipangkas lagi di
  // tahap ini, deskripsi bisa tidak cocok dengan clip yang dipotong.
  const final = sortByScore(segments).slice(0, parts);

  if (final.length === 0 && segments.length > 0) {
    throw new Error(
      `Ditemukan ${segments.length} momen, tapi semuanya tidak muat di rentang ` +
        `${clipRangeSec()} detik untuk jadi clip. Coba turunkan jumlah clip atau ` +
        `ganti instruksi/tema.`
    );
  }

  return { segments: final, durationMs };
}

// ---------------------------------------------------------------------------
// Media resolution
// ---------------------------------------------------------------------------

/** Media selalu berupa URL YouTube — tidak ada lagi upload file. */
type ResolvedMedia = { uri: string };

/**
 * Analisa SELALU dari URL. Tidak ada upload file ke Gemini — Gemini sendiri
 * yang mengunduh dan memproses video dari YouTube, jadi tidak ada video yang
 * keluar dari perangkat user dan tidak ada batas ukuran.
 */
function resolveMedia(video: VideoAsset): ResolvedMedia {
  assertYouTubeUrl(video.uri);
  return { uri: video.uri };
}

function assertYouTubeUrl(raw: string) {
  const url = raw.trim();
  const ok =
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?|shorts\/|live\/)|youtu\.be\/)[\w-]+/.test(url);
  if (!ok) {
    throw new Error(
      'URL YouTube tidak valid. Contoh yang benar: https://www.youtube.com/watch?v=xxxx'
    );
  }
}

// ---------------------------------------------------------------------------
// Tahap 1 — transkrip
// ---------------------------------------------------------------------------

/** Satu potongan pembicaraan, sebelum diberi nomor. */
interface TranscriptSpan {
  startMs: number;
  endMs: number;
  text: string;
}

interface TranscriptChunk extends TranscriptSpan {
  /** 1-based, diurutkan menurut waktu. Acuan waktu untuk tahap 2. */
  index: number;
}

interface Transcript {
  chunks: TranscriptChunk[];
  durationSec: number;
  /** Dari mana transkripnya — menentukan apakah verifikasi audio perlu. */
  source: 'youtube' | 'gemini';
}

/**
 * Ambil subtitle bawaan YouTube dan kelompokkan jadi chunk.
 *
 * Subtitle YouTube datang dalam potongan pendek (2-5 detik per baris), jauh
 * lebih halus dari chunk 15-45 detik yang dibutuhkan tahap berikutnya. Jadi
 * digabung dulu di sini dengan batas yang sama persis dengan hasil transkripsi
 * Gemini — supaya dua jalur ini tidak punya perilaku berbeda.
 */
async function transcriptFromYouTube(url: string): Promise<Transcript | null> {
  try {
    const result = await fetchYouTubeTranscript(url);
    if (!result || result.segments.length === 0) return null;

    return {
      chunks: chunkSegments(result.segments),
      durationSec: result.durationSec,
      source: 'youtube',
    };
  } catch {
    return null;
  }
}

/** Gabung baris subtitle pendek menjadi chunk 15-45 detik di batas kalimat. */
function chunkSegments(segments: TranscriptSegment[]): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let current: { startMs: number; endMs: number; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      chunks.push({ index: 0, startMs: current.startMs, endMs: current.endMs, text });
    }
    current = null;
  };

  for (const seg of segments) {
    if (!current) {
      current = { startMs: seg.startMs, endMs: seg.endMs, parts: [seg.text] };
      continue;
    }

    const spanMs = seg.endMs - current.startMs;
    const gapMs = seg.startMs - current.endMs;
    const text = current.parts.join(' ');

    // Tutup chunk kalau:
    // - sudah cukup panjang DAN kalimatnya sudah selesai (tanda baca akhir),
    // - ada jeda panjang (pergantian topik),
    // - atau sudah mentok batas keras.
    // Tanpa cek kalimat, chunk terpotong di tengah kata dan batas klip ikut
    // meleset — klip mulai/berhenti di tengah kalimat.
    const sentenceEnded = /[.!?…]["'”’)]?\s*$/.test(text);
    const tooLong = spanMs >= CHUNK_MAX_MS && sentenceEnded;
    if (tooLong || spanMs >= CHUNK_HARD_MAX_MS || gapMs > GAP_MS) {
      flush();
      current = { startMs: seg.startMs, endMs: seg.endMs, parts: [seg.text] };
      continue;
    }

    current.endMs = Math.max(current.endMs, seg.endMs);
    current.parts.push(seg.text);
  }

  flush();

  return chunks.map((c, i) => ({ ...c, index: i + 1 }));
}

interface TranscriptPayload {
  durationSec?: number;
  hasSpeech?: boolean;
  chunks?: { start?: unknown; end?: unknown; text?: unknown }[];
}

const TRANSCRIPT_PROMPT =
  `Kamu transkriber video profesional. Dengarkan audio video ini dan tulis ` +
  `transkrip VERBATIM yang lengkap dari detik 0 sampai video benar-benar habis.\n\n` +
  `Tujuan utama: batas antar chunk harus presisi, karena batas chunk inilah yang ` +
  `dipakai untuk memotong video nanti.\n\n` +
  `Aturan:\n` +
  `- Satu chunk = satu topik bicara yang utuh, ideal ` +
  `${CHUNK_MIN_MS / 1000}-${CHUNK_MAX_MS / 1000} detik. Kalau topiknya sudah ` +
  `jelas habis, berhenti dan mulai chunk baru.\n` +
  `- start = MM:SS pada kata PERTAMA yang benar-benar diucapkan di chunk itu. ` +
  `Jangan masukkan jeda hening, musik, atau suara lain sebelum kata tersebut.\n` +
  `- end = MM:SS tepat setelah kata terakhir di chunk itu selesai diucapkan. ` +
  `Jangan memotong di tengah kata atau di tengah kalimat.\n` +
  `- Potongan harus berurutan, tidak saling tumpang tindih, dan TIDAK ADA bagian ` +
  `yang dilewati.\n` +
  `- WAJIB format MM:SS (menit:detik), bukan milidetik dan bukan angka bulat.\n` +
  `- text = apa yang benar-benar dikatakan, apa adanya, INCLUDING kata lengkapnya. ` +
  `Jangan parafrase, jangan ringkas, jangan tulis anotasi seperti [musik] atau ` +
  `[tertawa]. Jangan pernah mengganti kata dengan titik tiga.\n` +
  `- Kalau ada jeda hening lebih dari 2 detik, potong chunk di jeda itu agar ` +
  `klip nanti tidak mulai/berakhir di keheningan.\n` +
  `- durationSec = durasi total video dalam detik bulat.\n` +
  `- Kalau tidak ada ucapan manusia sama sekali (cuma musik, teks, atau gambar), ` +
  `set hasSpeech=false dan chunks=[].\n` +
  `- Jangan mengarang cap waktu. Pakai waktu yang benar-benar kamu dengar.`;

const CONTINUE_PROMPT = (from: string) =>
  `${TRANSCRIPT_PROMPT}\n\n` +
  `PENTING: transkrip sebelumnya sudah sampai ${from}. Sekarang Lanjutkan tepat ` +
  `dari ${from} sampai video habis. Jangan mengulang apa pun sebelum ${from}.`;

/** Kunci yang menandai satu item transkrip — dipakai saat jawaban terpotong. */
const TRANSCRIPT_ITEM_KEYS = ['start', 'end', 'text'];

async function transcribe(
  apiKey: string,
  media: ResolvedMedia,
  signal?: { aborted: boolean },
  onFallback?: ModelFallbackHandler,
  onRound?: (round: number) => void
): Promise<Transcript> {
  const collected: TranscriptSpan[] = [];
  let durationSec = 0;
  let cursor: number | null = null;

  for (let round = 0; round < MAX_TRANSCRIPT_ROUNDS; round++) {
    const prompt =
      cursor === null ? TRANSCRIPT_PROMPT : CONTINUE_PROMPT(fmtTimestamp(cursor));

    const result = await generateContent(
      apiKey,
      prompt,
      [videoPart(media.uri)],
      TRANSCRIPT_SCHEMA,
      {
        // Bicara saja yang dibutuhkan di tahap ini, jadi resolusi video
        // diturunkan: 1 frame/detik dengan 66 token/frame sudah cukup, dan
        // audio tetap diproses penuh.
        mediaResolution: 'low',
        thinkingLevel: 'low',
        temperature: 0.1,
        maxOutputTokens: 65_536,
        signal,
        onFallback,
      }
    );

    const payload = (result.data ?? {}) as TranscriptPayload;
    // Kalau JSON-nya terpotong di tengah, ambil chunk yang sudah tertulis utuh.
    const rawChunks = Array.isArray(payload.chunks)
      ? payload.chunks
      : salvageItems(result.raw, TRANSCRIPT_ITEM_KEYS);
    const fresh = parseChunks(rawChunks);

    if (round === 0 && fresh.length === 0) {
      throw new Error(
        describeParseFailure('Gemini tidak berhasil menulis transkrip', result.raw)
      );
    }

    // Buang bagian yang sudah kita dapat di ronde sebelumnya, kalau Gemini
    // sempat mengulang awal video.
    const next = collected.length
      ? fresh.filter((c) => c.startMs >= (collected[collected.length - 1].endMs - 2_000))
      : fresh;
    collected.push(...next);

    const roundDuration = Number(payload.durationSec);
    if (Number.isFinite(roundDuration) && roundDuration > 0) {
      durationSec = Math.max(durationSec, Math.round(roundDuration));
    }

    if (!result.truncated) break;
    onRound?.(round + 1);

    const last = collected[collected.length - 1];
    if (!last || (cursor !== null && last.endMs <= cursor)) break;
    cursor = last.endMs;
  }

  const chunks = mergeAdjacentChunks(collected).map((c, i) => ({ ...c, index: i + 1 }));

  // Durasi dari Gemini dipakai hanya kalau mengikat dengan transcript yang
  // kita baca; kalau jauh lebih besar, lebih aman pakai ujung transkrip.
  const maxEnd = chunks.length ? chunks[chunks.length - 1].endMs : 0;
  if (durationSec > 0 && maxEnd > 0 && durationSec * 1000 < maxEnd) {
    durationSec = Math.ceil(maxEnd / 1000);
  }

  return { chunks, durationSec, source: 'gemini' };
}

function parseChunks(raw: unknown[]): TranscriptSpan[] {
  const out: TranscriptSpan[] = [];

  for (const entry of raw) {
    const item = (entry ?? {}) as { start?: unknown; end?: unknown; text?: unknown };
    const startMs = parseTimestamp(item.start);
    const endMs = parseTimestamp(item.end);
    const text = (typeof item.text === 'string' ? item.text : '').trim();
    if (startMs === null || endMs === null || !text) continue;
    if (endMs <= startMs) continue;
    out.push({ startMs, endMs, text });
  }

  return mergeAdjacentChunks(out).sort((a, b) => a.startMs - b.startMs);
}

/**
 * Gabungkan chunk yang nyambung. Gemini kadang memecah satu kalimat jadi
 * beberapa potongan; kalau tidak digabung, tiap pecahan bisa terlalu pendek
 * untuk jadi klip sendiri.
 */
function mergeAdjacentChunks(chunks: TranscriptSpan[]): TranscriptSpan[] {
  const sorted = [...chunks].sort((a, b) => a.startMs - b.startMs);
  const out: TranscriptSpan[] = [];

  for (const c of sorted) {
    const prev = out[out.length - 1];
    // Jeda < 1.5 detik dianggap masih satu utterances yang sama.
    if (prev && c.startMs - prev.endMs <= 1_500 && c.endMs - prev.startMs <= MAX_CLIP_MS) {
      prev.endMs = Math.max(prev.endMs, c.endMs);
      prev.text = `${prev.text} ${c.text}`.trim();
      continue;
    }
    out.push({ ...c });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Tahap 2 — seleksi momen dari transkrip
// ---------------------------------------------------------------------------

interface Pick {
  chunkIndexes: number[];
  title: string;
  reason: string;
  viralScore: number;
}

/**
* Rentang waktu final untuk satu klip, beserta transkrip di dalamnya.
 *
 * ClipWindow dibuat sebelum deskripsi ditulis supaya deskripsinya pasti
 * menggambarkan rentang yang sama dengan yang dipotong.
 */
interface ClipWindow {
  startMs: number;
  endMs: number;
  chunks: TranscriptChunk[];
  /** Cadangan kalau tahap deskripsi gagal. */
  title: string;
  reason: string;
  viralScore: number;
  /** Hasil verifikasi audio. */
  confidence?: 'high' | 'medium' | 'low';
  subjectX?: number;
}

async function selectMoments(
  apiKey: string,
  chunks: TranscriptChunk[],
  ratio: ClipRatio,
  intent: string,
  parts: number,
  signal?: { aborted: boolean },
  onFallback?: ModelFallbackHandler
): Promise<ClipWindow[]> {
  // Nomor chunk = acuan waktu. Model tidak perlu (dan tidak boleh) menebak
  // waktu, jadi dia hanya memilih indeks.
  const transcript = chunks
    .map((c) => `[${c.index}] ${fmtTimestamp(c.startMs)}-${fmtTimestamp(c.endMs)} | ${c.text}`)
    .join('\n');

  const prompt =
    `Berikut transkrip verbatim sebuah video, sudah dipecah jadi chunk bernomor. ` +
    `Nomor chunk adalah acuan waktu yang sudah pasti benar.\n\n${transcript}\n\n` +
    `Pilih TEPAT ${parts} momen terbaik dari transkrip itu untuk dijadikan klip ` +
    `${RATIO_HINT[ratio]}. ${intent}.\n\n` +
    `Aturan:\n` +
    `- JANGAN menulis atau menebak timestamp. Referensikan chunk lewat nomor saja.\n` +
    `- chunkIndexes WAJIB berurutan menaik DAN berdekatan (selisih 1). Jangan ` +
    `lompat-lompat: kalau momennya terputus, itu bukan satu momen.\n` +
    `- Momen harus punya hook di detik pertama dan payoff yang memuaskan.\n` +
    `- Total durasi tiap momen ${clipRangeSec()} dihitung dari selisih chunk ` +
    `pertama sampai chunk terakhir. Kalau satu topik lebih panjang dari itu, ` +
    `ambil bagian pembuka + bagian yang paling bikin penasaran.\n` +
    `- Momen tidak boleh tumpang tindih satu sama lain.\n` +
    `- reason: maksimal 200 karakter, kenapa momen ini menarik.\n` +
    `- viralScore harus realistis (jangan semua 90+).\n` +
    `- Pilih SECARA SPARSE: kalau dua momen berdekatan isinya mirip, pilih ` +
    `satu saja. Clip yang dobel tidak berguna.\n` +
    `- Kembalikan tepat ${parts} momen kalau materinya cukup, atau lebih sedikit ` +
    `kalau memang tidak ada cukup momen yang layak.`;

  const result = await generateContent(apiKey, prompt, null, SELECTION_SCHEMA, {
    thinkingLevel: 'low',
    temperature: 0.4,
    maxOutputTokens: 16_384,
    signal,
    onFallback,
  });

  const payload = result.data as { picks?: unknown };
  const picks = (Array.isArray(payload?.picks)
    ? payload.picks
    : salvageItems(result.raw, ['chunkIndexes'])) as Pick[];

  if (!Array.isArray(picks) || picks.length === 0) {
    throw new Error(
      describeParseFailure('Gemini tidak berhasil memilih momen', result.raw)
    );
  }

  return toProvisionalWindows(picks, chunks);
}

/**
 * Perkiraan awal rentang clip, langsung dari chunk transkrip.
 *
 * Belum apa pun yang dipangkas di sini — rentangnya masih boleh melebar,
 * tumpang tindih, atau melewati ujung video. Semua itu diselesaikan di
 * finalizeWindows, SETELAH batas-batasnya dikoreksi terhadap audio.
 */
function toProvisionalWindows(picks: Pick[], chunks: TranscriptChunk[]): ClipWindow[] {
  const windows: ClipWindow[] = [];

  for (const pick of picks) {
    const indexes = Array.isArray(pick.chunkIndexes) ? pick.chunkIndexes : [];

    // Satu pick bisa berisi beberapa deretan yang tidak bersambung (mis.
    // chunk 5,6 lalu 8). Dulu hanya deretan terpanjang yang dipakai, sehingga
    // bagian lain yang dipilih model hilang diam-diam. Sekarang tiap deretan
    // jadi kandidat klip sendiri.
    const runs = contiguousRuns(
      indexes
        .filter((i) => Number.isInteger(i) && i >= 1 && i <= chunks.length)
        .sort((a, b) => a - b)
        .map((i) => i - 1),
      chunks
    );

    for (const run of runs) {
      // Momen pendek (< 30 detik) TIDAK dibuang: ditarik ke chunk tetangga
      // supaya tetap jadi klip utuh. Momen viral justru sering 15-25 detik.
      const chosen = expandToMinDuration(run, chunks);
      if (chosen.length === 0) continue;

      const startMs = Math.max(0, chosen[0].startMs);
      const endMs = chosen[chosen.length - 1].endMs;
      if (endMs - startMs <= 0) continue;

      windows.push({
        startMs,
        endMs,
        chunks: chosen,
        // Cadangan kalau tahap deskripsi nanti gagal: rentang waktunya tetap
        // benar, cuma teksnya kurang rapi.
        title: (pick.title ?? '').trim(),
        reason: (pick.reason ?? '').trim(),
        viralScore: clampScore(pick.viralScore),
      });
    }
  }

  // Kronologis, supaya window verifikasi yang dikirim tidak saling tumpang
  // tindih lebih dari yang perlu.
  return windows.sort((a, b) => a.startMs - b.startMs);
}

/**
 * Tarik rentetan chunk ke depan/belakang sampai durasinya memenuhi MIN_CLIP_MS.
 *
 * Utamakan chunk SESUDAHnya: bagian pembuka biasanya sudah berisi hook, jadi
 * menambah kelanjutannya lebih aman daripada menambah kalimat sebelumnya yang
 * bisa menggeser pembuka klip.
 */
function expandToMinDuration(
  run: TranscriptChunk[],
  all: TranscriptChunk[]
): TranscriptChunk[] {
  if (run.length === 0) return run;

  let first = all.findIndex((c) => c.index === run[0].index);
  let last = all.findIndex((c) => c.index === run[run.length - 1].index);
  if (first < 0 || last < 0) return run;

  const span = () => all[last].endMs - all[first].startMs;

  while (span() < MIN_CLIP_MS) {
    const nextOk =
      last + 1 < all.length && all[last + 1].endMs - all[first].startMs <= MAX_CLIP_MS;
    const prevOk =
      first > 0 && all[last].endMs - all[first - 1].startMs <= MAX_CLIP_MS;

    if (!nextOk && !prevOk) break;
    if (nextOk) last++;
    else first--;
  }

  return all.slice(first, last + 1);
}

/**
 * Kunci rentang FINAL, di kode, sebelum deskripsi ditulis.
 *
 * Semua aturan yang bisa mengubah batas diterapkan di sini: durasi video,
 * rentang 30-120 detik, dan tumpang tindih antar momen. Kalau urutannya
 * dibalik, kode bisa memangkas klip setelah model selesai menulis
 * deskripsinya — dan deskripsi itu tidak lagi nyambung dengan clip-nya.
 */
function finalizeWindows(
  provisional: ClipWindow[],
  parts: number,
  durationMs: number
): ClipWindow[] {
  const limit = durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY;

  const capped = provisional
    .map((w) => {
      const startMs = Math.min(Math.max(0, w.startMs), limit);
      // Dipangkas dari belakang, bukan dari depan: detik pertama klip adalah
      // hook-nya, itu bagian yang paling bikin orang berhenti scroll.
      const endMs = Math.min(w.endMs, startMs + MAX_CLIP_MS, limit);
      if (endMs - startMs < MIN_CLIP_MS) return null;

      // Chunk ikut dipangkas supaya teks yang dibaca untuk menulis deskripsi
      // benar-benar hanya berisi bagian yang tersisa — bukan teks yang sudah
      // dibuang dari klip.
      return syncChunksToRange({ ...w, startMs, endMs });
    })
    .filter((w): w is ClipWindow => w !== null)
    .sort((a, b) => a.startMs - b.startMs);

  // Tumpang tindih DIKURANGI (bukan cuma dipotong ekornya) supaya tidak ada
  // momen yang seluruhnya tertimpa tapi tetap lolos sebagai "klip".
  //
  // Urutannya berdasarkan SKOR, bukan waktu: klip terbaik yang berhak lebih
  // dulu mengambil bagian yang tumpang tindih. Kalau yang awal menang, hook
  // klip terbaik bisa dirampas klip yang skornya lebih rendah.
  const windows: ClipWindow[] = [];
  for (const w of [...capped].sort((a, b) => b.viralScore - a.viralScore)) {
    const piece = takeFreePiece(w, windows);
    if (piece) windows.push(piece);
  }

  // Pilih berdasarkan skor, BUKAN urutan waktu. Kalau model mengembalikan
  // lebih banyak momen dari yang diminta, yang tersisa harus momen terbaik,
  // bukan yang paling awal muncul di video.
  return windows
    .sort((a, b) => b.viralScore - a.viralScore)
    .slice(0, parts);
}

/**
 * Sinkronkan daftar chunk dengan rentang klip yang sudah final.
 *
 * Ini kunci konsistensi judul/deskripsi: teks yang dipakai untuk menulis
 * deskripsi harus teks yang BENAR-BENAR ada di dalam klip.
 *
 * Chunk yang terpotong di batas klip dipangkas teksnya secara proporsional
 * terhadap waktu. Ini perkiraan, tapi jauh lebih dekat daripada menyimpan
 * seluruh kalimat (yang sebagian sudah tidak terdengar) atau membuang chunk
 * utuh (padahal justru berisi kata-kata pembuka klip).
 */
function syncChunksToRange(w: ClipWindow): ClipWindow {
  const chunks: TranscriptChunk[] = [];

  for (const c of w.chunks) {
    const startMs = Math.max(c.startMs, w.startMs);
    const endMs = Math.min(c.endMs, w.endMs);
    if (endMs <= startMs) continue;

    const span = Math.max(1, c.endMs - c.startMs);
    const startRatio = (startMs - c.startMs) / span;
    const endRatio = (endMs - c.startMs) / span;

    const text = trimTextByRatio(c.text, startRatio, endRatio);
    if (!text) continue;

    chunks.push({ ...c, startMs, endMs, text });
  }

  return { ...w, chunks };
}

/**
 * Ambil porsi teks yang kira-kira diucapkan pada rentang [fromRatio, toRatio]
 * dari durasi chunk. Dipotong di batas kata supaya tidak menghasilkan
 * potongan kata yang aneh.
 */
function trimTextByRatio(text: string, fromRatio: number, toRatio: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  // Chunk utuh — jangan sentuh teksnya.
  if (fromRatio <= 0.02 && toRatio >= 0.98) return clean;

  const words = clean.split(' ');
  const from = Math.max(0, Math.floor(words.length * clamp01(fromRatio)));
  const to = Math.min(words.length, Math.ceil(words.length * clamp01(toRatio)));
  if (to <= from) return '';

  return words.slice(from, to).join(' ');
}


/**
 * Potong `w` terhadap semua klip yang sudah dipakai, lalu ambil bagian yang
 * tersisa dan paling panjang. Kalau tidak ada sisa yang cukup panjang,
 * momennya dibuang — lebih baik 4 clip yang bersih daripada 5 clip yang
 * isinya dobel.
 */
function takeFreePiece(w: ClipWindow, taken: ClipWindow[]): ClipWindow | null {
  let pieces = [{ startMs: w.startMs, endMs: w.endMs }];

  for (const other of taken) {
    const next: { startMs: number; endMs: number }[] = [];
    for (const p of pieces) {
      if (other.endMs <= p.startMs || other.startMs >= p.endMs) {
        next.push(p);
        continue;
      }
      if (other.startMs > p.startMs) {
        next.push({ startMs: p.startMs, endMs: other.startMs });
      }
      if (other.endMs < p.endMs) {
        next.push({ startMs: other.endMs, endMs: p.endMs });
      }
    }
    pieces = next;
  }

  const best = pieces
    .filter((p) => p.endMs - p.startMs >= MIN_CLIP_MS)
    .sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))[0];

  if (!best) return null;

  // Chunk ikut dipangkas supaya transkrip yang nanti dibaca untuk menulis
  // deskripsi benar-benar milik bagian yang tersisa.
  return syncChunksToRange({ ...w, startMs: best.startMs, endMs: best.endMs });
}

/**
 * Pecah indeks chunk jadi deretan yang benar-benar bersambung.
 *
 * Kalau model memberi chunk 2 dan 9 tanpa apa pun di antaranya, keduanya tidak
 * boleh dijadi satu klip: isinya jadi transkrip penuh bagian yang tidak masuk
 * momen tersebut. Yang dikembalikan adalah SETIAP deretan bersambung, supaya
 * bagian yang terpisah tetap bisa dipakai sebagai kandidat klip sendiri.
 */
function contiguousRuns(indexes: number[], chunks: TranscriptChunk[]): TranscriptChunk[][] {
  if (indexes.length === 0) return [];

  const runs: number[][] = [];
  let current: number[] = [indexes[0]];

  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] === indexes[i - 1] + 1) current.push(indexes[i]);
    else {
      runs.push(current);
      current = [indexes[i]];
    }
  }
  runs.push(current);

  return runs
    .map((run) => run.map((i) => chunks[i]).filter(Boolean))
    .filter((run) => run.length > 0);
}

/**
 * Tulis deskripsi untuk rentang waktu yang SUDAH final.
 *
 * Ini yang menjamin title / reason / quote benar-benar menggambarkan isi clip
 * yang akan dipotong — bukan versi sebelum batasnya dipangkas.
 */
async function describeWindows(
  apiKey: string,
  windows: ClipWindow[],
  intent: string,
  signal?: { aborted: boolean },
  onFallback?: ModelFallbackHandler
): Promise<AISegment[]> {
  if (windows.length === 0) return [];

  // Window tanpa teks tersisa (mis. batas klip bergeser ke bagian hening)
  // tidak boleh dikirim ke model: tanpa teks, model hanya bisa mengarang.
  // Untuk kasus itu pakai judul/alasan dari tahap seleksi apa adanya.
  //
  // Penomoran dibuat berurutan (1..N) khusus untuk potongan yang punya teks,
  // lalu dipetakan balik ke index window aslinya. Kalau nomornya dibiarkan
  // bolong, model bisa salah memasangkan deskripsi ke klip.
  const targets = windows
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => windowText(w).length > 0);

  if (targets.length === 0) return windows.map(toSegment);

  const list = targets
    .map(({ w }, n) => {
      const text = windowText(w);
      return (
        `${n + 1}. ${fmtTimestamp(w.startMs)} - ${fmtTimestamp(w.endMs)}\n` +
        `   kalimat pembuka: "${firstSentenceFrom(text)}"\n` +
        `   isi lengkap: ${text.slice(0, 900)}`
      );
    })
    .join('\n\n');

  const prompt =
    `Berikut potongan-potongan video yang sudah dipotong permanen. Tulis deskripsi ` +
    `untuk SETIAP nomor, berdasarkan HANYA teks di potongan itu.\n\n${list}\n\n` +
    `${intent}.\n\n` +
    `Aturan:\n` +
    `- index: nomor potongan, sama seperti di atas.\n` +
    `- title: maksimal 60 karakter, punchy, menggambarkan isi klip itu.\n` +
    `- reason: maksimal 200 karakter, kenapa potongan itu menarik untuk ditonton.\n` +
    `- quote: kalimat PERSIS yang terdengar di detik pertama potongan itu, ` +
    `maksimal 120 karakter. Salin dari kalimat pembuka di atas, jangan tulis ulang.\n` +
    `- viralScore: 0-100, realistis, jangan semua 90+.\n` +
    `- DILARANG menyebut topik, nama, angka, atau kejadian yang TIDAK ADA di ` +
    `teks potongan tersebut — termasuk yang disebut di instruksi user. Kalau ` +
    `instruksi user tidak cocok dengan isi klip, ikuti isi klipnya.`;

  try {
    const result = await generateContent(apiKey, prompt, null, DESCRIBE_SCHEMA, {
      thinkingLevel: 'low',
      temperature: 0.3,
      maxOutputTokens: 16_384,
      signal,
      onFallback,
    });

    const payload = result.data as { descriptions?: unknown };
    const items = (Array.isArray(payload?.descriptions)
      ? payload.descriptions
      : salvageItems(result.raw, ['quote'])) as {
      index?: unknown;
      title?: unknown;
      reason?: unknown;
      quote?: unknown;
      viralScore?: unknown;
    }[];

    if (Array.isArray(items) && items.length > 0) {
      // Model menjawab dengan nomor 1..N milik daftar yang dikirim. Petakan
      // balik ke index window aslinya lewat `targets`.
      const byNumber = new Map<number, (typeof items)[number]>();
      for (const d of items) {
        const n = Number(d.index);
        if (Number.isInteger(n) && n >= 1 && n <= targets.length) byNumber.set(n, d);
      }

      const described = new Map<number, (typeof items)[number]>();
      targets.forEach(({ index }, n) => {
        const d = byNumber.get(n + 1);
        if (d) described.set(index, d);
      });

      return windows.map((w, index) => {
        const base = toSegment(w);
        const d = described.get(index);
        const text = windowText(w);

        // Tidak ada teks atau tidak ada jawaban model untuk nomor ini:
        // pertahankan hasil seleksi, jangan mengarang.
        if (!d || !text) return base;

        return {
          ...base,
          title: (typeof d.title === 'string' ? d.title.trim() : '') || base.title,
          reason: (typeof d.reason === 'string' ? d.reason.trim() : '') || base.reason,
          quote: pickQuote(d.quote, text),
          viralScore:
            typeof d.viralScore === 'number' && Number.isFinite(d.viralScore)
              ? clampScore(d.viralScore)
              : base.viralScore,
        };
      });
    }
  } catch (e) {
    if (signal?.aborted) throw e;
    // Tahap deskripsi gagal: pakai reason kasar dari tahap selections. Rentang
    // waktunya tetap benar, jadi lebih baik daripada gagal total.
  }

  return windows.map(toSegment);
}

/** Teks transkrip yang benar-benar berada di dalam rentang klip. */
function windowText(w: ClipWindow): string {
  return w.chunks
    .map((c) => c.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSegment(w: ClipWindow): AISegment {
  const seg: AISegment = {
    startMs: w.startMs,
    endMs: w.endMs,
    title: w.title || 'Clip',
    reason: w.reason,
    quote: firstSentence(w.chunks),
    viralScore: w.viralScore,
  };
  if (w.confidence) seg.confidence = w.confidence;
  if (typeof w.subjectX === 'number') seg.subjectX = w.subjectX;
  return seg;
}

/**
 * Ambil kalimat pembuka yang benar-benar ada di teks klip.
 *
 * Kutipan dari model hanya diterima kalau letaknya di AWAL klip. Sebelumnya
 * kutipan dari tengah klip juga lolos, sehingga yang tampil ke user bisa
 * kalimat yang tidak terdengar di detik pertama — dan clip terasa tidak cocok
 * dengan deskripsinya. Kalau tidak cocok, pakai kalimat asli dari transkrip.
 */
function pickQuote(quote: unknown, text: string): string {
  const haystack = normalizeForCompare(text);
  const wanted = normalizeForCompare(typeof quote === 'string' ? quote : '');

  if (wanted) {
    const at = haystack.indexOf(wanted);
    // 80 karakter pertama ≈ satu kalimat pembuka. Kutipan yang muncul lebih
    // jauh dari itu berasal dari tengah/belakang klip, jadi ditolak.
    if (at >= 0 && at <= 80) {
      return (quote as string).trim().slice(0, 120);
    }
  }

  return firstSentenceFrom(text);
}

function firstSentence(chunks: TranscriptChunk[]): string {
  return firstSentenceFrom(chunks.map((c) => c.text).join(' '));
}

function firstSentenceFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 120) return clean;
  const cut = clean.slice(0, 120);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return boundary > 40 ? cut.slice(0, boundary + 1) : cut.trim();
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .replace(/[.,!?;:"'`\-–—…()\[\]]/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Fallback — video tanpa pembicaraan
// ---------------------------------------------------------------------------

async function pickVisualMoments(
  apiKey: string,
  media: ResolvedMedia,
  parts: number,
  ratio: ClipRatio,
  intent: string,
  signal?: { aborted: boolean },
  onFallback?: ModelFallbackHandler
): Promise<AISegment[]> {
  const prompt =
    `Video ini tidak punya pembicaraan yang bisa didengar, jadi momen ditentukan ` +
    `dari VISUAL: adegan, aksi, reveal, atau momen lucu/viral.\n\n` +
    `Pilih ${parts} momen terbaik untuk klip ${RATIO_HINT[ratio]}. ${intent}.\n\n` +
    `Aturan:\n` +
    `- start dan end WAJIB format MM:SS (menit:detik).\n` +
    `- Durasi tiap momen ${clipRangeSec()}, mulai dan selesai di batas adegan yang ` +
    `terbaca jelas, bukan di tengah gerakan.\n` +
    `- Momen tidak boleh tumpang tindih.\n` +
    `- quote berisi deskripsi singkat visual yang terjadi di detik pertama klip.\n` +
    `- title maksimal 60 karakter, reason maksimal 200 karakter.\n` +
    `- viralScore harus realistis.`;

  const result = await generateContent(
    apiKey,
    prompt,
    [videoPart(media.uri)],
    VISUAL_SCHEMA,
    {
      // Di sini visual yang jadi acuan, jadi resolusi jangan diturunkan.
      mediaResolution: 'high',
      thinkingLevel: 'low',
      temperature: 0.4,
      maxOutputTokens: 16_384,
      signal,
      onFallback,
    }
  );

  const payload = result.data as {
    picks?: { start?: unknown; end?: unknown; title?: unknown; reason?: unknown; quote?: unknown; viralScore?: unknown }[];
  };
  const picks = (
    Array.isArray(payload?.picks) ? payload.picks : salvageItems(result.raw, ['start', 'end'])
  ) as {
    start?: unknown;
    end?: unknown;
    title?: unknown;
    reason?: unknown;
    quote?: unknown;
    viralScore?: unknown;
  }[];

  if (!Array.isArray(picks) || picks.length === 0) {
    throw new Error(
      describeParseFailure('Gemini tidak berhasil menemukan momen visual', result.raw)
    );
  }

  const segments: AISegment[] = [];
  for (const pick of picks) {
    const startMs = parseTimestamp(pick.start);
    const endMs = parseTimestamp(pick.end);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    segments.push({
      startMs,
      endMs,
      title: (typeof pick.title === 'string' ? pick.title : '').trim() || 'Clip',
      reason: (typeof pick.reason === 'string' ? pick.reason : '').trim(),
      quote: (typeof pick.quote === 'string' ? pick.quote : '').trim(),
      viralScore: clampScore(pick.viralScore as number),
    });
  }

  return segments;
}

/**
 * Verifikasi batas potong di atas audio sungguhan + ambil posisi subjek.
 *
* Timestamps dari tahap transkrip punya error beberapa detik, karena model
 * menandai waktu sambil menulis transkrip, bukan mencari teks itu di audio.
 * Di tahap ini pertanyaannya jauh lebih mudah: "di detik berapa kalimat yang
 * diawali kata-kata ini mulai diucapkan?" — model tinggal MENCARI teks itu
 * di audio, bukan menebak.
 *
 * Yang dikirim bukan video penuh, tapi potongan kecil di sekitar tiap batas
 * (± SNAP_PADDING_MS). Tokennya murah dan hasilnya jauh lebih tajam.
 *
 * Koreksi DIBATASI: batas baru tidak boleh menjauh lebih dari SNAP_PADDING_MS
 * dari perkiraan lama. Kalau model mengembalikan angka yang jauh meleset,
 * lama tetap dipakai. Fungsi ini hanya boleh MENGGESER HALUS, tidak memindahkan
 * klip.
 */
async function snapBoundaries(
  apiKey: string,
  media: ResolvedMedia,
  windows: ClipWindow[],
  needFraming: boolean,
  signal?: { aborted: boolean },
  onFallback?: ModelFallbackHandler
): Promise<void> {
  if (windows.length === 0) return;

  // Jendela yang dikirim: perkiraan batas +- padding, dijepit ke >= 0.
  const ranges = windows.map((w) => ({
    startMs: Math.max(0, w.startMs - SNAP_PADDING_MS),
    endMs: w.endMs + SNAP_PADDING_MS,
  }));

  const list = windows
    .map((w, i) => {
      const anchor = firstSentence(w.chunks);
      return (
        `${i + 1}. perkiraan awal ${fmtTimestamp(w.startMs)}, akhir ` +
        `${fmtTimestamp(w.endMs)}\n` +
        `   diawali kalimat: "${anchor}"`
      );
    })
    .join('\n\n');

  const prompt =
    (videoWindowSupported
      ? `Ada ${windows.length} potongan video di atas, berurutan sesuai nomornya.\n\n`
      : `Di atas ada satu video penuh dengan beberapa titik potong yang perlu diperiksa.\n\n`) +
    `Yang perlu diperiksa:\n\n${list}\n\n` +
    `DENGARKAN audio dengan saksama lalu perbaiki batas potongnya.\n\n` +
    `Aturan:\n` +
    `- ${videoWindowSupported ? 'startOffsetSec dan endOffsetSec = detik RELATIF terhadap awal potongan video itu (potongan 1 dimulai dari detik 0).' : 'startOffsetSec dan endOffsetSec = detik ABSOLUT dalam video, boleh desimal (mis. 754.5).'}\n` +
    `- startOffsetSec = detik saat KATA PERTAMA dari kalimat pembuka di atas ` +
    `benar-benar diucapkan. Jangan hitung dari jeda hening atau musik sebelumnya.\n` +
    `- endOffsetSec = detik tepat setelah kalimat terakhir dari potongan itu selesai.\n` +
    `- Jangan menggeser lebih dari ${SNAP_PADDING_MS / 1000} detik dari perkiraan. Kalau kalimatnya ` +
    `memang tidak ada di potongan ini, JANGAN mengarang angka: kembalikan ` +
    `confidence "low" dan perkiraan yang sama.\n` +
    `- confidence: "high" kalau kalimatnya terdengar jelas dan kamu yakin pada ` +
    `detiknya, "medium" kalau agak ragu, "low" kalau tidak ditemukan.\n` +
    (needFraming
      ? `- subjectX: posisi horizontal pusat orang bicara di frame, 0-1 ` +
        `(0 = paling kiri, 0.5 = tengah, 1 = paling kanan). Kalau tidak ada ` +
        `orang, isi 0.5.\n`
      : '') +
    `- Balas tepat ${windows.length} entri dengan index yang sama seperti di atas.`;

  const parts: Record<string, unknown>[] = videoWindowSupported
    ? ranges.map((r) => videoPart(media.uri, r))
    : [videoPart(media.uri)];
  parts.push({ text: prompt });

  let frames: { index?: unknown; startOffsetSec?: unknown; endOffsetSec?: unknown; subjectX?: unknown; confidence?: unknown }[];

  try {
    const result = await generateContent(apiKey, '', parts, SNAP_SCHEMA, {
      // Yang dibutuhkan di sini suara, bukan detail visual, jadi resolusi
      // video diturunkan — audio tetap diproses penuh.
      mediaResolution: needFraming ? 'high' : 'low',
      thinkingLevel: 'low',
      temperature: 0.1,
      maxOutputTokens: 8_192,
      signal,
      onFallback,
    });

    const parsed = (result.data as { frames?: unknown })?.frames;
    frames = (Array.isArray(parsed) ? parsed : salvageItems(result.raw, ['confidence'])) as typeof frames;
  } catch (e) {
    if (signal?.aborted) throw e;
    // Gagal berarti perkiraan transkrip tetap dipakai — batasnya masih
    // masuk akal, jadi lebih baik daripada gagal total.
    return;
  }

  if (!Array.isArray(frames) || frames.length === 0) return;

  for (const frame of frames) {
    const i = Number(frame.index);
    if (!Number.isInteger(i) || i < 1 || i > windows.length) continue;

    const w = windows[i - 1];
    const range = ranges[i - 1];
    const confidence = normalizeConfidence(frame.confidence);

    // Batas relatif -> absolut (hanya kalau jendela video dipakai).
    const relStart = Number(frame.startOffsetSec);
    const relEnd = Number(frame.endOffsetSec);
    const snappedStart = videoWindowSupported
      ? range.startMs + relStart * 1000
      : parseTimestamp(frame.startOffsetSec) ?? w.startMs;
    const snappedEnd = videoWindowSupported
      ? range.startMs + relEnd * 1000
      : parseTimestamp(frame.endOffsetSec) ?? w.endMs;

    const startMs = clampCorrection(snappedStart, w.startMs, SNAP_PADDING_MS);
    const endMs = clampCorrection(snappedEnd, w.endMs, SNAP_PADDING_MS);

    if (endMs - startMs >= MIN_CLIP_MS) {
      w.startMs = Math.max(0, startMs);
      w.endMs = endMs;
      // Teks harus ikut digeser, kalau tidak deskripsi ditulis dari kalimat
      // yang sudah tidak ada di dalam klip.
      Object.assign(w, syncChunksToRange(w));
    }
    w.confidence = confidence;

    const value = Number(frame.subjectX);
    if (needFraming && Number.isFinite(value)) {
      w.subjectX = Math.max(0, Math.min(1, value));
    }
  }
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | 'low' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'high' || raw === 'tinggi') return 'high';
  if (raw === 'low' || raw === 'rendah') return 'low';
  if (raw === 'medium' || raw === 'sedang') return 'medium';
  // Tanpa jawaban yang jelas, jangan percaya diri.
  return 'medium';
}

/**
 * Batasi koreksi agar hanya menggeser halus.
 *
 * Ini pengaman terpenting: kalau model salah baca dan mengembalikan waktu yang
 * jauh dari perkiraan, yang dipertahankan tetap perkiraan lama.
 */
function clampCorrection(value: number, fallback: number, maxShift: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(fallback - maxShift, Math.min(value, fallback + maxShift));
}

// ---------------------------------------------------------------------------
// Gemini calls
// ---------------------------------------------------------------------------

/** Dipanggil saat chain pindah model, supaya UI bisa memberi tahu user. */
export type ModelFallbackHandler = (message: string) => void;

interface GeminiResult<T = unknown> {
  data: T;
  /** Jawaban mentah apa adanya, untuk salvage kalau JSON-nya tidak utuh. */
  raw: string;
  /** true kalau output kepotong batas token (transkrip belum lengkap). */
  truncated: boolean;
  /** true kalau jawaban tidak bisa diparse jadi JSON sama sekali. */
  parseFailed: boolean;
}

interface GenerateArgs {
  /** Wajib kalau ada media video; tanpa media, biarkan default server. */
  mediaResolution?: 'low' | 'high';
  /**
   * Level penalaran internal. Default model adalah "high" yang boros token dan
   * bisa membuat output JSON kepotong, jadi pipeline ini selalu minta "low".
   */
  thinkingLevel?: 'low' | 'medium';
  temperature: number;
  maxOutputTokens: number;
  signal?: { aborted: boolean };
  onFallback?: ModelFallbackHandler;
}

/**
 * Satu bagian video. Kalau windowGiven, hanya rentang itu yang dikirim —
 * perlu dukungan metadata.videoMetadata di server.
 */
function videoPart(uri: string, window?: { startMs: number; endMs: number }) {
  const part: Record<string, unknown> = { file_data: { file_uri: uri } };
  if (window && videoWindowSupported) {
    part.metadata = {
      videoMetadata: {
        startOffset: `${(window.startMs / 1000).toFixed(3)}s`,
        endOffset: `${(window.endMs / 1000).toFixed(3)}s`,
      },
    };
  }
  return part;
}

async function generateContent<T = unknown>(
  apiKey: string,
  prompt: string,
  mediaParts: Record<string, unknown>[] | null,
  schema: unknown,
  args: GenerateArgs
): Promise<GeminiResult<T>> {
  const { signal, onFallback } = args;
  if (signal?.aborted) throw new Error('Analisis dibatalkan.');

  const tried: string[] = [];
  const rateLimited: string[] = [];
  // Turunkan sendiri kalau model ternyata punya batas output lebih kecil.
  let maxOutputTokens = args.maxOutputTokens;

  for (const model of modelCandidates()) {
    if (signal?.aborted) throw new Error('Analisis dibatalkan.');
    tried.push(model);

    let status = 0;
    let raw = '';

    // Maksimal dua percobaan per model: normal, lalu sekali lagi tanpa
    // mediaResolution kalau model itu menolaknya.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: buildBody(prompt, mediaParts, schema, args, maxOutputTokens),
        }
      );

      if (res.ok) {
        cachedModel = model;
        return parseGeminiResponse<T>(await res.json());
      }

      raw = await res.text();
      status = res.status;

      // mediaResolution tidak didukung semua model. Matikan global lalu ulangi
      // pada model YANG SAMA — jangan sampai model bagus terlewati gara-gara
      // hanya tidak mendukung parameter ini.
      if (mediaResolutionSupported && status === 400 && /media_?resolution/i.test(raw)) {
        mediaResolutionSupported = false;
        continue;
      }

      // Sama untuk jendela video (metadata.videoMetadata).
      if (videoWindowSupported && status === 400 && /video_?metadata|start_?offset|end_?offset/i.test(raw)) {
        videoWindowSupported = false;
        continue;
      }

      // Batas output model lebih kecil dari yang kita minta.
      if (status === 400 && /max_?output_?tokens/i.test(raw) && maxOutputTokens > 8_192) {
        maxOutputTokens = 8_192;
        continue;
      }

      // Model lama (2.5) tidak punya thinkingLevel.
      if (thinkingLevelSupported && status === 400 && /thinking_?(level|budget|config)/i.test(raw)) {
        thinkingLevelSupported = false;
        continue;
      }

      break;
    }

    if (shouldTryNextModel(status, raw)) {
      if (status === 429) {
        rateLimited.push(model);
        onFallback?.(`${model} sedang rate limit — beralih ke model lain...`);
      } else {
        onFallback?.(`${model} tidak bisa dipakai key ini — mencoba model lain...`);
      }
      continue;
    }

    // Error lain (400 schema, 500, dll) ditampilkan apa adanya, bukan
    // disamarkan jadi "semua model gagal".
    throw new Error(
      `Permintaan Gemini gagal (${status}) pada model ${model}: ${raw}`
    );
  }

  if (rateLimited.length > 0) {
    throw new Error(
      `Semua model kena rate limit (429): ${rateLimited.join(', ')}. ` +
        `Batas token per menit untuk key ini terlampaui — biasanya karena video ` +
        `yang dianalisa terlalu panjang. Coba video yang lebih pendek, atau ` +
        `naikkan kuota di AI Studio.`
    );
  }

  throw new Error(
    `API key ini tidak punya akses ke model mana pun dari daftar. ` +
      `Sudah dicoba: ${tried.join(', ')}. ` +
      `Cek key di AI Studio, atau ganti model yang dipakai di geminiService.ts.`
  );
}

function buildBody(
  prompt: string,
  mediaParts: Record<string, unknown>[] | null,
  schema: unknown,
  args: GenerateArgs,
  maxOutputTokens: number
): string {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: args.temperature,
    maxOutputTokens,
  };

  // Nama field REST-nya mediaResolution (camelCase). media_resolution
  // diam-diam diabaikan server, hasilnya video diproses resolusi penuh
  // padahal kita cuma butuh audio.
  const wantLow = args.mediaResolution === 'low';
  if (mediaResolutionSupported && (wantLow || args.mediaResolution === 'high')) {
    generationConfig.mediaResolution = wantLow
      ? 'MEDIA_RESOLUTION_LOW'
      : 'MEDIA_RESOLUTION_HIGH';
  }

  // Jangan campur dengan thinkingBudget (untuk model 2.5) — Gemini menolak
  // kalau keduanya dikirim bersamaan.
  if (thinkingLevelSupported && args.thinkingLevel) {
    generationConfig.thinkingLevel = args.thinkingLevel;
  }

  const parts: Record<string, unknown>[] = [
    ...(mediaParts ?? []),
    // Teks selalu diletakkan setelah video — Gemini mengaitkan instruksi
    // dengan media yang ada tepat sebelumnya.
    ...(prompt ? [{ text: prompt }] : []),
  ];

  return JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig,
  });
}

/**
 * Baca jawaban Gemini.
 *
 * PENTING: JSON yang terpotong (MAX_TOKENS) atau dibungkus code fence TIDAK
 * boleh langsung dianggap error. Jawaban mentah selalu dikembalikan di `raw`
 * supaya pemanggil bisa melakukan salvage atas objek-objek yang sudah utuh di
 * dalamnya — untuk transkrip, ribuan chunk yang sempat tertulis tetap terpakai
 * dan proses bisa dilanjutkan dari titik terpotong.
 */
function parseGeminiResponse<T>(json: unknown): GeminiResult<T> {
  const body = json as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  };

  const blocked = body.promptFeedback?.blockReason;
  if (blocked) {
    throw new Error(
      `Permintaan diblokir Gemini (${blocked}). Coba video lain, atau ganti ` +
        `instruksi/tema yang kamu pakai.`
    );
  }

  const candidate = body.candidates?.[0];
  const rawText = candidate?.content?.parts?.map((p) => p.text ?? '').join('');
  const finishReason = candidate?.finishReason;

  if (!rawText) {
    throw new Error(
      finishReason && finishReason !== 'STOP'
        ? `Gemini tidak mengembalikan hasil yang bisa dibaca (${finishReason}).`
        : 'Gemini tidak mengembalikan hasil yang bisa dibaca.'
    );
  }

  const text = stripCodeFence(rawText);

  try {
    return { data: JSON.parse(text) as T, raw: rawText, truncated: false, parseFailed: false };
  } catch {
    // Sengaja tidak dilempar di sini: kalau ternyata cuma terpotong di tengah,
    // salvage di tingkat pemanggil masih bisa memetik bagian yang sudah utuh.
    return {
      data: {} as T,
      raw: rawText,
      truncated: finishReason === 'MAX_TOKENS',
      parseFailed: true,
    };
  }
}

/** Buang pagar markdown ```json ... ``` kalau model membalut jawabannya. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return trimmed;
  const bodyText = trimmed.slice(firstNewline + 1);
  const closing = bodyText.lastIndexOf('```');
  return (closing === -1 ? bodyText : bodyText.slice(0, closing)).trim();
}

/**
 * Ambil objek-objek yang sudah lengkap dari JSON yang belum selesai.
 *
 * Dipakai hanya saat jawaban terpotong: semua objek di dalam array yang sudah
 * tertutup kurung kurawal masih valid dan bisa dipakai apa adanya.
 */
function salvageItems(raw: string, requiredKeys: string[]): unknown[] {
  const source = stripCodeFence(raw);
  const found: unknown[] = [];
  const stack: number[] = [];

  for (let i = 0; i < source.length && found.length < 500; i++) {
    const ch = source[i];
    if (ch === '"') {
      // Lompati seluruh string supaya kurung kurawal di dalam teks tidak
      // ikut dihitung sebagai struktur.
      i++;
      while (i < source.length) {
        if (source[i] === '\\') i++;
        else if (source[i] === '"') break;
        i++;
      }
      continue;
    }
    if (ch === '{') {
      stack.push(i);
      continue;
    }
    if (ch === '}' && stack.length > 0) {
      const from = stack.pop() as number;
      try {
        const value = JSON.parse(source.slice(from, i + 1));
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          requiredKeys.every((k) => k in (value as Record<string, unknown>))
        ) {
          found.push(value);
        }
      } catch {
        // Objek belum tertutup semua (mis. bagian paling terakhir yang
        // kepotong) — lewati saja.
      }
    }
  }

  return found;
}

/** Pesan error yang menyebut cuplikan jawaban, supaya bisa didiagnosis. */
function describeParseFailure(what: string, raw: string): string {
  const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 160);
  return (
    `${what} tapi jawabannya bukan JSON yang valid` +
    (snippet ? `. Bagian awal jawaban: "${snippet}"` : '.')
  );
}

// ---------------------------------------------------------------------------
// Parsing waktu
// ---------------------------------------------------------------------------

/**
 * Parse cap waktu dari Gemini -> milidetik absolut.
 *
 * Selalu return null kalau tidak bisa dibaca dengan yakin. Lebih baik satu
 * segmen hilang daripada satu clip dengan batas ngawur.
 */
function parseTimestamp(raw: unknown): number | null {
  if (typeof raw === 'number') {
    // Numerik mentah: anggap detik (kasih tahu model mengabaikan MM:SS).
    if (!Number.isFinite(raw) || raw < 0) return null;
    return Math.round(raw * 1000);
  }

  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  // MM:SS, H:MM:SS, atau MMM:SS untuk video panjang. Menit TIDAK dibatasi dua
  // digit: `fmtTimestamp` menghasilkan "120:07" untuk video >99 menit, dan
  // versi lama menolaknya sehingga segmen di ujung video panjang hilang
  // diam-diam.
  const match = value.match(/^(?:(\d{1,4}):)?(\d{1,4}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (match) {
    const hours = match[1] ? Number(match[1]) : 0;
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (seconds > 59) return null;
    const millis = match[4] ? Number(match[4].padEnd(3, '0')) : 0;
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  }

  const plain = Number(value.replace(',', '.'));
  if (Number.isFinite(plain) && plain >= 0) return Math.round(plain * 1000);
  return null;
}

// ---------------------------------------------------------------------------
// Sanity check + post-processing
// ---------------------------------------------------------------------------

/**
 * Rapi hasil akhir: hanya MENYUSUN, tidak mengubah batas waktu.
 *
 * Semua aturan batas (durasi video, 30-120 detik, tumpang tindih) sudah
 * diterapkan di resolveWindows SEBELUM deskripsi ditulis. Kalau fungsi ini
 * masih memangkas, deskripsi yang tampil tidak lagi cocok dengan clip-nya —
 * itu bug yang bikin hasil terasa tidak selaras.
 */
function sortByScore(segments: AISegment[]): AISegment[] {
  return [...segments]
    .map((s) => ({
      ...s,
      startMs: Math.max(0, Math.round(s.startMs)),
      endMs: Math.round(s.endMs),
      title: (s.title ?? '').trim() || 'Clip',
      reason: (s.reason ?? '').trim(),
      viralScore: clampScore(s.viralScore),
      // subjectX wajib ikut tersimpan — tanpa ini hasil crop selalu ke tengah
      // dan wajah pembicara bisa terpotong.
      ...(typeof s.subjectX === 'number' && Number.isFinite(s.subjectX)
        ? { subjectX: Math.max(0, Math.min(1, s.subjectX)) }
        : {}),
    }))
    .filter((s) => s.endMs - s.startMs >= MIN_CLIP_MS)
    .sort((a, b) => b.viralScore - a.viralScore);
}


/**
 * Sesuaikan segmen ke durasi file lokal.
 *
 * Penting untuk jalur "analisa dari link, potong dari file galeri": file yang
 * user pilih bisa versi lebih pendek dari video aslinya, sehingga timestamp dari
 * Gemini melewati ujung file. Dipakai juga untuk memberi tahu user kalau
 * videonya kemungkinan tidak cocok dengan yang dianalisa.
 */
export function clampSegmentsToDuration(
  segments: AISegment[],
  durationMs: number
): { segments: AISegment[]; clampedCount: number } {
  if (!durationMs || durationMs <= 0) {
    return { segments, clampedCount: 0 };
  }

  let clampedCount = 0;

  const adjusted = segments.map((s) => {
    const startMs = Math.max(0, Math.min(s.startMs, durationMs));
    const endMs = Math.min(s.endMs, durationMs);
    if (startMs !== s.startMs || endMs !== s.endMs) clampedCount += 1;
    return { ...s, startMs, endMs };
  });

  return {
    segments: adjusted.filter((s) => s.endMs - s.startMs >= MIN_CLIP_MS),
    clampedCount,
  };
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Format MM:SS — sama persis dengan yang diminta ke Gemini. */
function fmtTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
