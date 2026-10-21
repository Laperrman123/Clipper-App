import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useTheme } from '../theme/ThemeContext';
import {
  themes,
  themeAssets,
  themeMeta,
  withAlpha,
  type ThemeColors,
  type ThemeKey,
} from '../theme/themes';
import { radius, spacing, type, glow } from '../theme/tokens';
import {
  ApiKeyEntry,
  addApiKey,
  getActiveApiKeyId,
  listApiKeys,
  removeApiKey,
  setActiveApiKey,
  updateApiKey,
} from '../services/apiKeyStore';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface Editor {
  id?: string;
  label: string;
  value: string;
}

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export default function SettingsScreen({ navigation }: Props) {
  const { colors, themeKey, setThemeKey, assets } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [list, active] = await Promise.all([listApiKeys(), getActiveApiKeyId()]);
    setKeys(list);
    setActiveId(active);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSave = async () => {
    if (!editor) return;
    if (!editor.value.trim()) {
      Alert.alert('API key kosong', 'Masukkan nilai API key dulu.');
      return;
    }
    try {
      setSaving(true);
      if (editor.id) {
        await updateApiKey(editor.id, { label: editor.label, value: editor.value });
      } else {
        const entry = await addApiKey(editor.label, editor.value);
        await setActiveApiKey(entry.id);
      }
      setEditor(null);
      await load();
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: ApiKeyEntry) => {
    Alert.alert(
      'Hapus API key?',
      `"${entry.label || 'API key'}" akan dihapus dari perangkat ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await removeApiKey(entry.id);
            await load();
          },
        },
      ]
    );
  };

  const handleSetActive = async (id: string) => {
    await setActiveApiKey(id);
    await load();
  };

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.heroRow}>
        <View style={styles.iconBubble}>
          <Ionicons name="key" size={20} color={colors.onPrimary} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>API Key Google</Text>
          <Text style={styles.sub}>
            Simpan sekali, pakai seterusnya. Kamu bisa menambah beberapa key dan
            memilih mana yang aktif.
          </Text>
        </View>
      </View>

      <Card style={styles.themeCard} tone="raised">
        <Text style={styles.themeTitle}>Tema Tampilan</Text>
        <Text style={styles.themeHint}>Ganti warna aplikasi seketika.</Text>
        <View style={styles.themeRow}>
          {(['purple', 'naruto'] as ThemeKey[]).map((key) => {
            const t = themes[key];
            const active = key === themeKey;
            return (
              <Pressable
                key={key}
                onPress={() => setThemeKey(key)}
                style={[styles.themeOption, active && styles.themeOptionActive]}
              >
                <View style={[styles.themePreview, { backgroundColor: t.background }]}>
                  {themeAssets[key].logoMark ? (
                    <Image
                      source={themeAssets[key].logoMark}
                      style={styles.themeLogo}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={[styles.swatch, { backgroundColor: t.primary }]} />
                  <View style={[styles.swatch, { backgroundColor: t.accent }]} />
                  {!themeAssets[key].logoMark ? (
                    <View style={[styles.swatch, { backgroundColor: t.surfaceHi }]} />
                  ) : null}
                </View>
                <View style={styles.themeLabelRow}>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={15} color={colors.primaryBright} />
                  ) : null}
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                    {themeMeta[key].label}
                  </Text>
                </View>
                <Text style={styles.themeTagline}>{themeMeta[key].tagline}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {assets.divider ? (
        <Image source={assets.divider} style={styles.divider} resizeMode="contain" />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          {keys.length === 0 ? (
            <Card style={styles.emptyCard} tone="raised">
              <Ionicons name="key-outline" size={22} color={colors.textFaint} />
              <Text style={styles.emptyText}>Belum ada API key tersimpan.</Text>
            </Card>
          ) : (
            keys.map((entry) => {
              const isActive = entry.id === activeId;
              return (
                <Card key={entry.id} style={styles.keyCard} tone={isActive ? 'accent' : 'default'}>
                  <Pressable
                    style={styles.keyMain}
                    onPress={() => handleSetActive(entry.id)}
                  >
                    <Ionicons
                      name={isActive ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isActive ? colors.primaryBright : colors.textFaint}
                    />
                    <View style={styles.keyBody}>
                      <View style={styles.keyLabelRow}>
                        <Text style={styles.keyLabel} numberOfLines={1}>
                          {entry.label || 'API key'}
                        </Text>
                        {isActive ? <Badge label="Aktif" tone="primary" /> : null}
                      </View>
                      <Text style={styles.keyValue}>{mask(entry.value)}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.keyActions}>
                    <Pressable
                      style={styles.iconBtn}
                      onPress={() =>
                        setEditor({ id: entry.id, label: entry.label, value: entry.value })
                      }
                      hitSlop={6}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.primaryBright} />
                    </Pressable>
                    <Pressable
                      style={[styles.iconBtn, styles.iconBtnDanger]}
                      onPress={() => handleDelete(entry)}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}

          {editor ? (
            <Card style={styles.editor} tone="raised">
              <Text style={styles.editorTitle}>
                {editor.id ? 'Edit API key' : 'Tambah API key'}
              </Text>

              <Text style={styles.fieldLabel}>Nama (opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Akun pribadi"
                placeholderTextColor={colors.textFaint}
                value={editor.label}
                onChangeText={(label) => setEditor((e) => (e ? { ...e, label } : e))}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>API key</Text>
              <TextInput
                style={styles.input}
                placeholder="AIza..."
                placeholderTextColor={colors.textFaint}
                value={editor.value}
                onChangeText={(value) => setEditor((e) => (e ? { ...e, value } : e))}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.editorActions}>
                <Button
                  title="Batal"
                  variant="ghost"
                  onPress={() => setEditor(null)}
                  style={styles.editorBtn}
                />
                <Button
                  title="Simpan"
                  icon="checkmark"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.editorBtn}
                />
              </View>
            </Card>
          ) : (
            <Button
              title="Tambah API Key"
              icon="add"
              variant={keys.length === 0 ? 'primary' : 'secondary'}
              onPress={() => setEditor({ label: '', value: '' })}
              style={styles.addBtn}
            />
          )}
        </>
      )}

      <Pressable
        style={styles.link}
        onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}
      >
        <Ionicons name="open-outline" size={15} color={colors.primaryBright} />
        <Text style={styles.linkText}>Buat API key di Google AI Studio</Text>
      </Pressable>

      <Card style={styles.note} tone="raised">
        <View style={styles.noteRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.primaryBright} />
          <Text style={styles.noteTitle}>Aman di perangkatmu</Text>
        </View>
        <Text style={styles.noteText}>
          Semua key disimpan di penyimpanan aman perangkat dan hanya dipakai
          untuk memanggil Gemini langsung dari app ini. Tidak ada server pihak
          ketiga yang menyimpannya.
        </Text>
      </Card>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: { paddingTop: spacing.lg },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
    iconBubble: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...glow(colors.primary),
    },
    heroText: { flex: 1 },
    title: { ...type.h1, color: colors.text },
    sub: { ...type.small, color: colors.textMuted, marginTop: 2 },
    themeCard: { marginBottom: spacing.xl },
    themeTitle: { ...type.h2, color: colors.text },
    themeHint: { ...type.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
    themeRow: { flexDirection: 'row', gap: spacing.md },
    themeOption: {
      flex: 1,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    themePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: radius.sm,
      padding: 6,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeLogo: { width: 34, height: 34 },
    swatch: { flex: 1, height: 22, borderRadius: 6 },
    divider: { width: '100%', height: 20, marginBottom: spacing.md, opacity: 0.8 },
    themeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    themeLabel: { ...type.bodyStrong, color: colors.textMuted },
    themeLabelActive: { color: colors.text },
    themeTagline: { ...type.small, color: colors.textFaint, marginTop: 2 },
    loading: { marginVertical: spacing.xxl },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { ...type.body, color: colors.textMuted },
  keyCard: { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  keyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  keyBody: { flex: 1 },
  keyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  keyLabel: { ...type.bodyStrong, color: colors.text, flexShrink: 1 },
  keyValue: { ...type.mono, color: colors.textMuted, marginTop: 3 },
  keyActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  iconBtnDanger: { backgroundColor: withAlpha(colors.danger, 0.12) },
  editor: { marginTop: spacing.sm },
  editorTitle: { ...type.h2, color: colors.text, marginBottom: spacing.md },
  fieldLabel: { ...type.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    ...type.bodyStrong,
  },
  editorActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  editorBtn: { flex: 1 },
  addBtn: { marginTop: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
  linkText: { ...type.bodyStrong, color: colors.primaryBright },
  note: { marginTop: spacing.xl },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  noteTitle: { ...type.bodyStrong, color: colors.text },
  noteText: { ...type.small, color: colors.textMuted },
});
