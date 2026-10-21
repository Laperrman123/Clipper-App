import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, CustomSegment, ClipRatio } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha, type ThemeColors } from '../../theme/themes';
import { radius, spacing, type } from '../../theme/tokens';
import { formatClock } from '../../utils/time';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import Badge from '../../components/Badge';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomTrim'>;

const STEPS = ['Video', 'Atur', 'Potong', 'Selesai'];
const RATIOS: ClipRatio[] = ['9:16', '1:1', '16:9'];
/** Panjang default tiap bagian — harus ≥ MIN_CLIP_MS supaya langsung lolos validasi. */
const MIN_CLIP_MS = 30_000;

function makeSegment(id: string, startMs: number, endMs: number): CustomSegment {
  return { id, startMs, endMs };
}

export default function CustomTrimScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { video } = route.params;
  const duration = video.durationMs || 60000;
  /**
   * Video yang durasinya di bawah 30 detik tidak mungkin memenuhi syarat
   * minimal 30 detik. Untuk kasus itu batas minimalnya mengikuti durasi video,
   * supaya user tetap bisa memotong.
   */
  const minClipMs = Math.min(MIN_CLIP_MS, duration);

  const [ratio, setRatio] = useState<ClipRatio>('9:16');
  const [changeRatio, setChangeRatio] = useState(false);
  const [segments, setSegments] = useState<CustomSegment[]>([
    makeSegment('1', 0, Math.min(minClipMs, duration)),
  ]);

  const updateSegment = (id: string, patch: Partial<CustomSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSegment = () => {
    const nextId = String(segments.length + 1);
    setSegments((prev) => [...prev, makeSegment(nextId, 0, Math.min(minClipMs, duration))]);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleProcess = () => {
    const invalid = segments.find((s) => s.endMs <= s.startMs);
    if (invalid) {
      Alert.alert('Rentang waktu tidak valid', 'Waktu akhir harus lebih besar dari waktu mulai.');
      return;
    }
    const tooShort = segments.find((s) => s.endMs - s.startMs < minClipMs);
    if (tooShort) {
      Alert.alert(
        'Durasi terlalu pendek',
        `Durasi setiap bagian minimal ${Math.round(minClipMs / 1000)} detik.`
      );
      return;
    }
    navigation.navigate('CustomProcessing', { video, segments, ratio, changeRatio });
  };

  return (
    <Screen bare>
      <View style={styles.top}>
        <StepIndicator steps={STEPS} current={1} style={styles.steps} />
        <Card tone="raised" style={styles.infoCard}>
          <Ionicons name="film-outline" size={18} color={colors.primaryBright} />
          <Text style={styles.infoText}>Durasi video</Text>
          <Badge label={formatClock(duration)} icon="time-outline" tone="primary" />
        </Card>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.ratioCard}>
          <View style={styles.ratioHead}>
            <Ionicons name="crop-outline" size={16} color={colors.primaryBright} />
            <Text style={styles.ratioTitle}>Rasio output</Text>
          </View>
          <Text style={styles.ratioHint}>
            {changeRatio
              ? 'Video akan di-crop dan diskalakan ke rasio di bawah. Resolusi aslinya tidak dipertahankan.'
              : 'Resolusi video asli dipertahankan. Rasio tidak dipakai untuk pemotongan.'}
          </Text>
          <View style={styles.row}>
            {RATIOS.map((r) => (
              <Chip key={r} label={r} selected={ratio === r} onPress={() => setRatio(r)} />
            ))}
          </View>
          <View style={[styles.row, styles.rowGap]}>
            <Chip
              label="Crop ke rasio"
              icon={changeRatio ? 'checkmark-circle' : 'ellipse-outline'}
              selected={changeRatio}
              onPress={() => setChangeRatio((v) => !v)}
            />
          </View>
        </Card>

        {segments.map((seg, idx) => (
          <Card key={seg.id} style={styles.segmentCard}>
            <View style={styles.segmentHeader}>
              <View style={styles.segTitleRow}>
                <View style={styles.segIndex}>
                  <Text style={styles.segIndexText}>{idx + 1}</Text>
                </View>
                <Text style={styles.segmentTitle}>Bagian {idx + 1}</Text>
              </View>
              {segments.length > 1 && (
                <Pressable
                  onPress={() => removeSegment(seg.id)}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              )}
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Mulai</Text>
              <Badge label={formatClock(seg.startMs)} tone="muted" />
            </View>
            <Slider
              minimumValue={0}
              maximumValue={duration}
              value={seg.startMs}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primaryBright}
              onValueChange={(v) =>
                updateSegment(seg.id, { startMs: Math.min(v, seg.endMs - 1000) })
              }
            />

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Selesai</Text>
              <Badge label={formatClock(seg.endMs)} tone="muted" />
            </View>
            <Slider
              minimumValue={0}
              maximumValue={duration}
              value={seg.endMs}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primaryBright}
              onValueChange={(v) =>
                updateSegment(seg.id, { endMs: Math.max(v, seg.startMs + 1000) })
              }
            />

            <View style={styles.segFooter}>
              <Ionicons name="cut-outline" size={14} color={colors.primaryBright} />
              <Text style={styles.segDuration}>
                Panjang klip {formatClock(seg.endMs - seg.startMs)}
              </Text>
            </View>
          </Card>
        ))}

        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={addSegment}
        >
          <Ionicons name="add" size={18} color={colors.primaryBright} />
          <Text style={styles.addButtonText}>Tambah bagian</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={`Potong Jadi ${segments.length} Video`}
          icon="cut-outline"
          onPress={handleProcess}
        />
      </View>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  steps: { marginBottom: spacing.lg },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText: { ...type.bodyStrong, color: colors.text, flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  ratioCard: { gap: spacing.sm },
  ratioHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratioTitle: { ...type.h2, color: colors.text },
  ratioHint: { ...type.small, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowGap: { marginTop: spacing.sm },
  segmentCard: { gap: spacing.sm },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  segTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segIndex: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segIndexText: { ...type.mono, color: colors.primaryBright },
  segmentTitle: { ...type.h2, color: colors.text },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.danger, 0.12),
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sliderLabel: { ...type.label, color: colors.textMuted },
  segFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  segDuration: { ...type.small, color: colors.primaryBright, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryDim,
    borderStyle: 'dashed',
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.85 },
  addButtonText: { ...type.bodyStrong, color: colors.primaryBright },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundDeep,
  },
});
