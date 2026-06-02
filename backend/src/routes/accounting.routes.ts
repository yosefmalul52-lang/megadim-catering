import { Router } from 'express';
import { getSummary, getTransactions, createExternal, uploadDocument } from '../controllers/accounting.controller';
import uploadDocumentMiddleware from '../config/upload-document.config';

const { authenticate } = require('../middleware/auth');
const { requireAdmin }  = require('../config/role-access');

const router = Router();

// All accounting routes require a valid admin JWT
router.use(authenticate, requireAdmin);

router.get('/summary',      getSummary);
router.get('/transactions',  getTransactions);
router.post('/external',    createExternal);
router.post('/upload',      uploadDocumentMiddleware.single('file'), uploadDocument);

export default router;
