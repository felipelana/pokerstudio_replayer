import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore, useActiveSkin } from '@/state/store';
import { applySkinCssVariables } from '@/skins/presets';
import { Header } from '@/ui/Header';
import { LibraryPage } from '@/ui/library/LibraryPage';
import { ReplayerPage } from '@/ui/replayer/ReplayerPage';
import { SettingsPage } from '@/ui/settings/SettingsPage';
import { AdminPage } from '@/ui/admin/AdminPage';
import i18n from '@/i18n';

export function App() {
  const { t } = useTranslation();
  const loadSettings = useAppStore((s) => s.loadSettings);
  const loadSkins = useAppStore((s) => s.loadSkins);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const language = useAppStore((s) => s.settings.language);
  const animations = useAppStore((s) => s.settings.animations);
  const skin = useActiveSkin();

  useEffect(() => {
    void loadSettings();
    void loadSkins();
  }, [loadSettings, loadSkins]);

  // Persisted language wins over browser detection once settings are loaded.
  useEffect(() => {
    if (settingsLoaded && language && i18n.language !== language) void i18n.changeLanguage(language);
  }, [settingsLoaded, language]);

  useEffect(() => {
    applySkinCssVariables(skin);
  }, [skin]);

  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = i18n.language;
  }, [t, language]);

  return (
    <div className={`flex h-full flex-col ${animations ? 'anim' : ''}`}>
      <Header />
      <main className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/replay/:sessionId/:handId?" element={<ReplayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
