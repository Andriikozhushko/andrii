import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from "react";
import en from "./en.json";
import uk from "./uk.json";
import ru from "./ru.json";
import de from "./de.json";
import fr from "./fr.json";
import es from "./es.json";
import hy from "./hy.json";

export const LANGS = [
  { code: "en", native: "English" },
  { code: "uk", native: "Українська" },
  { code: "ru", native: "Русский" },
  { code: "de", native: "Deutsch" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "hy", native: "Հայերեն" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

const DICTS: Record<Lang, unknown> = { en, uk, ru, de, fr, es, hy };
const STORE_KEY = "andrii.lang";

function isLang(x: string): x is Lang {
  return LANGS.some(l => l.code === x);
}

/** Stored preference → system language → English. */
export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored && isLang(stored)) return stored;
  } catch { /* ignore */ }
  const sys = (navigator.language || "en").slice(0, 2).toLowerCase();
  return isLang(sys) ? sys : "en";
}

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => interpolate(lookup(DICTS[lang], key) ?? lookup(DICTS.en, key) ?? key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Convenience: just the translate function. */
export function useT(): TFn {
  return useI18n().t;
}
