import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import expressLayouts from 'express-ejs-layouts';
import logger from './logger.js';

import authRoutes from './routes/authRoutes.js';
import renderRoutes from './routes/renderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const PORT = process.env.PORT || 5003;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Global variables for EJS
app.use((req, res, next) => {
    res.locals.magicEnabled = !!process.env.N8N_ENDPOINT;
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Logger de requêtes pour débugger les 404
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// 2. Routes API (Priorité Haute)
app.use('/api/auth', authRoutes);
app.use('/api/render', renderRoutes);
app.use('/api/admin', adminRoutes);

// 3. Fichiers Statiques Public (Seulement si aucune route n'a matché)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
app.use('/files', express.static(dataDir));

// 4. Routes des Pages EJS
app.get('/', (req, res) => res.render('pages/index', { layout: 'layout' }));
app.get('/dashboard', (req, res) => res.render('pages/dashboard'));
app.get('/audio', (req, res) => res.render('pages/audio'));
app.get('/video', (req, res) => res.render('pages/video'));
app.get('/compose', (req, res) => res.render('pages/compose'));
app.get('/admin', (req, res) => res.render('pages/admin'));

app.listen(PORT, () => {
    logger.info(`SaaS Render Server running on port ${PORT}`);
});