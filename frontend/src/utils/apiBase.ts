export function apiBaseUrl(): string {
  // Compile-time (Vite) env var. Must be set during the frontend build.
  const base = import.meta.env.VITE_API_BASE_URL;
  // Allow user to set empty to mean same-origin.
  return typeof base === 'string' && base.trim() ? base.replace(/\/+$/, '') : '';
}

