/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the SchemeFit AI API for split deployments, e.g. https://schemefit-api.onrender.com. Unset ⇒ same-origin '/api/v1'. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
