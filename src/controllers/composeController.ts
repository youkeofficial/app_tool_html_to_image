import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const dataDir = path.join(__dirname, '..', '..', 'data');

export const compose = async (req: AuthRequest, res: Response) => {
    const { videoFile, audioFile, filename } = req.body;
    if (!videoFile || !audioFile) return res.status(400).json({ error: 'videoFile and audioFile required' });

    const name = filename ? filename.replace(/\.[^/.]+$/, "") : uuidv4();
    const finalFilename = `${name}_composed.mp4`;
    const outputPath = path.join(dataDir, finalFilename);
    const userId = req.user!.id;

    ffmpeg()
        .input(path.join(dataDir, videoFile))
        .input(path.join(dataDir, audioFile))
        .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0', '-shortest'])
        .save(outputPath)
        .on('end', () => {
            const url = `/files/${finalFilename}`;
            
            // Enregistrement spécifique
            db.prepare('INSERT INTO composition_records (id, user_id, source_video, source_audio, url) VALUES (?, ?, ?, ?, ?)')
              .run(uuidv4(), userId, videoFile, audioFile, url);

            // Historique global
            db.prepare('INSERT INTO history (id, user_id, type, context, result_url) VALUES (?, ?, ?, ?, ?)')
              .run(uuidv4(), userId, 'compose', `${videoFile} + ${audioFile}`, url);

            res.json({ status: 'completed', url });
        })
        .on('error', (err) => {
            res.status(500).json({ error: err.message });
        });
};

export const getHistory = (req: AuthRequest, res: Response) => {
    const history = db.prepare('SELECT * FROM composition_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user!.id);
    res.json(history);
};

