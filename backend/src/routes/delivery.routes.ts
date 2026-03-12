import { Router } from 'express';
import {
  postCalculateFee,
  getPricing,
  createPricing,
  updatePricing,
  deletePricing,
  getCityOverrides,
  createCityOverride,
  updateCityOverride,
  deleteCityOverride
} from '../controllers/delivery.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const { authenticate, authorize } = require('../middleware/auth');

/** GET /api/delivery – delivery options / health; ensures GET /api/delivery does not 404 */
router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Delivery API', calculateFee: 'POST /calculate-fee' });
});

router.post('/calculate-fee', asyncHandler(postCalculateFee as any));

/** Public: pricing and cities (for checkout). Admin-only: mutations. */
router.get('/pricing', asyncHandler(getPricing as any));
router.post('/pricing', authenticate, authorize('admin'), asyncHandler(createPricing as any));
router.put('/pricing/:id', authenticate, authorize('admin'), asyncHandler(updatePricing as any));
router.delete('/pricing/:id', authenticate, authorize('admin'), asyncHandler(deletePricing as any));

router.get('/cities', asyncHandler(getCityOverrides as any));
router.post('/cities', authenticate, authorize('admin'), asyncHandler(createCityOverride as any));
router.put('/cities/:id', authenticate, authorize('admin'), asyncHandler(updateCityOverride as any));
router.delete('/cities/:id', authenticate, authorize('admin'), asyncHandler(deleteCityOverride as any));

export default router;
