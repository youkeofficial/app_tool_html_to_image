import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const dataDir = path.join(__dirname, '..', '..', 'data');

export const generate = async (req: AuthRequest, res: Response) => {
    const { text, lang = 'fr', filename } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const name = filename ? filename.replace(/\.[^/.]+$/, "") : uuidv4();
    const finalFilename = `${name}.mp3`;
    const outputPath = path.join(dataDir, finalFilename);
    const userId = req.user!.id;

    try {
        const response = await axios.get('https://translate.google.com/translate_tts', {
            params: { ie: 'UTF-8', q: text, tl: lang, client: 'tw-ob' },
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        fs.writeFileSync(outputPath, response.data);

        const url = `/files/${finalFilename}`;
        
        // Enregistrement spécifique
        db.prepare('INSERT INTO audio_records (id, user_id, text, lang, url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, text, lang, url);

        // Historique global
        db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, 'audio', text, url);

        res.json({ status: 'completed', url });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getHistory = (req: AuthRequest, res: Response) => {
    const history = db.prepare('SELECT * FROM audio_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user!.id);
    res.json(history);
};

