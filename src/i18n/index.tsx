import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dict, type DictKey, type Lang } from './dict';

export const LANGS: { code: Lang; native: string; label: string }[] = [
  { code: 'en', native: 'English', label: 'English' },
  { code: 'hi', native: 'हिंदी', label: 'Hindi' },
];

const KEY = 'sf.lang';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<Ctx | null>(null);

function readStored(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    return s === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export type TFn = (key: DictKey, vars?: Record<string, string | number>) => string;

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang used outside LangProvider');
  const { lang } = ctx;
  const t: TFn = useCallback(
    (key, vars) => {
      const entry = dict[key];
      let s = entry ? entry[lang] || entry.en : (key as string);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      }
      return s;
    },
    [lang],
  );
  return { lang, setLang: ctx.setLang, t };
}

/** Localised getters for the enum-style labels (purpose / category / area / status / doc state). */
export function useLabels() {
  const { t } = useLang();
  const get = (prefix: string, v?: string | null) => (v ? t(`${prefix}.${v}` as DictKey) : '—');
  return {
    purpose: (v?: string | null) => get('pur', v),
    category: (v?: string | null) => get('cat', v),
    area: (v?: string | null) => get('area', v),
    status: (v?: string | null) => get('st', v),
    docState: (v?: string | null) => get('ds', v),
    gender: (v?: string | null) => get('gen', v),
    education: (v?: string | null) => get('edu', v),
    occupation: (v?: string | null) => get('occ', v),
    ration: (v?: string | null) => get('ration', v),
    kind: (v?: string | null) => get('kind', v),
  };
}
