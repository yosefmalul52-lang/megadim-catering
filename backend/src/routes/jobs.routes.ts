import express from 'express';
import { runReviewRequestEmailsJob } from '../controllers/jobs.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.post('/review-request-emails', authenticate, requireAdmin, runReviewRequestEmailsJob);

export default router;
