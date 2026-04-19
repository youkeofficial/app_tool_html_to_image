import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';

const dataDir = path.join(__dirname, '..', '..', 'data');

export const generate = async (req: AuthRequest, res: Response) => {
    const { html, templateId, variables, filename, width = 1280, height = 720 } = req.body;
    const userId = req.user!.id;

    let finalHtml = html;
    if (templateId) {
        const template = db.prepare('SELECT html_content FROM templates WHERE id = ?').get(templateId) as any;
        if (!template) return res.status(404).json({ error: 'Template not found' });
        const compiled = Handlebars.compile(template.html_content);
        finalHtml = compiled(variables || {});
    }

    const name = filename ? filename.replace(/\.[^/.]+$/, "") : uuidv4();
    const finalFilename = `${name}.png`;
    const outputPath = path.join(dataDir, finalFilename);

    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        await page.screenshot({ path: outputPath });
        await browser.close();

        const url = `/files/${finalFilename}`;

        // Enregistrement spécifique
        db.prepare('INSERT INTO image_records (id, user_id, html, url) VALUES (?, ?, ?, ?)')
          .run(uuidv4(), userId, finalHtml, url);

        // Historique global
        db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, 'image', finalHtml, url);

        res.json({ status: 'completed', url });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getHistory = (req: AuthRequest, res: Response) => {
    const history = db.prepare('SELECT * FROM image_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user!.id);
    res.json(history);
};

