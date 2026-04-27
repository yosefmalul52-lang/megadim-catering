import { Request, Response } from 'express';
import Order from '../models/Order';
import Contact from '../models/Contact';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

type Audience = 'vip' | 'all' | 'leads';
type LaunchBody = {
  message: string;
  audience: Audience;
  channels: string[];
  couponCode?: string;
};

type CampaignTarget = {
  name: string;
  phone: string;
  email?: string;
  ordersCount?: number;
};

function normalizePhone(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00972')) digits = digits.slice(5);
  else if (digits.startsWith('972')) digits = digits.slice(3);
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits;
}

async function getOrderTargets(requireReturning: boolean): Promise<CampaignTarget[]> {
  const docs = await Order.find(
    { isDeleted: { $ne: true }, status: { $ne: 'cancelled' } },
    {
      customerDetails: 1
    }
  ).lean();

  const map = new Map<string, CampaignTarget & { count: number }>();
  for (const d of docs) {
    const cd = (d as any)?.customerDetails || {};
    const phoneRaw = cd.phone;
    const phone = normalizePhone(phoneRaw);
    if (!phone) continue;
    const prev = map.get(phone);
    if (!prev) {
      map.set(phone, {
        name: String(cd.fullName || '').trim() || 'לקוח',
        phone,
        email: cd.email ? String(cd.email).trim() : undefined,
        count: 1
      });
    } else {
      prev.count += 1;
      if (!prev.name && cd.fullName) prev.name = String(cd.fullName).trim();
      if (!prev.email && cd.email) prev.email = String(cd.email).trim();
      map.set(phone, prev);
    }
  }

  const rows = Array.from(map.values())
    .filter((r) => (requireReturning ? r.count > 1 : true))
    .map((r) => ({
      name: r.name || 'לקוח',
      phone: r.phone,
      email: r.email,
      ordersCount: r.count
    }));
  return rows;
}

async function getLeadTargets(): Promise<CampaignTarget[]> {
  const docs = await Contact.find({}).select('name phone email').lean();
  const map = new Map<string, CampaignTarget>();
  for (const d of docs) {
    const phone = normalizePhone((d as any)?.phone);
    if (!phone) continue;
    if (!map.has(phone)) {
      map.set(phone, {
        name: String((d as any)?.name || '').trim() || 'ליד',
        phone,
        email: (d as any)?.email ? String((d as any).email).trim() : undefined
      });
    }
  }
  return Array.from(map.values());
}

export const launchCampaign = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as LaunchBody;
  const message = String(body.message || '').trim();
  const audience = body.audience;
  const channels = Array.isArray(body.channels) ? body.channels.filter((c) => typeof c === 'string' && c.trim()) : [];
  const couponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : undefined;

  if (!message) {
    throw createValidationError('message is required');
  }
  if (!audience || !['vip', 'all', 'leads'].includes(audience)) {
    throw createValidationError('audience must be one of: vip, all, leads');
  }
  if (channels.length === 0) {
    throw createValidationError('channels must include at least one channel');
  }

  let targets: CampaignTarget[] = [];
  if (audience === 'vip') {
    targets = await getOrderTargets(true);
  } else if (audience === 'all') {
    targets = await getOrderTargets(false);
  } else {
    targets = await getLeadTargets();
  }

  const webhookUrl = (process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://example.com/n8n-campaign-webhook').trim();
  const payload = {
    message,
    audience,
    channels,
    couponCode,
    targetsCount: targets.length,
    targets
  };

  let forwarded = false;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      console.error('Campaign webhook responded with non-OK:', response.status, response.statusText);
    } else {
      forwarded = true;
    }
  } catch (err) {
    console.error('Campaign webhook failed:', err);
  }

  res.status(200).json({
    success: true,
    message: 'Campaign launch accepted',
    data: {
      audience,
      channels,
      targetsCount: targets.length,
      forwarded
    },
    timestamp: new Date().toISOString()
  });
});
