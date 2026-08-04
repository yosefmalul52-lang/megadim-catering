/**
 * Kitchen / order-item identity helpers — keep in sync with backend
 * `order-item-options.util.ts` itemVariantFingerprint.
 */

export type SelectedOptionLike = {
  label?: string | null;
  amount?: string | null;
  optionName?: string | null;
  valueName?: string | null;
  missingForReview?: boolean | null;
};

export function extractBaseProductId(productId: unknown): string {
  const raw = String(productId || '').trim();
  if (!raw) return '';
  const m = raw.match(/^([a-fA-F0-9]{24})/);
  return m ? m[1] : raw;
}

export function parseOptionFromItemName(name: unknown): {
  baseName: string;
  label?: string;
  amount?: string;
} {
  const full = String(name || '').trim();
  if (!full) return { baseName: '' };

  const paren = full.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    const baseName = paren[1].trim();
    const inside = paren[2].trim();
    const parts = inside
      .split(/\s*-\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return { baseName, label: parts[0], amount: parts.slice(1).join(' - ') };
    }
    return { baseName, label: inside, amount: inside };
  }

  const dash = full.match(/^(.*?)\s+-\s+(.+)$/);
  if (dash) {
    return { baseName: dash[1].trim(), label: dash[2].trim() };
  }

  return { baseName: full };
}

/** productId base + option label + amount + category (lowercase). */
export function itemVariantFingerprint(item: {
  productId?: unknown;
  id?: unknown;
  name?: unknown;
  category?: unknown;
  selectedOption?: SelectedOptionLike | null;
}): string {
  const baseId = extractBaseProductId(item.productId || item.id);
  const parsed = parseOptionFromItemName(item.name);
  const opt = item.selectedOption;
  const label = String(opt?.label || opt?.optionName || parsed.label || '')
    .trim()
    .toLowerCase();
  const amount = String(opt?.amount || opt?.valueName || parsed.amount || '')
    .trim()
    .toLowerCase();
  const category = String(item.category || '')
    .trim()
    .toLowerCase();
  const baseName = (parsed.baseName || String(item.name || '').trim()).toLowerCase();
  return [baseId || baseName, label, amount, category].join('||');
}

export function kitchenMissingChoiceLabel(item: {
  selectedOption?: SelectedOptionLike | null;
}): string | null {
  if (item?.selectedOption?.missingForReview === true) {
    return 'בחירה חסרה לבדיקה';
  }
  return null;
}

export function resolveKitchenOptionLabels(item: {
  name?: unknown;
  selectedOption?: SelectedOptionLike | null;
}): { optionLabel: string; sizeLabel: string } {
  const missing = kitchenMissingChoiceLabel(item);
  if (missing) {
    return { optionLabel: missing, sizeLabel: '' };
  }
  const fromOptLabel = String(item?.selectedOption?.label || item?.selectedOption?.optionName || '').trim();
  const fromOptAmount = String(item?.selectedOption?.amount || item?.selectedOption?.valueName || '').trim();
  if (fromOptLabel || fromOptAmount) {
    return { optionLabel: fromOptLabel, sizeLabel: fromOptAmount };
  }
  const parsed = parseOptionFromItemName(item?.name);
  return {
    optionLabel: String(parsed.label || '').trim(),
    sizeLabel: String(parsed.amount || '').trim()
  };
}
