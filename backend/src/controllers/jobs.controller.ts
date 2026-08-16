import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * POST /api/jobs/review-request-emails
 * Legacy cron endpoint — automatic review emails were replaced by manual admin send.
 */
export const runReviewRequestEmailsJob = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      suppressed: false,
      mode: 'manual_only',
      message: 'Automatic review-request emails are disabled; use the admin send button per order'
    },
    timestamp: new Date().toISOString()
  });
});
