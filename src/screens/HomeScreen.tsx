import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/themes';
import { radius, spacing, type, shadow, glow } from '../theme/tokens';
import Screen from '../components/Screen';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { getActiveApiKey } from '../services/apiKeyStore';
import { clearAppCache, formatBytes, getCacheInfo } from '../services/cacheService';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function Feature({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.feature}>
      <Ionicons name={icon} size={13} color={colors.primaryBright} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, meta, assets } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const toast = useToast();
  const [clearing, setClearing] = useState(false);

  // Kalau user sudah pernah menyimpan API key, langsung lewati langkah setup.
  const startAI = async () => {
    const key = await getActiveApiKey();
    navigation.navigate(key ? 'AIVideoPicker' : 'ApiKeySetup');
  };

  const handleClearCache = async () => {
    try {
      const info = await getCacheInfo();

      if (info.fileCount === 0) {
        toast.show({
          title: 'Cache sudah bersih',
          message: 'Tidak ada file sementara yang perlu dihapus.',
          variant: 'info',
        });
        return;
      }

      Alert.alert(
        'Bersihkan cache?',
        `${info.fileCount} file sementara (${formatBytes(info.totalBytes)}) akan ` +
          `dihapus dari penyimpanan aplikasi.\n\n` +
          `Klip yang sudah kamu simpan ke galeri TIDAK ikut terhapus.`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: async () => {
              setClearing(true);
              try {
                const result = await clearAppCache();
                toast.show({
                  title: 'Cache dibersihkan',
                  message: `${result.fileCount} file (${formatBytes(
                    result.totalBytes
                  )}) berhasil dihapus.`,
                });
              } catch (e: any) {
                Alert.alert('Gagal membersihkan cache', e?.message ?? String(e));
              } finally {
                setClearing(false);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Gagal memeriksa cache', e?.message ?? String(e));
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          {assets.logoMark ? (
            <Image source={assets.logoMark} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <Ionicons name="cut-outline" size={22} color={colors.onPrimary} />
          )}
        </View>
        <Text style={styles.brandName}>{meta.appName}</Text>
        <Pressable
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.heading}>Potong videonya, biarkan yang menarik yang tampil.</Text>
      <Text style={styles.sub}>
        Pilih satu mode di bawah. Tidak ada akun, tidak ada upload ke server kami.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.card, styles.cardAI, pressed && styles.pressed]}
        onPress={startAI}
      >
        {assets.heroPattern ? (
          <>
            <Image
              source={assets.heroPattern}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />
          </>
        ) : null}
        {assets.cornerOrnament ? (
          <Image
            source={assets.cornerOrnament}
            style={styles.cardOrnament}
            resizeMode="contain"
          />
        ) : null}
        <View style={styles.cardTop}>
          <View style={styles.iconBubble}>
            <Ionicons name="sparkles" size={20} color={colors.onPrimary} />
          </View>
          <Badge label="AI" icon="flash" tone="primary" />
        </View>

        <Text style={styles.cardTitle}>AI Auto-Clip</Text>
        <Text style={styles.cardDesc}>
          AI menonton videomu, mencari momen yang paling berpotensi viral, lalu
          memotongnya otomatis.
        </Text>

        <View style={styles.features}>
          <Feature icon="flame-outline" label="Deteksi momen viral" />
          <Feature icon="crop-outline" label="Auto 9:16 atau 1:1" />
          <Feature icon="cut-outline" label="Potong otomatis" />
        </View>

        <View style={styles.cardCTA}>
          <Text style={styles.cardCTAText}>Mulai</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryBright} />
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, styles.cardCustom, pressed && styles.pressed]}
        onPress={() => navigation.navigate('CustomVideoPicker')}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBubble, styles.iconBubbleMuted]}>
            <Ionicons name="options-outline" size={20} color={colors.primaryBright} />
          </View>
        </View>

        <Text style={styles.cardTitle}>Potong Manual</Text>
        <Text style={styles.cardDesc}>
          Kamu tentukan sendiri mau dipotong jadi berapa bagian dan di detik
          berapa saja.
        </Text>

        <View style={styles.cardCTA}>
          <Text style={styles.cardCTAText}>Atur sendiri</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primaryBright} />
        </View>
      </Pressable>

      <Button
        title="Bersihkan Cache"
        icon="trash-outline"
        variant="ghost"
        onPress={handleClearCache}
        loading={clearing}
        disabled={clearing}
        style={styles.clearBtn}
      />

      <Text style={styles.foot}>
        Mode AI butuh API key Google AI Studio. Videomu tidak diunggah ke server
        kami.
      </Text>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingTop: spacing.xl, gap: spacing.lg },
    brand: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    logo: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...glow(colors.primary),
    },
    logoImg: { width: '100%', height: '100%' },
    brandName: { ...type.h1, color: colors.text, marginLeft: spacing.md, flex: 1 },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: { ...type.display, color: colors.text },
    sub: { ...type.body, color: colors.textMuted, marginBottom: spacing.md },
    card: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      overflow: 'hidden',
    },
    heroScrim: { backgroundColor: colors.scrim },
    cardOrnament: {
      position: 'absolute',
      top: -16,
      right: -18,
      width: 136,
      height: 136,
      opacity: 0.55,
    },
    cardAI: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryDim,
      ...glow(colors.primary),
    },
  cardCustom: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    ...shadow.soft,
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleMuted: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryDim,
  },
  cardTitle: { ...type.h1, color: colors.text },
  cardDesc: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { ...type.small, color: colors.primaryBright },
  cardCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
  cardCTAText: { ...type.bodyStrong, color: colors.primaryBright },
  clearBtn: { marginTop: spacing.xs },
  foot: {
    ...type.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
