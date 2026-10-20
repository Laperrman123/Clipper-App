import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { radius, spacing, type } from '../../theme/tokens';
import { getActiveApiKey, addApiKey, setActiveApiKey } from '../../services/apiKeyStore';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Badge from '../../components/Badge';

type Props = NativeStackScreenProps<RootStackParamList, 'ApiKeySetup'>;

export default function ApiKeySetupScreen({ navigation }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [existingKey, setExistingKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    getActiveApiKey().then((k) => {
      if (k) setExistingKey(k);
    });
  }, []);

  const handleContinue = async () => {
    const keyToUse = apiKey.trim() || existingKey;
    if (!keyToUse) {
      Alert.alert('API key kosong', 'Masukkan API key Google AI Studio dulu.');
      return;
    }
    if (apiKey.trim()) {
      const entry = await addApiKey('', apiKey.trim());
      await setActiveApiKey(entry.id);
    }
    navigation.navigate('AIVideoPicker');
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.iconBubble}>
          <Ionicons name="key" size={22} color={colors.onPrimary} />
        </View>
        <Badge label="Langkah 1 · Siapkan" icon="flash" tone="primary" />
      </View>

      <Text style={styles.title}>Sambungkan ke Google AI Studio</Text>
      <Text style={styles.sub}>
        {existingKey
          ? 'Kamu sudah punya API key tersimpan. Tempel yang baru untuk mengganti, atau langsung lanjut.'
          : 'Tempel API key dari Google AI Studio untuk mengaktifkan analisis AI.'}
      </Text>

      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder="AIza..."
        placeholderTextColor={colors.textFaint}
        value={apiKey}
        onChangeText={setApiKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        style={styles.link}
        onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}
      >
        <Ionicons name="open-outline" size={15} color={colors.primaryBright} />
        <Text style={styles.linkText}>Belum punya API key? Buat di sini</Text>
      </Pressable>

      <Button
        title={existingKey ? 'Lanjut' : 'Simpan & Lanjut'}
        icon="arrow-forward"
        onPress={handleContinue}
        style={styles.button}
      />

      <Card style={styles.note} tone="raised">
        <View style={styles.noteRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.primaryBright} />
          <Text style={styles.noteTitle}>Aman di perangkatmu</Text>
        </View>
        <Text style={styles.noteText}>
          API key disimpan lewat SecureStore dan hanya dipakai untuk memanggil
          Gemini langsung dari app ini. Tidak ada server pihak ketiga yang
          menyimpannya.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { ...type.display, color: colors.text },
  sub: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    ...type.bodyStrong,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  linkText: { ...type.bodyStrong, color: colors.primaryBright },
  button: { width: '100%' },
  note: { marginTop: spacing.xxl },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  noteTitle: { ...type.bodyStrong, color: colors.text },
  noteText: { ...type.small, color: colors.textMuted },
});
