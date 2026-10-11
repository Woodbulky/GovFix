/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AI_SERVICE_URL: string;
  readonly VITE_DEMO_MODE: string;
  /** Demo mode only: the role switcher signs in with it. Same value as DEMO_PASSWORD. */
  readonly VITE_DEMO_PASSWORD?: string;
}
