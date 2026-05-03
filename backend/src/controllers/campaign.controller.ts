import { Request, Response } from 'express';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import Campaign, { CampaignPlatform, CampaignStatus } from '../models/Campaign';

type LaunchBody = {
  title: string;
  content: string;
  mediaUrl?: string;
  platforms: CampaignPlatform[];
  scheduledAt?: string;
};

type CampaignListFilters = {
  status?: CampaignStatus;
  limit?: number;
};

function appendSourceParam(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    if (!url.searchParams.has('source')) {
      url.searchParams.set('source', 'campaign');
    }
    return url.toString();
  } catch {
    return urlStr;
  }
}

function processCampaignContent(content: string): string {
  const urlRegex = /https?:\/\/[^\s)]+/gi;
  return content.replace(urlRegex, (url) => appendSourceParam(url));
}

function normalizePlatforms(value: unknown): CampaignPlatform[] {
  const items = Array.isArray(value) ? value : [];
  const normalized = items
    .map((p) => String(p || '').trim().toLowerCase())
    .filter((p): p is CampaignPlatform => p === 'facebook' || p === 'instagram');
  return Array.from(new Set(normalized));
}

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const filters: CampaignListFilters = {
    status:
      typeof req.query.status === 'string' &&
      ['draft', 'pending', 'published', 'failed'].includes(req.query.status)
        ? (req.query.status as CampaignStatus)
        : undefined,
    limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20
  };

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;

  const docs = await Campaign.find(query).sort({ createdAt: -1 }).limit(limit).lean();

  res.status(200).json({
    success: true,
    data: docs,
    timestamp: new Date().toISOString()
  });
});

export const launchCampaign = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as LaunchBody;
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : undefined;
  const platforms = normalizePlatforms(body.platforms);
  const scheduledAtRaw = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const scheduledAt =
    scheduledAtRaw && !Number.isNaN(scheduledAtRaw.getTime()) ? scheduledAtRaw : null;

  if (!title) {
    throw createValidationError('title is required');
  }
  if (!content) {
    throw createValidationError('content is required');
  }
  if (platforms.length === 0) {
    throw createValidationError('platforms must include at least one of: facebook, instagram');
  }

  const processedContent = processCampaignContent(content);

  const campaign = await Campaign.create({
    title,
    content: processedContent,
    mediaUrl: mediaUrl || undefined,
    platforms,
    status: 'pending',
    scheduledAt
  });

  const campaignId = String(campaign._id);
  const webhookUrl = (process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://example.com/n8n-campaign-webhook').trim();

  const payload = {
    campaignId,
    title,
    content: processedContent,
    mediaUrl: mediaUrl || null,
    platforms,
    scheduledAt: scheduledAt ? scheduledAt.toISOString() : null
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = (await response.json()) as Record<string, unknown>;
    } catch {
      responseJson = null;
    }

    if (!response.ok) {
      const failurePayload = {
        statusCode: response.status,
        statusText: response.statusText,
        body: responseJson
      };
      const failed = await Campaign.findByIdAndUpdate(
        campaignId,
        { $set: { status: 'failed', n8nResponse: failurePayload } },
        { new: true }
      ).lean();

      return res.status(502).json({
        success: false,
        message: 'Webhook returned an error response',
        data: failed,
        timestamp: new Date().toISOString()
      });
    }

    const published = await Campaign.findByIdAndUpdate(
      campaignId,
      {
        $set: {
          status: 'published',
          n8nResponse: responseJson || { ok: true }
        }
      },
      { new: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Campaign launched successfully',
      data: published,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const failurePayload = {
      error: err instanceof Error ? err.message : 'Webhook request failed'
    };
    const failed = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: { status: 'failed', n8nResponse: failurePayload } },
      { new: true }
    ).lean();

    return res.status(502).json({
      success: false,
      message: 'Failed to reach campaign webhook',
      data: failed,
      timestamp: new Date().toISOString()
    });
  }
});

export const createDraftCampaign = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as LaunchBody;
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : undefined;
  const platforms = normalizePlatforms(body.platforms);
  const scheduledAtRaw = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const scheduledAt =
    scheduledAtRaw && !Number.isNaN(scheduledAtRaw.getTime()) ? scheduledAtRaw : null;

  if (!title) throw createValidationError('title is required');
  if (!content) throw createValidationError('content is required');
  if (!platforms.length) {
    throw createValidationError('platforms must include at least one of: facebook, instagram');
  }

  const draft = await Campaign.create({
    title,
    content: processCampaignContent(content),
    mediaUrl: mediaUrl || undefined,
    platforms,
    scheduledAt,
    status: 'draft'
  });

  res.status(201).json({
    success: true,
    message: 'Campaign draft created',
    data: draft,
    timestamp: new Date().toISOString()
  });
});
