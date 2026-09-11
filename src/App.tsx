import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/lib/state/authStore';
import { useAppStore, useActiveSkin } from '@/lib/state/store';
import { applySkinCssVariables } from '@/lib/skins/presets';
import { Header } from '@/components/ui/Header';
import { Tour } from '@/features/onboarding/tour/Tour';
import { ReleaseNotesPage } from '@/features/onboarding/releases/ReleaseNotesPage';
import { CoachPage } from '@/features/reviews/share/CoachPage';
import { HelpCenter } from '@/features/onboarding/help/HelpCenter';
import { FeedbackDialog } from '@/features/admin/feedback/FeedbackDialog';
import { ConsentBanner } from '@/components/ui/ConsentBanner';
import { LegalPage } from '@/features/onboarding/legal/LegalPage';
import { ReportPage } from '@/features/reviews/ui/ReportPage';
import {
  AccountPage,
  ForgotPasswordPage,
  LoginPage,
  ReferralLanding,
  ResetPasswordPage,
  SignUpPage,
  VerifyEmailPage,
} from '@/features/auth/AuthPages';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LibraryPage } from '@/features/library/LibraryPage';
import { ReplayerPage } from '@/features/replayer/ui/ReplayerPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AdminPage } from '@/features/admin/skins/AdminPage';
import { AdmStudioPage } from '@/features/admin/console/AdmStudioPage';
import i18n from '@/i18n';
import { track } from '@/lib/infrastructure/usage';

export function App() {
  const { t } = useTranslation();
  const loadSettings = useAppStore((s) => s.loadSettings);
  const loadSkins = useAppStore((s) => s.loadSkins);
  const loadRoomNicks = useAppStore((s) => s.loadRoomNicks);
  const loadCatalogueLeaks = useAppStore((s) => s.loadCatalogueLeaks);
  const signedIn = useAuthStore((s) => s.phase === 'authenticated');
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const language = useAppStore((s) => s.settings.language);
  const animations = useAppStore((s) => s.settings.animations);
  const skin = useActiveSkin();
  // A shared review is not the app. The coach gets their own chrome and none
  // of ours: no navigation, no tour, no dialogs raised from the store.
  const coachView = useLocation().pathname.startsWith('/coach/');

  useEffect(() => {
    void loadSettings();
    void loadSkins();
    track('APP_OPEN');
  }, [loadSettings, loadSkins]);

  // The account's screen names, once there is an account to ask about.
  useEffect(() => {
    if (signedIn) void loadRoomNicks();
  }, [signedIn, loadRoomNicks]);

  // The shared vocabulary of leaks. It is public, so it is asked for once,
  // whether or not anyone is signed in.
  useEffect(() => {
    void loadCatalogueLeaks();
  }, [loadCatalogueLeaks]);

  // Persisted language wins over browser detection once settings are loaded.
  useEffect(() => {
    if (settingsLoaded && language && i18n.language !== language)
      void i18n.changeLanguage(language);
  }, [settingsLoaded, language]);

  useEffect(() => {
    applySkinCssVariables(skin);
  }, [skin]);

  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = i18n.language;
  }, [t, language]);

  if (coachView) {
    return (
      <div className={`flex h-full flex-col ${animations ? 'anim' : ''}`}>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Routes>
            {/* The coach has no account: their way in is the link and a password. */}
            <Route path="/coach/:token" element={<CoachPage />} />
          </Routes>
        </main>
        <ConsentBanner />
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${animations ? 'anim' : ''}`}>
      <Header />
      <Tour />
      <AppDialogs />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Routes>
          {/* Public: authentication and the legal texts. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/r/:code" element={<ReferralLanding />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="/replay/:sessionId/:handId?"
            element={
              <RequireAuth>
                <ReplayerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admstudio"
            element={
              <RequireAuth>
                <AdmStudioPage />
              </RequireAuth>
            }
          />
          <Route
            path="/report/:sessionId"
            element={
              <RequireAuth>
                <ReportPage />
              </RequireAuth>
            }
          />
          <Route path="/novidades" element={<ReleaseNotesPage />} />
          <Route path="/privacidade" element={<LegalPage doc="privacy" />} />
          <Route path="/termos" element={<LegalPage doc="terms" />} />
          <Route
            path="*"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
      <ConsentBanner />
    </div>
  );
}

/**
 * The panels that can be raised from anywhere: the answers, and the box for
 * what is missing. Mounted once, driven by the store.
 */
function AppDialogs() {
  const helpOpen = useAppStore((s) => s.helpCenterOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpCenterOpen);
  const feedbackOpen = useAppStore((s) => s.feedbackOpen);
  const setFeedbackOpen = useAppStore((s) => s.setFeedbackOpen);
  return (
    <>
      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
