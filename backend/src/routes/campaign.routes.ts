import express from 'express';
import { launchCampaign } from '../controllers/campaign.controller';

const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../config/role-access');

router.post('/launch', authenticate, requireAdmin, launchCampaign);

export default router;
