const FALLBACK_BASE_URL = "http://127.0.0.1:8080/api";

export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return baseUrl && baseUrl.length > 0 ? baseUrl.replace(/\/+$/, "") : FALLBACK_BASE_URL;
}
