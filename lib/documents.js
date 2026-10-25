export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_ACCEPT = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.xlsx',
  '.csv',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
].join(',');

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'csv']);

export function documentExtension(filename) {
  const name = String(filename || '').trim();
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function isAllowedDocumentName(filename) {
  return ALLOWED_EXTENSIONS.has(documentExtension(filename));
}

export function documentBadge(filename) {
  const ext = documentExtension(filename);
  if (ext === 'pdf') return { label: 'PDF', className: 'bg-danger-soft text-danger' };
  if (ext === 'png') return { label: 'PNG', className: 'bg-sky-50 text-sky-600' };
  if (ext === 'jpg' || ext === 'jpeg') return { label: 'JPG', className: 'bg-sky-50 text-sky-600' };
  if (ext === 'docx') return { label: 'DOC', className: 'bg-plum-50 text-plum-600' };
  if (ext === 'xlsx') return { label: 'XLS', className: 'bg-mint-50 text-mint-700' };
  if (ext === 'csv') return { label: 'CSV', className: 'bg-honey-50 text-honey-600' };
  return { label: 'FILE', className: 'bg-paper-tint text-ink-soft' };
}

export function documentPreviewKind(filename) {
  const ext = documentExtension(filename);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image';
  return 'download';
}

export function documentUploadError(documents) {
  if (!Array.isArray(documents)) return null;
  for (const doc of documents) {
    if (!doc || doc.id || !doc.filename || !doc.data_url) continue;
    if (!isAllowedDocumentName(doc.filename)) {
      return `${doc.filename} is not supported. Use PDF, PNG, JPG, DOCX, XLSX, or CSV.`;
    }
    if (Number(doc.size_bytes || 0) > MAX_DOCUMENT_BYTES) {
      return `${doc.filename} is too large (max 5 MB).`;
    }
  }
  return null;
}

export function downloadDataUrl(dataUrl, filename) {
  const value = String(dataUrl || '');
  const comma = value.indexOf(',');
  if (comma < 0) throw new Error('Could not read this file.');
  const header = value.slice(0, comma);
  const payload = value.slice(comma + 1);
  const mime = header.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
