import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth';

import * as audioController from '../controllers/audioController';
import * as imageController from '../controllers/imageController';
import * as videoController from '../controllers/videoController';
import * as composeController from '../controllers/composeController';
import * as renderController from '../controllers/renderController';

const router = Router();

// Routes Audio
router.post('/audio', authenticate, checkPermission('CREATE_AUDIO'), audioController.generate);
router.get('/audio/history', authenticate, audioController.getHistory);

// Routes Image
router.post('/image', authenticate, checkPermission('CREATE_IMAGE'), imageController.generate);
router.get('/image/history', authenticate, imageController.getHistory);

// Routes Video
router.post('/video', authenticate, checkPermission('CREATE_VIDEO'), videoController.generate);
router.get('/video/history', authenticate, videoController.getHistory);

// Routes Compose
router.post('/compose', authenticate, checkPermission('COMPOSE_AUDIO_VIDEO'), composeController.compose);
router.get('/compose/history', authenticate, composeController.getHistory);

// Global Routes
router.get('/history', authenticate, renderController.getHistory);
router.post('/magic-idea', authenticate, renderController.getMagicIdea);
router.get('/templates', authenticate, renderController.getTemplates);
router.get('/files', authenticate, renderController.listFiles);

export default router;

