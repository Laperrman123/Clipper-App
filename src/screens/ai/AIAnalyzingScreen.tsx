import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { radius, spacing, type } from '../../theme/tokens';
import { getApiKey } from '../../services/apiKeyStore';
import { analyzeVideoWithGemini } from '../../services/geminiService';
import Screen from '../../components/Screen';
import ProgressBar from '../../components/ProgressBar';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'AIAnalyzing'>;

const STEPS = ['Video', 'Atur', 'Analisis', 'Hasil'];

/** Langkah besar yang ditampilkan ke user, dipetakan dari persen progres. */
const PHASES = [
  { label: 'Menyiapkan video', until: 20 },
  { label: 'Membaca transkrip', until: 50 },
  { label: 'Mencari momen terbaik', until: 88 },
  { label: 'Menyusun hasil', until: 101 },
];

function phaseIndex(percent: number) {
  const i = PHASES.findIndex((p) => percent < p.until);
  return i === -1 ? PHASES.length - 1 : i;
}

export default function AIAnalyzingScreen({ route, navigation }: Props) {
  const { video, parts, ratio, customPrompt, changeRatio } = route.params;
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState('Menyiapkan...');

  const abortRef = useRef({ aborted: false });
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const signal = abortRef.current;

    const run = async () => {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) throw new Error('API key tidak ditemukan.');

        const { segments, durationMs } = await analyzeVideoWithGemini(
          { apiKey, video, parts, ratio, customPrompt, changeRatio },
          {
            signal,
            onFallback: (msg) => setMessage(msg),
            onProgress: (p) => {
              setPercent(p.percent);
              setMessage(p.message);
            },
          }
        );

        if (signal.aborted) return;
        navigation.replace('AIResult', {
          video: { ...video, durationMs, durationKnown: durationMs > 0 },
          segments,
          ratio,
          changeRatio,
        });
      } catch (e: any) {
        if (signal.aborted) return;
        Alert.alert('Analisis gagal', e.message ?? String(e), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    };

    run();
    return () => {
      signal.aborted = true;
    };
  }, []);

  const active = phaseIndex(percent);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <StepIndicator steps={STEPS} current={2} style={styles.steps} />

      <View style={styles.orbWrap}>
        <Animated.View
          style={[
            styles.orbRing,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <View style={styles.orb}>
          <Ionicons name="sparkles" size={30} color={colors.onPrimary} />
        </View>
      </View>

      <Text style={styles.title}>AI sedang menonton videomu</Text>
      <Text style={styles.sub}>{message}</Text>

      <ProgressBar percent={percent} label="Progres" />

      <View style={styles.checklist}>
        {PHASES.map((p, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <View key={p.label} style={styles.checkRow}>
              <Ionicons
                name={
                  done
                    ? 'checkmark-circle'
                    : current
                      ? 'ellipse'
                      : 'ellipse-outline'
                }
                size={18}
                color={done ? colors.success : current ? colors.primary : colors.textFaint}
              />
              <Text
                style={[
                  styles.checkText,
                  (done || current) && styles.checkTextActive,
                ]}
              >
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.note}>
        Jangan tutup aplikasi selama proses ini. Untuk video panjang, analisis
        bisa memakan waktu beberapa menit.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, alignItems: 'center' },
  steps: { alignSelf: 'stretch', marginBottom: spacing.xxl },
  orbWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  orbRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  orb: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  title: { ...type.h1, color: colors.text, marginTop: spacing.xl, textAlign: 'center' },
  sub: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl, textAlign: 'center' },
  checklist: {
    alignSelf: 'stretch',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkText: { ...type.body, color: colors.textFaint },
  checkTextActive: { color: colors.text },
  note: {
    ...type.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
