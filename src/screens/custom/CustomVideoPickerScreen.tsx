import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/themes';
import { radius, spacing, type } from '../../theme/tokens';
import { pickVideoFromLibrary } from '../../services/useVideoPicker';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import StepIndicator from '../../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomVideoPicker'>;

const STEPS = ['Video', 'Atur', 'Potong', 'Selesai'];

export default function CustomVideoPickerScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    try {
      setLoading(true);
      const video = await pickVideoFromLibrary();
      if (video) {
        navigation.navigate('CustomTrim', { video });
      }
    } catch (e: any) {
      Alert.alert('Gagal memilih video', e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <StepIndicator steps={STEPS} current={0} style={styles.steps} />

      <View style={styles.hero}>
        <View style={styles.iconBubble}>
          <Ionicons name="images" size={30} color={colors.primaryBright} />
        </View>
      </View>

      <Text style={styles.title}>Pilih video sumber</Text>
      <Text style={styles.sub}>
        Setelah dipilih, kamu tentukan sendiri mau dipotong jadi berapa bagian
        dan di detik berapa saja.
      </Text>

      <Button
        title="Pilih dari Galeri"
        icon="albums-outline"
        onPress={handlePick}
        loading={loading}
      />

      <Card style={styles.tip} tone="raised">
        <View style={styles.tipRow}>
          <Ionicons name="bulb-outline" size={16} color={colors.primaryBright} />
          <Text style={styles.tipTitle}>Tips</Text>
        </View>
        <Text style={styles.tipText}>
          Tiap bagian minimal 30 detik. Kamu bisa menambah bagian sebanyak yang
          kamu mau, lalu menyimpannya semua sekaligus ke galeri.
        </Text>
      </Card>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingTop: spacing.lg },
  steps: { marginBottom: spacing.xxl },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, color: colors.text, textAlign: 'center' },
  sub: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  tip: { marginTop: spacing.xxl },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  tipTitle: { ...type.bodyStrong, color: colors.text },
  tipText: { ...type.small, color: colors.textMuted },
});
