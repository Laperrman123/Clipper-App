import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, AISegment, VideoAsset } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha, type ThemeColors } from '../../theme/themes';
import { radius, spacing, type } from '../../theme/tokens';
import { cutSingleSegment } from '../../services/ffmpegService';
import { saveClipToGallery } from '../../services/galleryService';
import { pickVideoFromLibrary } from '../../services/useVideoPicker';
import { clampSegmentsToDuration } from '../../services/geminiService';
import { clearAppCache, formatBytes, getCacheInfo } from '../../services/cacheService';
import { formatClock } from '../../utils/time';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import StepIndicator from '../../components/StepIndicator';
import { useToast } from '../../components/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AIResult'>;

const STEPS = ['Video', 'Atur', 'Analisis', 'Hasil'];

export default function AIResultScreen({ route, navigation }: Props) {
  const { colors, assets } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { video, ratio, changeRatio } = route.params;
  const toast = useToast();

  const [cutSource, setCutSource] = useState<VideoAsset | null>(
    video.source === 'file' ? video : null
  );
  const [segments, setSegments] = useState<AISegment[]>(route.params.segments);

  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [results, setResults] = useState<Record<number, string>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyTitle = async (title: string, index: number) => {
    Clipboard.setString(title);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1400);
  };

  const handleAttachVideo = async () => {
    try {
      setAttaching(true);
      const local = await pickVideoFromLibrary();
      if (!local) return;

      const { segments: clamped, clampedCount } = clampSegmentsToDuration(
        segments,
        local.durationMs
      );

      setCutSource(local);
      setSegments(clamped);

      if (clampedCount > 0) {
        Alert.alert(
          'Durasi file berbeda',
          `${clampedCount} dari ${segments.length} momen melebihi durasi file ini ` +
            `(${formatClock(local.durationMs)}), jadi batasnya sudah disesuaikan.\n\n` +
            `Kalau hasilnya terasa tidak nyambung, berarti file yang kamu pilih ` +
            `bukan video yang sama dengan yang dianalisa.`,
          [{ text: 'Lanjut saja' }]
        );
      } else if (clamped.length === 0) {
        Alert.alert(
          'Tidak ada momen yang cocok',
          'Tidak satu pun momen hasil analisis muat di file ini. Pastikan file yang ' +
            'kamu pilih adalah video yang sama.'
        );
        setCutSource(null);
      }
    } catch (e: any) {
      Alert.alert('Gagal memilih video', e.message ?? String(e));
    } finally {
      setAttaching(false);
    }
  };

  const handleCut = async (segment: AISegment, index: number) => {
    if (!cutSource) return;

    try {
      setBusyIndex(index);

      let output = results[index];
      if (!output) {
        output = await cutSingleSegment(
          cutSource.uri,
          {
            startMs: segment.startMs,
            endMs: segment.endMs,
            subjectX: segment.subjectX,
          },
          { ratio, preserveResolution: !changeRatio }
        );
      }

      setBusyIndex(index);
      await saveClipToGallery(output);
      setResults((prev) => ({ ...prev, [index]: output }));

      toast.show({
        title: 'Klip tersimpan di galeri',
        message: `"${segment.title}" sudah bisa kamu share.`,
      });
    } catch (e: any) {
      Alert.alert('Gagal memotong', e.message ?? String(e));
    } finally {
      setBusyIndex(null);
    }
  };

  const needsVideo = !cutSource;

  /**
   * Reset sesi: hapus file sementara hasil potong, lalu kembali ke pemilihan
   * video. Klip yang sudah disimpan ke galeri aman karena MediaStore sudah
   * menyalinnya keluar dari folder cache aplikasi.
   */
  const handleReset = useCallback(async () => {
    if (busyIndex !== null || attaching || clearing) return;

    const info = await getCacheInfo();
    const detail =
      info.fileCount > 0
        ? `${info.fileCount} file sementara (${formatBytes(info.totalBytes)}) akan dihapus.`
        : 'Tidak ada file sementara yang tersisa.';

    Alert.alert(
      'Hapus hasil analisis?',
      `${detail}\n\nKamu akan kembali ke pemilihan video. Klip yang sudah ` +
        `tersimpan di galeri tidak ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus & Mulai Lagi',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await clearAppCache();
            } catch {
              // Gagal hapus bukan alasan menahan user: file sisa tidak berbahaya
              // dan akan dibersihkan lagi dari Home.
            }
            setClearing(false);

            navigation.reset({
              index: 1,
              routes: [{ name: 'Home' }, { name: 'AIVideoPicker' }],
            });
          },
        },
      ]
    );
  }, [attaching, busyIndex, clearing, navigation]);

  // Tombol reset cepat di header — daftar klip bisa panjang, jadi jangan
  // sampai user harus scroll ke paling bawah untuk memulai video berikutnya.
  const resetDisabled = clearing || attaching || busyIndex !== null;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleReset}
          disabled={resetDisabled}
          hitSlop={10}
          style={({ pressed }) => [pressed && !resetDisabled && styles.pressedIcon]}
        >
          <Ionicons
            name="trash-outline"
            size={21}
            color={resetDisabled ? colors.textFaint : colors.primaryBright}
          />
        </Pressable>
      ),
    });
  }, [navigation, handleReset, resetDisabled, styles, colors]);

  const Header = (
    <View>
      <StepIndicator steps={STEPS} current={3} style={styles.steps} />

      <Text style={styles.heroTitle}>
        {segments.length} momen siap dipotong
      </Text>
      <Text style={styles.heroSub}>
        {changeRatio ? `Sudah dibingkai ke rasio ${ratio}.` : 'Resolusi video asli dipertahankan.'}
      </Text>

      <Card
        tone={needsVideo ? 'default' : 'accent'}
        style={styles.banner}
      >
        <View style={styles.bannerRow}>
          <Ionicons
            name={needsVideo ? 'cloud-upload-outline' : 'checkmark-circle'}
            size={20}
            color={needsVideo ? colors.primaryBright : colors.success}
          />
          <Text style={styles.bannerText}>
            {needsVideo
              ? 'Pasang file video yang sama dari galeri untuk mulai memotong.'
              : `Video terpasang · ${formatClock(cutSource.durationMs)}`}
          </Text>
        </View>

        <Button
          title={needsVideo ? 'Pilih Video dari Galeri' : 'Ganti Video'}
          icon={needsVideo ? 'images-outline' : 'swap-horizontal-outline'}
          variant={needsVideo ? 'primary' : 'secondary'}
          onPress={handleAttachVideo}
          loading={attaching}
          disabled={attaching || busyIndex !== null}
          style={styles.bannerBtn}
        />
      </Card>
    </View>
  );

  return (
    <Screen bare>
      <FlatList
        data={segments}
        keyExtractor={(_, i) => String(i)}
        style={styles.flex}
        contentContainerStyle={styles.list}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {assets.emptyState ? (
              <Image
                source={assets.emptyState}
                style={styles.emptyImg}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.empty}>
              Tidak ada momen yang muat di durasi video ini.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              title="Selesai & Analisis Video Lain"
              icon="refresh-outline"
              variant="secondary"
              onPress={handleReset}
              loading={clearing}
              disabled={clearing || attaching || busyIndex !== null}
            />
            <Text style={styles.footerHint}>
              File sementara akan dihapus. Klip yang sudah disimpan ke galeri
              tetap aman.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const busy = busyIndex === index;
          const output = results[index];
          return (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.indexBubble}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.headBody}>
                  <Pressable
                    style={styles.titleRow}
                    onPress={() => handleCopyTitle(item.title, index)}
                  >
                    <Text style={styles.title} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Ionicons
                      name={copiedIndex === index ? 'checkmark' : 'copy-outline'}
                      size={15}
                      color={copiedIndex === index ? colors.success : colors.textMuted}
                    />
                  </Pressable>
                  <View style={styles.metaRow}>
                    <Badge
                      label={`${formatClock(item.startMs)}–${formatClock(item.endMs)}`}
                      icon="time-outline"
                      tone="muted"
                    />
                    <Badge label={formatClock(item.endMs - item.startMs)} tone="muted" />
                  </View>
                </View>
                <View style={styles.scoreWrap}>
                  <Ionicons name="flame" size={14} color={colors.accent} />
                  <Text style={styles.score}>{item.viralScore}</Text>
                </View>
              </View>

              <Text style={styles.reason}>{item.reason}</Text>

              {item.quote ? (
                <View style={styles.quoteBox}>
                  <Text style={styles.quoteText}>“{item.quote}”</Text>
                </View>
              ) : null}

              {item.confidence === 'low' ? (
                <View style={styles.warnRow}>
                  <Ionicons name="warning-outline" size={13} color={colors.accent} />
                  <Text style={styles.warnText}>
                    Batas potong kurang yakin — cek dulu sebelum dipakai.
                  </Text>
                </View>
              ) : null}

              {changeRatio && typeof item.subjectX === 'number' ? (
                <View style={styles.subjectRow}>
                  <Text style={styles.subjectLabel}>
                    Subjek{' '}
                    {item.subjectX < 0.42
                      ? 'kiri'
                      : item.subjectX > 0.58
                        ? 'kanan'
                        : 'tengah'}
                  </Text>
                  <Slider
                    style={styles.subjectSlider}
                    value={item.subjectX}
                    onValueChange={(value) => {
                      setSegments((prev) =>
                        prev.map((seg, i) =>
                          i === index ? { ...seg, subjectX: value } : seg
                        )
                      );
                    }}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.01}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primaryBright}
                  />
                </View>
              ) : null}

              {needsVideo ? (
                <Text style={styles.hint}>Pasang video dulu untuk memotong</Text>
              ) : (
                <Button
                  title={output ? 'Simpan Lagi' : 'Potong & Simpan'}
                  icon={output ? 'refresh' : 'cut-outline'}
                  variant={output ? 'secondary' : 'primary'}
                  onPress={() => handleCut(item, index)}
                  loading={busy}
                  disabled={busyIndex !== null}
                  style={styles.exportBtn}
                />
              )}

              {output ? (
                <View style={styles.savedRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.savedBadge}>Sudah tersimpan di galeri</Text>
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  steps: { marginBottom: spacing.xl },
  heroTitle: { ...type.display, color: colors.text },
  heroSub: { ...type.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.lg },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  bannerText: { ...type.body, color: colors.text, flex: 1 },
  bannerBtn: { width: '100%' },
    empty: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
    emptyWrap: { alignItems: 'center', paddingTop: spacing.xl },
    emptyImg: { width: 168, height: 168, opacity: 0.9 },
  card: { gap: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  indexBubble: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { ...type.h2, color: colors.primaryBright },
  headBody: { flex: 1, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...type.h2, color: colors.text, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    scoreWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: withAlpha(colors.accent, 0.12),
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
  score: { ...type.mono, color: colors.accent },
  reason: { ...type.body, color: colors.textMuted },
  quoteBox: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.primaryDim,
  },
  quoteText: { ...type.small, color: colors.textMuted, fontStyle: 'italic' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { ...type.small, color: colors.accent, flex: 1 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subjectLabel: { ...type.small, color: colors.textMuted, width: 70 },
  subjectSlider: { flex: 1 },
  hint: { ...type.small, color: colors.textFaint, fontStyle: 'italic' },
  exportBtn: { marginTop: spacing.xs },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedBadge: { ...type.small, color: colors.success },
  footer: { marginTop: spacing.xl, gap: spacing.sm },
  footerHint: {
    ...type.small,
    color: colors.textFaint,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressedIcon: { opacity: 0.6 },
});
