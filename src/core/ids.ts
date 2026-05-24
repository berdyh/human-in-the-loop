import { randomBytes } from 'node:crypto';

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'item';
}

export function timestampId(date = new Date()): string {
  return date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

export function uniqueId(prefix: string, hint = ''): string {
  const slug = hint ? `-${slugify(hint).slice(0, 24)}` : '';
  return `${prefix}_${timestampId()}${slug}-${randomBytes(3).toString('hex')}`;
}
