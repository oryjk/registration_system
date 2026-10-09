export const MINIO_IMAGE_DOWNLOAD_TIMEOUT = 15000;
export const MINIO_IMAGE_TTL = 7 * 86400000;
export const MINIO_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MINIO_IMAGE_MAX_ENTRIES = 128;

/** Public buckets served by our current nginx/MinIO deployment. */
export function isMinioImageUrl(url: string): boolean {
  return /^https:\/\/(?:oryjk\.cn(?::(?:82|443))?|match\.oryjk\.cn)\/(?:registration|seat-images)\/.+/i.test(url);
}

export function isImmutableMinioImage(url: string): boolean {
  return isMinioImageUrl(url) && /\/[a-f0-9]{16,64}\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(url);
}
