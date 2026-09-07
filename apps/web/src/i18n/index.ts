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

export interface LanguageInfo {
  code: string;
  /** Native name, shown in the selector. */
  nativeName: string;
  /** Flag component id (see src/ui/flags). */
  flag: 'br' | 'us' | 'es' | 'de' | 'ru' | 'cn' | 'jp' | 'kr';
  /** Intl locale used for number/date formatting. */
  locale: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'pt-BR', nativeName: 'Português (Brasil)', flag: 'br', locale: 'pt-BR' },
  { code: 'en', nativeName: 'English', flag: 'us', locale: 'en-US' },
  { code: 'es', nativeName: 'Español', flag: 'es', locale: 'es-ES' },
  { code: 'de', nativeName: 'Deutsch', flag: 'de', locale: 'de-DE' },
  { code: 'ru', nativeName: 'Русский', flag: 'ru', locale: 'ru-RU' },
  { code: 'zh-CN', nativeName: '简体中文', flag: 'cn', locale: 'zh-CN' },
  { code: 'ja', nativeName: '日本語', flag: 'jp', locale: 'ja-JP' },
  { code: 'ko', nativeName: '한국어', flag: 'kr', locale: 'ko-KR' },
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
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    // Resources are bundled: never suspend (components inside the R3F canvas root must not suspend).
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lana-replayer-lang',
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith('pt')) return 'pt-BR';
        if (lng.startsWith('zh')) return 'zh-CN';
        return lng.split('-')[0];
      },
    },
  });

export function localeFor(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.locale ?? 'en-US';
}

export default i18n;
