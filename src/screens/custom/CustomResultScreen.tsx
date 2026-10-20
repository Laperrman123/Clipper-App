import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { radius, spacing, type } from '../../theme/tokens';
import { saveClipsToGallery } from '../../services/galleryService';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import StepIndicator from '../../components/StepIndicator';
import { useToast } from '../../components/Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomResult'>;

const STEPS = ['Video', 'Atur', 'Potong', 'Selesai'];

function basename(path: string) {
  const clean = path.replace('file://', '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || clean;
}

export default function CustomResultScreen({ route }: Props) {
  const { outputPaths } = route.params;
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const { saved: ok, failed } = await saveClipsToGallery(outputPaths);

      if (ok > 0) setSaved(true);

      if (failed > 0) {
        toast.show({
          variant: 'info',
          title: 'Sebagian tersimpan',
          message: `${ok} klip tersimpan, ${failed} gagal. Coba lagi untuk yang gagal.`,
        });
      } else {
        toast.show({
          title: ok > 1 ? `${ok} klip tersimpan di galeri` : 'Klip tersimpan di galeri',
          message: 'Semua hasil potongan sudah bisa kamu share.',
        });
      }
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const Header = (
    <View>
      <StepIndicator steps={STEPS} current={3} style={styles.steps} />
      <View style={styles.heroRow}>
        <View style={styles.checkBubble}>
          <Ionicons name="checkmark-done" size={24} color={colors.success} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{outputPaths.length} video siap</Text>
          <Text style={styles.heroSub}>Sudah dipotong, belum disimpan ke galeri.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Screen bare>
      <FlatList
        data={outputPaths}
        keyExtractor={(item) => item}
        style={styles.flex}
        contentContainerStyle={styles.list}
        ListHeaderComponent={Header}
        renderItem={({ item, index }) => (
          <Card style={styles.card}>
            <View style={styles.indexBubble}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.title}>Bagian {index + 1}</Text>
              <Text style={styles.path} numberOfLines={1}>
                {basename(item)}
              </Text>
            </View>
            <Ionicons name="videocam-outline" size={18} color={colors.textFaint} />
          </Card>
        )}
      />

      <View style={styles.footer}>
        <Button
          title={saved ? 'Semua Tersimpan' : 'Simpan Semua ke Galeri'}
          icon={saved ? 'checkmark-circle' : 'download-outline'}
          variant={saved ? 'secondary' : 'primary'}
          onPress={handleSaveAll}
          loading={saving}
          disabled={saving || saved}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { marginBottom: spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  checkBubble: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: { ...type.h1, color: colors.text },
  heroSub: { ...type.small, color: colors.textMuted, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  cardBody: { flex: 1 },
  title: { ...type.bodyStrong, color: colors.text },
  path: { ...type.small, color: colors.textFaint, marginTop: 2 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundDeep,
  },
});
