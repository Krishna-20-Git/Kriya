/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional. Leave empty to call the API on the same origin (/api, proxied by Vite in dev and Vercel in production). */
  readonly VITE_API_URL?: string;
}
