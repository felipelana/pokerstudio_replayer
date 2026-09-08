import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import ptBR from '@/locales/pt-BR.json';
import es from '@/locales/es.json';
import de from '@/locales/de.json';
import ru from '@/locales/ru.json';
import zhCN from '@/locales/zh-CN.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import type { FlagId } from '@/components/Flags';

export interface LanguageInfo {
  code: string;
  /** Native name, written out in full — that is what the selector shows. */
  nativeName: string;
  /** Short label for the header button, where the full name does not fit. */
  short: string;
  /** Flag component id (see src/components/Flags.tsx). */
  flag: FlagId;
  /** BCP 47 tag for the <html lang> attribute. */
  htmlLang: string;
}

/** The same eight languages the Replayer ships with, in the same order. */
export const LANGUAGES: LanguageInfo[] = [
  {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    short: 'PT-BR',
    flag: 'br',
    htmlLang: 'pt-BR',
  },
  { code: 'en', nativeName: 'English', short: 'EN', flag: 'us', htmlLang: 'en' },
  { code: 'es', nativeName: 'Español', short: 'ES', flag: 'es', htmlLang: 'es' },
  { code: 'de', nativeName: 'Deutsch', short: 'DE', flag: 'de', htmlLang: 'de' },
  { code: 'ru', nativeName: 'Русский', short: 'RU', flag: 'ru', htmlLang: 'ru' },
  { code: 'zh-CN', nativeName: '简体中文', short: '简体中文', flag: 'cn', htmlLang: 'zh-CN' },
  { code: 'ja', nativeName: '日本語', short: '日本語', flag: 'jp', htmlLang: 'ja' },
  { code: 'ko', nativeName: '한국어', short: '한국어', flag: 'kr', htmlLang: 'ko' },
];

export const resources = {
  en: { translation: en },
  'pt-BR': { translation: ptBR },
  es: { translation: es },
  de: { translation: de },
  ru: { translation: ru },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja },
  ko: { translation: ko },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pt-BR',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    // Everything is bundled, so nothing ever suspends.
    react: { useSuspense: false },
    detection: {
      // The choice is kept in localStorage, so a visitor who picks a language
      // finds it again on the next visit; the browser's own languages are only
      // consulted the first time.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pokerstudio-landing-lang',
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith('pt')) return 'pt-BR';
        if (lng.startsWith('zh')) return 'zh-CN';
        return lng.split('-')[0];
      },
    },
  });

export function languageInfo(code: string): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export default i18n;
