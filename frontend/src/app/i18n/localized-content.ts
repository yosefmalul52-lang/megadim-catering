import { AppLocale } from './locale.util';

/** Pick display name for public UI without changing stored Hebrew `name`. */
export function localizedProductName(
  item: { name?: string; nameEn?: string } | null | undefined,
  locale: AppLocale
): string {
  const he = String(item?.name || '').trim();
  const en = String(item?.nameEn || '').trim();
  if (locale === 'en') return en || he;
  return he || en;
}

export function localizedProductDescription(
  item: { description?: string; descriptionEn?: string } | null | undefined,
  locale: AppLocale
): string {
  const he = String(item?.description || '').trim();
  const en = String(item?.descriptionEn || '').trim();
  if (locale === 'en') return en || he;
  return he || en;
}

export function localizedOptionLabel(
  opt: { label?: string; labelEn?: string } | null | undefined,
  locale: AppLocale
): string {
  const he = String(opt?.label || '').trim();
  const en = String(opt?.labelEn || '').trim();
  if (locale === 'en') return en || he;
  return he || en;
}
