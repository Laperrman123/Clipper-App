import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { radius, spacing, type } from '../../theme/tokens';
import { cutVideoSegments } from '../../services/ffmpegService';
import Screen from '../../components/Screen';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomProcessing'>;

const STEPS = ['Video', 'Atur', 'Potong', 'Selesai'];

export default function CustomProcessingScreen({ route, navigation }: Props) {
  const { video, segments, ratio, changeRatio } = route.params;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const run = async () => {
      try {
        const outputPaths = await cutVideoSegments(video.uri, segments, {
          ratio,
          preserveResolution: !changeRatio,
        });
        navigation.replace('CustomResult', { video, outputPaths });
      } catch (e: any) {
        Alert.alert('Pemotongan gagal', e.message ?? String(e), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    };
    run();
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepIndicator steps={STEPS} current={2} style={styles.steps} />

      <View style={styles.body}>
        <View style={styles.orbWrap}>
          <Animated.View style={[styles.orbRing, { transform: [{ scale }], opacity }]} />
          <View style={styles.orb}>
            <Ionicons name="cut-outline" size={30} color={colors.onPrimary} />
          </View>
        </View>

        <Text style={styles.title}>Memotong videomu</Text>
        <Text style={styles.sub}>
          Sedang memproses {segments.length} bagian. Jangan tutup aplikasi dulu.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg },
  steps: { marginBottom: spacing.xxl },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbWrap: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  orbRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  orb: {
    width: 80,
    height: 80,
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
  title: { ...type.h1, color: colors.text, marginTop: spacing.xl },
  sub: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
