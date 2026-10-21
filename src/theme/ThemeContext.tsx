import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Keychain from 'react-native-keychain';
import {
  DEFAULT_THEME_KEY,
  isThemeKey,
  themeAssets,
  themeMeta,
  themes,
  ThemeAssets,
  ThemeColors,
  ThemeKey,
} from './themes';

/**
 * Sumber tunggal tema aplikasi.
 *
 * Pilihan tema disimpan di secure storage (react-native-keychain) supaya
 * bertahan setelah app ditutup. Saat berubah, seluruh UI yang memakai
 * `useTheme()` otomatis render ulang — tidak perlu restart.
 */

const THEME_SERVICE = 'POTONGIN_THEME';

interface ThemeContextValue {
  colors: ThemeColors;
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => void;
  meta: (typeof themeMeta)[ThemeKey];
  /** Aset gambar tema (opsional; kosong = pakai ikon vektor). */
  assets: ThemeAssets;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: themes[DEFAULT_THEME_KEY],
  themeKey: DEFAULT_THEME_KEY,
  setThemeKey: () => {},
  meta: themeMeta[DEFAULT_THEME_KEY],
  assets: themeAssets[DEFAULT_THEME_KEY],
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);

  // Muat pilihan tersimpan sekali saat app dibuka.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const creds = await Keychain.getGenericPassword({ service: THEME_SERVICE });
        const saved = creds ? creds.password : null;
        if (alive && isThemeKey(saved)) setKey(saved);
      } catch {
        // Gagal baca = tetap pakai default, bukan error fatal.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setThemeKey = useCallback((key: ThemeKey) => {
    setKey(key);
    // Simpan tanpa menunggu — UI sudah berubah duluan.
    Keychain.setGenericPassword(THEME_SERVICE, key, {
      service: THEME_SERVICE,
    }).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: themes[themeKey],
      themeKey,
      setThemeKey,
      meta: themeMeta[themeKey],
      assets: themeAssets[themeKey],
    }),
    [themeKey, setThemeKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
