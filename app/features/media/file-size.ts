// One image's size on its Media card. Out of media-list.tsx so node --test can
// reach it. MB is 1,048,576 bytes, the same unit as the upload and storage caps.
const KB = 1024;
const MB = 1024 * KB;

export function formatFileSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
