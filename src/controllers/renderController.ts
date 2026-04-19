import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import ffmpeg from 'fluent-ffmpeg';
import Handlebars from 'handlebars';
import logger from '../logger';

const dataDir = path.join(__dirname, '..', '..', 'data');

// Helpers (migrés de index.ts)
const toSnakeCase = (str: string) => str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s\W]+/g, '_').toLowerCase().replace(/^_|_$/g, '');

const generateFilename = (providedName: string | undefined, contentToParse: string, extension: string) => {
    let name = providedName ? toSnakeCase(providedName.replace(/\.[^/.]+$/, "")) : uuidv4();
    return `${name}${extension}`;
};

const getBrowser = async () => {
    return await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });
};

export const generateImage = async (req: AuthRequest, res: Response) => {
    const { html, templateId, variables, filename, width = 1280, height = 720 } = req.body;
    const userId = req.user!.id;

    // Logique de template
    let finalHtml = html;
    if (templateId) {
        const template = db.prepare('SELECT html_content FROM templates WHERE id = ?').get(templateId) as any;
        if (!template) return res.status(404).json({ error: 'Template not found' });
        const compiled = Handlebars.compile(template.html_content);
        finalHtml = compiled(variables || {});
    }

    const finalFilename = generateFilename(filename, finalHtml, '.png');
    const outputPath = path.join(dataDir, finalFilename);
    const jobId = uuidv4();

    // Insertion du Job
    db.prepare('INSERT INTO jobs (id, user_id, type, status, input_data) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, userId, 'image', 'processing', JSON.stringify(req.body));

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        await page.screenshot({ path: outputPath });
        await browser.close();

        db.prepare('UPDATE jobs SET status = ?, result_url = ? WHERE id = ?')
          .run('completed', `/files/${finalFilename}`, jobId);

        // Ajout à l'historique spécial
        db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, 'image', finalHtml, `/files/${finalFilename}`);

        res.json({ id: jobId, status: 'completed', url: `/files/${finalFilename}` });
    } catch (error: any) {
        db.prepare('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', error.message, jobId);
        res.status(500).json({ error: error.message });
    }
};

export const generateVideo = async (req: AuthRequest, res: Response) => {
    const { html, templateId, variables, filename, width = 1280, height = 720, duration = 5, fps = 30 } = req.body;
    const userId = req.user!.id;

    let finalHtml = html;
    if (templateId) {
        const template = db.prepare('SELECT html_content FROM templates WHERE id = ?').get(templateId) as any;
        if (!template) return res.status(404).json({ error: 'Template not found' });
        const compiled = Handlebars.compile(template.html_content);
        finalHtml = compiled(variables || {});
    }

    const finalFilename = generateFilename(filename, finalHtml, '.mp4');
    const outputPath = path.join(dataDir, finalFilename);
    const jobId = uuidv4();

    db.prepare('INSERT INTO jobs (id, user_id, type, status, input_data) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, userId, 'video', 'processing', JSON.stringify(req.body));

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        const recorder = new PuppeteerScreenRecorder(page, { fps });
        await recorder.start(outputPath);
        await new Promise(resolve => setTimeout(resolve, duration * 1000));
        await recorder.stop();
        await browser.close();

        db.prepare('UPDATE jobs SET status = ?, result_url = ? WHERE id = ?')
          .run('completed', `/files/${finalFilename}`, jobId);

        // Ajout à l'historique spécial
        db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, 'video', finalHtml, `/files/${finalFilename}`);

        res.json({ id: jobId, status: 'completed', url: `/files/${finalFilename}` });
    } catch (error: any) {
        db.prepare('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', error.message, jobId);
        res.status(500).json({ error: error.message });
    }
};

export const generateAudio = async (req: AuthRequest, res: Response) => {
    const { text, lang = 'fr', filename } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const finalFilename = generateFilename(filename, text, '.mp3');
    const outputPath = path.join(dataDir, finalFilename);
    const jobId = uuidv4();

    db.prepare('INSERT INTO jobs (id, user_id, type, status, input_data) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, req.user!.id, 'audio', 'processing', JSON.stringify(req.body));

    try {
        // Simple Google TTS helper (adapted from initial index.ts)
        const response = await (await import('axios')).default.get('https://translate.google.com/translate_tts', {
            params: { ie: 'UTF-8', q: text, tl: lang, client: 'tw-ob' },
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        fs.writeFileSync(outputPath, response.data);

        db.prepare('UPDATE jobs SET status = ?, result_url = ? WHERE id = ?')
          .run('completed', `/files/${finalFilename}`, jobId);

        // Ajout à l'historique spécial
        db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), req.user!.id, 'audio', text, `/files/${finalFilename}`);

        res.json({ id: jobId, status: 'completed', url: `/files/${finalFilename}` });
    } catch (err: any) {
        db.prepare('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?')
          .run('failed', err.message, jobId);
        res.status(500).json({ error: err.message });
    }
};

export const composeVideoAudio = async (req: AuthRequest, res: Response) => {
    const { videoFile, audioFile, filename } = req.body;
    if (!videoFile || !audioFile) return res.status(400).json({ error: 'videoFile and audioFile required' });

    const finalFilename = generateFilename(filename, 'compose', '.mp4');
    const outputPath = path.join(dataDir, finalFilename);
    const jobId = uuidv4();

    db.prepare('INSERT INTO jobs (id, user_id, type, status, input_data) VALUES (?, ?, ?, ?, ?)')
      .run(jobId, req.user!.id, 'compose', 'processing', JSON.stringify(req.body));

    ffmpeg()
        .input(path.join(dataDir, videoFile))
        .input(path.join(dataDir, audioFile))
        .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0', '-shortest'])
        .save(outputPath)
        .on('end', () => {
            db.prepare('UPDATE jobs SET status = ?, result_url = ? WHERE id = ?')
              .run('completed', `/files/${finalFilename}`, jobId);
            res.json({ id: jobId, status: 'completed', url: `/files/${finalFilename}` });
        })
        .on('error', (err) => {
            db.prepare('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?')
              .run('failed', err.message, jobId);
            res.status(500).json({ error: err.message });
        });
};

export const listFiles = (req: AuthRequest, res: Response) => {
    const files = fs.readdirSync(dataDir).filter(f => !f.startsWith('.'));
    res.json(files);
};

export const getTemplates = (req: AuthRequest, res: Response) => {
    const templates = db.prepare('SELECT * FROM templates WHERE is_public = 1 OR user_id = ?').all(req.user!.id);
    res.json(templates);
};

export const getHistory = (req: AuthRequest, res: Response) => {
    const { type } = req.query;
    let query = 'SELECT * FROM history WHERE user_id = ?';
    const params = [req.user!.id];

    if (type) {
        query += ' AND type = ?';
        params.push(type as string);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    try {
        const history = db.prepare(query).all(...params);
        res.json(history);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getMagicIdea = async (req: AuthRequest, res: Response) => {
    const n8nEndpoint = process.env.N8N_ENDPOINT;
    if (!n8nEndpoint) {
        return res.status(501).json({ error: 'Magic Idea feature not configured (N8N_ENDPOINT missing)' });
    }

    try {
        const type = req.body.type || 'image'; // image, video, audio
        const prompt = req.body.prompt || 'Surprise me!';
        
        // Le workflow n8n route via Switch (type) + agents dédiés avec leurs propres system prompts
        // On passe uniquement les params attendus par le Webhook n8n
        logger.info(`Calling n8n Magic Engine (GET) at: ${n8nEndpoint}`, { type, prompt });
        
        const response = await (await import('axios')).default.get(n8nEndpoint, {
            params: { type, prompt },
            timeout: 2400000
        });

        let result = response.data;

        // Normalisation : le workflow n8n audio retourne { "texte": "..." }
        // On uniformise en { "text": "..." } pour le frontend
        if (typeof result === 'string') {
            result = { text: result };
        } else if (result?.texte && !result?.text) {
            result = { text: result.texte };
        }

        res.json(result);
    } catch (err: any) {
        const status = err.response?.status || 502;
        const detail = err.response?.data?.message || err.message;
        logger.error(`n8n request failed (${status})`, { url: n8nEndpoint, error: detail });
        
        res.status(status).json({ 
            error: `Magic Engine unreachable (Status: ${status})`,
            detail: detail
        });
    }
};

