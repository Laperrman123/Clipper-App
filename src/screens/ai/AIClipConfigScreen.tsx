import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ClipRatio } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/themes';
import { radius, spacing, type } from '../../theme/tokens';
import { getYouTubeVideoId } from '../../services/youtubeTranscript';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import Badge from '../../components/Badge';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'AIClipConfig'>;

const RATIOS: ClipRatio[] = ['9:16', '1:1', '16:9'];
const PART_OPTIONS = [
  { n: 3, label: '3 clip' },
  { n: 5, label: '5 clip' },
  { n: 7, label: '7 clip' },
  { n: 10, label: '10 clip' },
];
const STEPS = ['Video', 'Atur', 'Analisis', 'Hasil'];

function Section({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

export default function AIClipConfigScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { video } = route.params;
  const [parts, setParts] = useState(5);
  const [ratio, setRatio] = useState<ClipRatio>('9:16');
  const [customPrompt, setCustomPrompt] = useState('');
  const [changeRatio, setChangeRatio] = useState(false);

  const videoId = getYouTubeVideoId(video.uri);
  const thumb = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const handleStart = () => {
    const trimmed = customPrompt.trim();
    navigation.navigate('AIAnalyzing', {
      video,
      parts,
      ratio,
      changeRatio,
      ...(trimmed ? { customPrompt: trimmed } : {}),
    });
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <StepIndicator steps={STEPS} current={1} style={styles.steps} />

      <Card style={styles.poster} tone="raised">
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.posterImage} resizeMode="cover" />
        ) : (
          <View style={[styles.posterImage, styles.posterFallback]}>
            <Ionicons name="videocam-outline" size={26} color={colors.primaryBright} />
          </View>
        )}
        <View style={styles.posterBody}>
          <Badge label="Sumber YouTube" icon="logo-youtube" tone="muted" />
          <Text style={styles.posterUrl} numberOfLines={1}>
            {video.uri}
          </Text>
        </View>
      </Card>

      <Section
        title="Jumlah bagian"
        hint="Tiap klip minimal 30 detik, tanpa batas maksimal. Kalau momennya panjang, klip tetap utuh sampai selesai."
      />
      <View style={styles.row}>
        {PART_OPTIONS.map((o) => (
          <Chip
            key={o.n}
            label={o.label}
            selected={parts === o.n}
            onPress={() => setParts(o.n)}
          />
        ))}
      </View>

      <Section
        title="Rasio output"
        hint={
          changeRatio
            ? 'Video akan di-crop dan diskalakan ke rasio di bawah. Resolusi aslinya tidak dipertahankan.'
            : 'Resolusi video asli dipertahankan. Rasio tidak dipakai untuk pemotongan.'
        }
      />
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

      <Section
        title="Instruksi khusus"
        hint="Tulis bebas momen apa yang kamu cari. Kalau dikosongkan, AI memilih momen yang paling menarik secara umum."
      />
      <TextInput
        style={styles.textarea}
        placeholder="Contoh: ambil bagian yang lucu, atau momen yang nyebut nominal"
        placeholderTextColor={colors.textFaint}
        value={customPrompt}
        onChangeText={setCustomPrompt}
        multiline
        textAlignVertical="top"
        maxLength={500}
      />

      <Button
        title="Mulai Analisis"
        icon="sparkles"
        onPress={handleStart}
        style={styles.cta}
      />
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingTop: spacing.lg },
  steps: { marginBottom: spacing.xl },
  poster: { padding: 0, overflow: 'hidden' },
  posterImage: { width: '100%', height: 168, backgroundColor: colors.surfaceAlt },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterBody: { padding: spacing.lg, gap: spacing.sm },
  posterUrl: { ...type.small, color: colors.textMuted },
  section: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { ...type.h2, color: colors.text },
  sectionHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowGap: { marginTop: spacing.sm },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    ...type.body,
    minHeight: 104,
  },
  cta: { marginTop: spacing.xxl },
});
