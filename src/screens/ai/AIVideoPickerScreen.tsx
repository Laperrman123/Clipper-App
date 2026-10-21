import React, { useMemo, useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  Alert,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/themes';
import { radius, spacing, type } from '../../theme/tokens';
import { isValidYouTubeUrl, makeYouTubeAsset } from '../../services/youtubeSource';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'AIVideoPicker'>;

const STEPS = ['Video', 'Atur', 'Analisis', 'Hasil'];

export default function AIVideoPickerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleAnalyze = () => {
    if (!isValidYouTubeUrl(youtubeUrl)) {
      Alert.alert(
        'URL tidak valid',
        'Masukkan URL YouTube, contoh:\nhttps://www.youtube.com/watch?v=xxxx'
      );
      return;
    }

    try {
      setLoading(true);
      const video = makeYouTubeAsset(youtubeUrl);
      navigation.navigate('AIClipConfig', { video });
    } catch (e: any) {
      Alert.alert('URL tidak valid', e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const disabled = !youtubeUrl.trim();

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <StepIndicator steps={STEPS} current={0} style={styles.steps} />

      <View style={styles.heroRow}>
        <View style={styles.iconBubble}>
          <Ionicons name="link" size={20} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>Tempel link YouTube</Text>
      </View>
      <Text style={styles.sub}>
        Analisis membaca transkrip milik video itu, jadi batas potongannya jauh
        lebih tepat. Hanya video publik yang bisa dibaca.
      </Text>

      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder="https://www.youtube.com/watch?v=..."
        placeholderTextColor={colors.textFaint}
        value={youtubeUrl}
        onChangeText={setYoutubeUrl}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        multiline
      />

      <Button
        title="Analisis Video"
        icon="sparkles"
        onPress={handleAnalyze}
        loading={loading}
        disabled={disabled}
      />

      <Card style={styles.note} tone="raised">
        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primaryBright} />
          <Text style={styles.noteTitle}>Tentang audio</Text>
        </View>
        <Text style={styles.noteText}>
          Klip yang dihasilkan sudah membawa suara. Saat mengunduh file videonya,
          pilih kualitas yang menggabungkan video + audio supaya hasil potongan
          tidak bisu.
        </Text>
      </Card>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingTop: spacing.lg },
  steps: { marginBottom: spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { ...type.h1, color: colors.text, flex: 1 },
  sub: { ...type.body, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    ...type.bodyStrong,
    minHeight: 84,
    marginBottom: spacing.lg,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  note: { marginTop: spacing.xxl },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  noteTitle: { ...type.bodyStrong, color: colors.text },
  noteText: { ...type.small, color: colors.textMuted },
});
