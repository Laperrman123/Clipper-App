import * as Keychain from 'react-native-keychain';

/**
 * Penyimpanan API key Google AI Studio.
 *
 * Sekarang mendukung banyak key: user bisa menambah, mengedit, menghapus, dan
 * memilih satu sebagai key aktif. Key disimpan sebagai JSON di keystore/secure
 * storage bawaan OS lewat react-native-keychain. Data dari versi lama (satu key)
 * dimigrasikan otomatis supaya user tidak perlu memasukkan ulang.
 */

export interface ApiKeyEntry {
  id: string;
  label: string;
  value: string;
}

const LIST_KEY = 'POTONGIN_API_KEYS';
const ACTIVE_KEY = 'POTONGIN_ACTIVE_API_KEY_ID';
/** Nama lama (versi satu-key) — hanya dibaca sekali untuk migrasi. */
const LEGACY_KEY = 'GOOGLE_AI_STUDIO_API_KEY';

async function secureGet(service: string): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

async function secureSet(service: string, value: string): Promise<void> {
  await Keychain.setGenericPassword(service, value, { service });
}

async function secureDelete(service: string): Promise<void> {
  await Keychain.resetGenericPassword({ service });
}

function makeId(): string {
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readList(): Promise<ApiKeyEntry[]> {
  const raw = await secureGet(LIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ApiKeyEntry =>
          e && typeof e.id === 'string' && typeof e.value === 'string'
      )
      .map((e) => ({
        id: e.id,
        label: typeof e.label === 'string' ? e.label : '',
        value: e.value,
      }));
  } catch {
    return [];
  }
}

async function writeList(list: ApiKeyEntry[]): Promise<void> {
  await secureSet(LIST_KEY, JSON.stringify(list));
}

async function readActiveId(): Promise<string | null> {
  return secureGet(ACTIVE_KEY);
}

async function writeActiveId(id: string | null): Promise<void> {
  if (id) await secureSet(ACTIVE_KEY, id);
  else await secureDelete(ACTIVE_KEY);
}

/** Pindahkan key tunggal versi lama ke daftar baru (sekali saja). */
async function migrateLegacy(): Promise<void> {
  const legacy = await secureGet(LEGACY_KEY);
  if (!legacy) return;

  const list = await readList();
  if (!list.some((e) => e.value === legacy.trim())) {
    const entry: ApiKeyEntry = {
      id: makeId(),
      label: 'API Key 1',
      value: legacy.trim(),
    };
    await writeList([...list, entry]);
    await writeActiveId(entry.id);
  }
  await secureDelete(LEGACY_KEY);
}

export async function listApiKeys(): Promise<ApiKeyEntry[]> {
  await migrateLegacy();
  return readList();
}

export async function getActiveApiKeyId(): Promise<string | null> {
  await migrateLegacy();
  const list = await readList();
  const active = await readActiveId();
  if (active && list.some((e) => e.id === active)) return active;
  return list[0]?.id ?? null;
}

export async function getActiveApiKey(): Promise<string | null> {
  const list = await listApiKeys();
  const id = await getActiveApiKeyId();
  return list.find((e) => e.id === id)?.value ?? null;
}

/** Kompatibilitas dengan pemanggil lama. */
export const getApiKey = getActiveApiKey;

export async function addApiKey(label: string, value: string): Promise<ApiKeyEntry> {
  const list = await readList();
  const entry: ApiKeyEntry = {
    id: makeId(),
    label: label.trim() || `API Key ${list.length + 1}`,
    value: value.trim(),
  };
  await writeList([...list, entry]);
  const active = await readActiveId();
  if (!active) await writeActiveId(entry.id);
  return entry;
}

export async function updateApiKey(
  id: string,
  patch: { label?: string; value?: string }
): Promise<void> {
  const list = await readList();
  await writeList(
    list.map((e) => {
      if (e.id !== id) return e;
      return {
        ...e,
        ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
        ...(patch.value !== undefined ? { value: patch.value.trim() } : {}),
      };
    })
  );
}

export async function removeApiKey(id: string): Promise<void> {
  const list = await readList();
  const next = list.filter((e) => e.id !== id);
  await writeList(next);

  const active = await readActiveId();
  if (active === id) await writeActiveId(next[0]?.id ?? null);
}

export async function setActiveApiKey(id: string): Promise<void> {
  await writeActiveId(id);
}
