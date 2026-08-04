/**
 * Order line selection / variant helpers.
 * Checkout historically baked size into `name` + composite productId (`…-size-N`).
 * Admin edits must round-trip structured selectedOption without wiping it.
 */

export type SelectedOptionSnapshot = {
  label: string;
  amount?: string;
  price?: number;
  optionId?: string;
  optionName?: string;
  valueId?: string;
  valueName?: string;
  quantity?: number;
  priceAdjustment?: number;
  /** Legacy/incomplete choice — kitchen should flag rather than guess. */
  missingForReview?: boolean;
};

export function extractBaseProductId(productId: unknown): string {
  const raw = String(productId || '').trim();
  if (!raw) return '';
  const m = raw.match(/^([a-fA-F0-9]{24})/);
  return m ? m[1] : raw;
}

export function parseCompositeSizeIndex(productId: unknown): number | null {
  const raw = String(productId || '').trim();
  const m = raw.match(/^[a-fA-F0-9]{24}-size-(\d+)$/i);
  if (!m) return null;
  const idx = Number(m[1]);
  return Number.isInteger(idx) && idx >= 0 ? idx : null;
}

/** True when text looks like a real size/option (not a product nickname like "טירשי"). */
export function looksLikeSizeToken(text: unknown): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  // Numeric / unit sizes: 250 מ"ל, 1 ליטר, 500g, 0.5 ק"ג
  if (/\d/.test(raw)) {
    if (/מ"?ל|ml\b|ליטר|liter|\bl\b|גר(?:ם)?|gram|\bg\b|ק"?ג|kg\b|יח'?|unit/i.test(raw)) {
      return true;
    }
    // Bare amount like "250" or encoded "250 מ\"ל - 250"
    if (/^\d+(?:[.,]\d+)?(?:\s*(?:מ"?ל|ml|ל|גרם?|g|ק"?ג|kg))?$/i.test(raw)) {
      return true;
    }
    if (/\d/.test(raw) && /\s-\s/.test(raw)) return true;
  }
  // Named size words only (not arbitrary Hebrew nicknames in parentheses)
  if (/^(קטן|קטנה|בינוני|בינונית|גדול|גדולה|רגיל|רגילה|אישי|משפחתי|XL|L|M|S)$/i.test(raw)) {
    return true;
  }
  return false;
}

/**
 * Parse legacy checkout naming:
 * - `טחינה (250 מ"ל - 250)`
 * - `סלט כרוב (1 ליטר)`
 * - `חומוס - קטן`
 * - `חמוצי מגדים (טירשי) (250 מ"ל - 250)` — nickname kept on base; size from last size-like paren
 * - `חמוצי מגדים (טירשי)` — nickname only, NOT a size
 */
export function parseOptionFromItemName(name: unknown): {
  baseName: string;
  label?: string;
  amount?: string;
} {
  const full = String(name || '').trim();
  if (!full) return { baseName: '' };

  // Prefer trailing size-like parenthetical (supports "Name (alias) (250 מ\"ל - 250)").
  const trailingParen = full.match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (trailingParen) {
    const baseName = trailingParen[1].trim();
    const inside = trailingParen[2].trim();
    if (looksLikeSizeToken(inside)) {
      const parts = inside.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2 && looksLikeSizeToken(parts[0])) {
        return { baseName, label: parts[0], amount: parts.slice(1).join(' - ') };
      }
      return { baseName, label: inside, amount: inside };
    }
    // Non-size alias in parentheses — keep full product name intact.
    return { baseName: full };
  }

  const dash = full.match(/^(.*?)\s+-\s+(.+)$/);
  if (dash && looksLikeSizeToken(dash[2])) {
    return { baseName: dash[1].trim(), label: dash[2].trim() };
  }

  return { baseName: full };
}

/** Strip only a size-like trailing suffix; keep nicknames such as (טירשי). */
export function stripSizeSuffixFromItemName(name: unknown): string {
  const parsed = parseOptionFromItemName(name);
  return parsed.baseName || String(name || '').trim();
}

export function normalizeSelectedOption(
  raw: unknown,
  fallbacks: { name?: unknown; price?: unknown } = {}
): SelectedOptionSnapshot | undefined {
  if (!raw || typeof raw !== 'object') {
    const parsed = parseOptionFromItemName(fallbacks.name);
    // Only recover from name when the token is an actual size (never nicknames like טירשי).
    if (!parsed.label || !looksLikeSizeToken(parsed.label)) return undefined;
    return {
      label: parsed.label,
      amount: parsed.amount,
      optionName: parsed.label,
      valueName: parsed.amount || parsed.label,
      price: Number.isFinite(Number(fallbacks.price)) ? Number(fallbacks.price) : undefined
    };
  }

  const o = raw as Record<string, unknown>;
  const label = String(o.label || o.optionName || o.valueName || '').trim();
  const amount = String(
    o.amount != null && o.amount !== ''
      ? o.amount
      : o.valueName || o.size || ''
  ).trim();
  if (!label && !amount) {
    const parsed = parseOptionFromItemName(fallbacks.name);
    if (!parsed.label || !looksLikeSizeToken(parsed.label)) return undefined;
    return {
      label: parsed.label,
      amount: parsed.amount,
      optionName: parsed.label,
      valueName: parsed.amount || parsed.label,
      missingForReview: true,
      price: Number.isFinite(Number(fallbacks.price)) ? Number(fallbacks.price) : undefined
    };
  }

  const priceRaw = o.price ?? o.priceAdjustment ?? fallbacks.price;
  const price = Number(priceRaw);
  const out: SelectedOptionSnapshot = {
    label: label || amount,
    amount: amount || undefined,
    optionId: o.optionId != null ? String(o.optionId).trim() || undefined : undefined,
    optionName: String(o.optionName || label || '').trim() || undefined,
    valueId: o.valueId != null ? String(o.valueId).trim() || undefined : undefined,
    valueName: String(o.valueName || amount || label || '').trim() || undefined,
    price: Number.isFinite(price) ? price : undefined
  };
  if (o.priceAdjustment != null && Number.isFinite(Number(o.priceAdjustment))) {
    out.priceAdjustment = Number(o.priceAdjustment);
  }
  if (o.quantity != null && Number.isFinite(Number(o.quantity)) && Number(o.quantity) > 0) {
    out.quantity = Number(o.quantity);
  }
  if (o.missingForReview === true) out.missingForReview = true;
  return out;
}

/**
 * Resolve option for an admin update line.
 * - Explicit selectedOption in payload wins (including clearing only if selectedOption: null).
 * - If field omitted, keep existing snapshot.
 * - Else parse from name / composite size id.
 */
export function resolveSelectedOptionForUpdate(input: {
  incoming: Record<string, unknown>;
  existing?: Record<string, unknown> | null;
  hasSelectedOptionKey: boolean;
}): SelectedOptionSnapshot | undefined {
  const { incoming, existing, hasSelectedOptionKey } = input;

  if (hasSelectedOptionKey) {
    if (incoming.selectedOption == null) return undefined;
    return normalizeSelectedOption(incoming.selectedOption, {
      name: incoming.name,
      price: incoming.price
    });
  }

  if (existing?.selectedOption) {
    return normalizeSelectedOption(existing.selectedOption, {
      name: existing.name ?? incoming.name,
      price: existing.price ?? incoming.price
    });
  }

  return (
    normalizeSelectedOption(undefined, { name: incoming.name, price: incoming.price }) ||
    normalizeSelectedOption(undefined, { name: existing?.name, price: existing?.price })
  );
}

/** Normalize amount/size tokens so "500", "500 גרם", "500 מ\"ל" compare equal by numeric core when present. */
export function normalizeAmountKey(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\"״'`]/g, '')
    .replace(/\s+/g, '');
  if (!s) return '';
  const numeric = s.replace(/[^\d.]/g, '');
  if (numeric && /^\d+(\.\d+)?$/.test(numeric)) return numeric;
  return s;
}

export function amountsEquivalent(a: unknown, b: unknown): boolean {
  const left = String(a ?? '').trim().toLowerCase();
  const right = String(b ?? '').trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const ka = normalizeAmountKey(left);
  const kb = normalizeAmountKey(right);
  return !!ka && !!kb && ka === kb;
}

type PricedOptionLike = { label?: unknown; amount?: unknown; price?: unknown; size?: unknown };

/**
 * Match a catalog pricing option without collapsing distinct sizes that share a label.
 * When an amount/size is present, amount wins; label-only match is used only if unique
 * or when no amount was requested. Never returns the first/minimum option on ambiguous label.
 */
export function findMatchingPricingOption(
  options: PricedOptionLike[] | null | undefined,
  requested: { label?: unknown; amount?: unknown }
): { option: PricedOptionLike; index: number } | null {
  if (!Array.isArray(options) || options.length === 0) return null;

  const reqLabel = String(requested.label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\"״]/g, '"');
  const reqAmountRaw = String(requested.amount ?? '').trim();
  const reqAmount = reqAmountRaw.toLowerCase().replace(/[\"״]/g, '"');

  const rows = options.map((opt, index) => {
    const label = String(opt?.label ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\"״]/g, '"');
    const amount = String(opt?.amount ?? opt?.size ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\"״]/g, '"');
    return { opt, index, label, amount };
  });

  if (reqAmount) {
    const byAmount = rows.find(
      (row) =>
        amountsEquivalent(row.amount, reqAmount) ||
        amountsEquivalent(row.label, reqAmount) ||
        row.amount === reqAmount ||
        row.label === reqAmount
    );
    if (byAmount) return { option: byAmount.opt, index: byAmount.index };
  }

  if (!reqLabel) return null;

  const labelMatches = rows.filter(
    (row) =>
      !!row.label &&
      (row.label === reqLabel ||
        row.amount === reqLabel ||
        amountsEquivalent(row.label, reqLabel) ||
        amountsEquivalent(row.amount, reqLabel))
  );

  if (labelMatches.length === 0) return null;

  if (reqAmount) {
    // Amount was requested but did not match any option above — do not fall back to a
    // shared label (e.g. "רגיל") that would pick the catalog minimum/first size.
    const disambiguated = labelMatches.find(
      (row) => amountsEquivalent(row.amount, reqAmount) || amountsEquivalent(row.label, reqAmount)
    );
    if (disambiguated) return { option: disambiguated.opt, index: disambiguated.index };
    return null;
  }

  if (labelMatches.length === 1) return { option: labelMatches[0].opt, index: labelMatches[0].index };
  // Ambiguous shared label without amount — refuse to guess the minimum.
  return null;
}

export function findMatchingPricingVariant(
  variants: PricedOptionLike[] | null | undefined,
  requested: { label?: unknown; amount?: unknown }
): { option: PricedOptionLike; index: number } | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  // Variants use `size` the way options use `amount`.
  const asOptions = variants.map((v) => ({
    label: v?.label,
    amount: v?.size ?? v?.amount,
    price: v?.price,
    size: v?.size
  }));
  const matched = findMatchingPricingOption(asOptions, requested);
  if (!matched) return null;
  return { option: variants[matched.index], index: matched.index };
}

export function formatItemDisplayName(
  baseName: string,
  option?: SelectedOptionSnapshot | null
): string {
  const base = String(baseName || '').trim();
  if (!option?.label && !option?.amount) return base;
  const label = String(option.label || '').trim();
  const amount = String(option.amount || '').trim();
  if (label && amount && label !== amount) return `${base} (${label} - ${amount})`;
  if (label) return `${base} (${label})`;
  return `${base} (${amount})`;
}

/** Stable kitchen/aggregation key: base product + option/size (+ category). */
export function itemVariantFingerprint(item: {
  productId?: unknown;
  name?: unknown;
  category?: unknown;
  selectedOption?: SelectedOptionSnapshot | { label?: unknown; amount?: unknown } | null;
}): string {
  const baseId = extractBaseProductId(item.productId);
  const parsed = parseOptionFromItemName(item.name);
  const opt = item.selectedOption;
  const label = String(opt?.label || parsed.label || '')
    .trim()
    .toLowerCase();
  const amount = String(opt?.amount || parsed.amount || '')
    .trim()
    .toLowerCase();
  const category = String(item.category || '')
    .trim()
    .toLowerCase();
  const baseName = (parsed.baseName || String(item.name || '').trim()).toLowerCase();
  // Prefer productId when present; always include option dimensions so sizes never collapse.
  return [baseId || baseName, label, amount, category].join('||');
}

export function dishIdentityKeyFromItem(item: {
  productId?: unknown;
  name?: unknown;
  category?: unknown;
  selectedOption?: { label?: unknown; amount?: unknown } | null;
}): string {
  return itemVariantFingerprint(item);
}

export function kitchenMissingChoiceLabel(item: {
  name?: unknown;
  selectedOption?: { missingForReview?: unknown; label?: unknown } | null;
}): string | null {
  if (item?.selectedOption?.missingForReview === true) {
    return 'בחירה חסרה לבדיקה';
  }
  return null;
}

export type CatalogPricingOption = {
  label?: unknown;
  amount?: unknown;
  size?: unknown;
  price?: unknown;
};

export function optionFromCatalogIndex(
  catalogOptions: CatalogPricingOption[] | null | undefined,
  index: number | null | undefined
): SelectedOptionSnapshot | undefined {
  if (!Array.isArray(catalogOptions) || index == null || index < 0 || index >= catalogOptions.length) {
    return undefined;
  }
  const o = catalogOptions[index];
  const label = String(o?.label ?? '').trim();
  const amount = String(o?.amount ?? o?.size ?? '').trim();
  const price = Number(o?.price);
  if (!label && !amount) return undefined;
  return {
    label: label || amount,
    amount: amount || label,
    price: Number.isFinite(price) ? price : undefined
  };
}

/**
 * When checkout omitted selectedOption, recover size from authoritative sources only:
 * - composite productId `…-size-N` → catalog index
 * - single catalog option → use it
 * - exact unit-price match (unique) → use that option
 * - multi-option catalog with no match → missingForReview (do not guess min size)
 * Never treat product nicknames in the name (e.g. טירשי) as a size.
 */
export function inferSelectedOptionFromCatalog(
  item: {
    price?: unknown;
    name?: unknown;
    productId?: unknown;
    selectedOption?: SelectedOptionSnapshot | { label?: unknown; amount?: unknown; missingForReview?: unknown } | null;
  },
  catalogOptions?: CatalogPricingOption[] | null
): SelectedOptionSnapshot | undefined {
  const existing = normalizeSelectedOption(item.selectedOption, {
    name: item.name,
    price: item.price
  });
  if (existing && (existing.label || existing.amount) && !existing.missingForReview) {
    return existing;
  }

  if (!Array.isArray(catalogOptions) || catalogOptions.length === 0) {
    return existing;
  }

  const fromIndex = optionFromCatalogIndex(catalogOptions, parseCompositeSizeIndex(item.productId));
  if (fromIndex) return fromIndex;

  const fromName = parseOptionFromItemName(item.name);
  if (fromName.label && looksLikeSizeToken(fromName.label)) {
    const matched = findMatchingPricingOption(catalogOptions, {
      label: fromName.label,
      amount: fromName.amount
    });
    if (matched) return optionFromCatalogIndex(catalogOptions, matched.index);
    // Size encoded in name but not in catalog — still surface the encoded size, not a guess.
    return {
      label: fromName.label,
      amount: fromName.amount,
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : undefined
    };
  }

  if (catalogOptions.length === 1) {
    return optionFromCatalogIndex(catalogOptions, 0);
  }

  const unitPrice = Number(item.price);
  if (Number.isFinite(unitPrice) && unitPrice > 0) {
    const matches = catalogOptions.filter((o) => Number(o?.price) === unitPrice);
    if (matches.length === 1) {
      const idx = catalogOptions.indexOf(matches[0]);
      return optionFromCatalogIndex(catalogOptions, idx);
    }
  }

  // Has size choices but none recoverable — kitchen must review, never invent 250.
  return {
    label: '',
    amount: '',
    missingForReview: true
  };
}

/** Sort key so 250 before 500, and same-base dishes stay adjacent. */
export function kitchenSizeSortValue(sizeLabel: unknown, optionLabel: unknown = ''): number {
  const raw = `${String(sizeLabel || '')} ${String(optionLabel || '')}`;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]);
}
