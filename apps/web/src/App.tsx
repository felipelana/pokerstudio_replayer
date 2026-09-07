import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore, useActiveSkin } from '@/state/store';
import { applySkinCssVariables } from '@/skins/presets';
import { Header } from '@/ui/Header';
import { ConsentBanner } from '@/ui/ConsentBanner';
import { LegalPage } from '@/ui/legal/LegalPage';
import { ReportPage } from '@/ui/report/ReportPage';
import {
  AccountPage,
  ForgotPasswordPage,
  LoginPage,
  ReferralLanding,
  ResetPasswordPage,
  SignUpPage,
  VerifyEmailPage,
} from '@/ui/auth/AuthPages';
import { RequireAuth } from '@/ui/auth/RequireAuth';
import { LibraryPage } from '@/ui/library/LibraryPage';
import { ReplayerPage } from '@/ui/replayer/ReplayerPage';
import { SettingsPage } from '@/ui/settings/SettingsPage';
import { AdminPage } from '@/ui/admin/AdminPage';
import { AdmStudioPage } from '@/ui/admstudio/AdmStudioPage';
import i18n from '@/i18n';
import { track } from '@/infrastructure/usage';

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
    track('APP_OPEN');
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
          {/* Public: authentication and the legal texts. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route path="/" element={<RequireAuth><LibraryPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/replay/:sessionId/:handId?" element={<RequireAuth><ReplayerPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/admstudio" element={<RequireAuth><AdmStudioPage /></RequireAuth>} />
          <Route path="/report/:sessionId" element={<RequireAuth><ReportPage /></RequireAuth>} />
          <Route path="/privacidade" element={<LegalPage doc="privacy" />} />
          <Route path="/termos" element={<LegalPage doc="terms" />} />
          <Route path="*" element={<RequireAuth><LibraryPage /></RequireAuth>} />
        </Routes>
      </main>
      <ConsentBanner />
    </div>
  );
}
