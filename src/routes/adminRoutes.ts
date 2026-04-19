import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate, checkPermission } from '../middleware/auth';

const router = Router();

// Toutes les routes ici nécessitent d'être ADMIN
router.use(authenticate);
router.use(checkPermission('ADMIN'));

router.get('/users', adminController.listUsers);
router.put('/users/permissions', adminController.updateUserPermissions);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/jobs', adminController.listAllJobs);
router.delete('/jobs/:jobId', adminController.deleteJob);

export default router;

