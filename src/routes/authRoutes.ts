import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);
router.delete('/account', authenticate, authController.deleteAccount);
router.post('/reset-admin', authController.resetAdminPassword);

export default router;

