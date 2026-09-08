/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REPLAYER_URL?: string;
  readonly VITE_REPLAYER_URL_PROD?: string;
  readonly VITE_REPLAYER_URL_STAGING?: string;
  readonly VITE_REPLAYER_URL_DEV?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
