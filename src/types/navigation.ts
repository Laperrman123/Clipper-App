// Definisi seluruh route & parameter yang dibawa antar screen.
// Dipusatkan di sini supaya type-safe saat navigation.navigate(...)

export type ClipRatio = '9:16' | '1:1' | '16:9';

/**
 * 'file'   = video lokal dari galeri (butuh upload ke Gemini File API)
 * 'youtube'= URL YouTube public (dikirim langsung ke Gemini, tanpa download)
 */
export type VideoSource = 'file' | 'youtube';

export interface VideoAsset {
  uri: string;
  durationMs: number;
  fileName: string;
  source: VideoSource;
  /** Durasi asli dari YouTube belum tentu diketahui sebelum dianalisis. */
  durationKnown: boolean;
}

/** Tahapan analisis yang dilaporkan ke UI lewat onProgress. */
export type AnalysisStage =
  | 'preparing'
  | 'uploading'
  | 'outline'
  | 'refining'
  | 'framing'
  | 'done';

export interface AnalysisProgress {
  stage: AnalysisStage;
  /** 0-100, perkiraan kasar untuk progress bar. */
  percent: number;
  message: string;
}

// Hasil analisis satu segmen dari Gemini
export interface AISegment {
  startMs: number;
  endMs: number;
  title: string;
  reason: string;
  viralScore: number; // 0-100
  /**
   * Keyakinan Gemini soal ketepatan batas potong klip ini, setelah audio
   * dicek ulang. 'low' = perlu dicek manual sebelum dipakai.
   */
  confidence?: 'high' | 'medium' | 'low';
  /**
   * Kalimat verbatim yang jadi pembuka klip, diambil dari transkrip asli.
   * Dipakai user buat cek apakah batas klipnya benar-benar pas.
   */
  quote?: string;
  /**
   * Posisi horizontal subjek utama: 0 = kiri, 0.5 = tengah, 1 = kanan.
   * Dipakai supaya crop ke 9:16 / 1:1 membingkai orangnya, bukan asal tengah.
   * Estimasi Gemini dari video, jadi tidak presisi piksel-perfect.
   */
  subjectX?: number;
}

// Satu segmen custom yang didefinisikan manual oleh user
export interface CustomSegment {
  id: string;
  startMs: number;
  endMs: number;
}

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;

  // --- Alur Mode AI ---
  ApiKeySetup: undefined;
  AIVideoPicker: undefined;
  AIClipConfig: { video: VideoAsset };
  AIAnalyzing: {
    video: VideoAsset;
    parts: number;
    ratio: ClipRatio;
    /** Instruksi bebas dari user untuk memandu pemilihan momen. */
    customPrompt?: string;
    /** false = potong tanpa ubah resolusi (default). true = crop+scale ke rasio. */
    changeRatio?: boolean;
  };
  AIResult: { video: VideoAsset; segments: AISegment[]; ratio: ClipRatio; changeRatio?: boolean };

  // --- Alur Mode Custom ---
  CustomVideoPicker: undefined;
  CustomTrim: { video: VideoAsset };
  CustomProcessing: {
    video: VideoAsset;
    segments: CustomSegment[];
    /** Rasio output yang dipilih di layar Atur. */
    ratio: ClipRatio;
    /** false = potong tanpa ubah resolusi (default). true = crop+scale ke rasio. */
    changeRatio?: boolean;
  };
  CustomResult: { video: VideoAsset; outputPaths: string[] };
};