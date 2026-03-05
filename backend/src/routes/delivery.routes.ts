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

const router = Router();

router.post('/calculate-fee', postCalculateFee);

router.get('/pricing', getPricing);
router.post('/pricing', createPricing);
router.put('/pricing/:id', updatePricing);
router.delete('/pricing/:id', deletePricing);

router.get('/cities', getCityOverrides);
router.post('/cities', createCityOverride);
router.put('/cities/:id', updateCityOverride);
router.delete('/cities/:id', deleteCityOverride);

export default router;
