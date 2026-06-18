export interface CateringLineItem {
  name: string;
  kitchenNotes: string;
}

/** Accept legacy string[] or { dish, kitchenNotes } rows from the catering form. */
export function normalizeCateringLineItems(raw: unknown): CateringLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CateringLineItem[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const name = entry.trim();
      if (name) out.push({ name, kitchenNotes: '' });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const row = entry as Record<string, unknown>;
      const name = String(row.dish ?? row.name ?? '').trim();
      const kitchenNotes = String(row.kitchenNotes ?? row.notes ?? '').trim();
      if (name) out.push({ name, kitchenNotes });
    }
  }
  return out;
}

export function displayCateringItemName(line: CateringLineItem): string {
  if (!line.kitchenNotes) return line.name;
  return `${line.name} — ${line.kitchenNotes}`;
}

export function pushCateringOrderItems(
  list: { name: string; price: number; quantity: number; category: string; description?: string }[],
  lines: CateringLineItem[],
  category: string
): void {
  for (const line of lines) {
    list.push({
      name: line.name,
      price: 0,
      quantity: 1,
      category,
      description: line.kitchenNotes || undefined
    });
  }
}

export function pushCateringEmailItems(
  list: Array<{ id: string; name: string; quantity: number; price: number; category: string }>,
  lines: CateringLineItem[],
  category: string
): void {
  for (const line of lines) {
    list.push({
      id: '',
      name: displayCateringItemName(line),
      quantity: 1,
      price: 0,
      category
    });
  }
}

export function resolveMealCourseLines(
  body: Record<string, unknown>,
  mealTime: string,
  eveningKey: string,
  morningKey: string,
  legacyKey: string
): { evening: CateringLineItem[]; morning: CateringLineItem[] } {
  let evening = normalizeCateringLineItems(body[eveningKey]);
  let morning = normalizeCateringLineItems(body[morningKey]);

  if (evening.length === 0 && morning.length === 0) {
    const legacy = normalizeCateringLineItems(body[legacyKey]);
    if (legacy.length > 0) {
      if (mealTime === 'morning') morning = legacy;
      else evening = legacy;
    }
  }

  return { evening, morning };
}
