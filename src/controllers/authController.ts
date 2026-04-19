import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-saas-2024';

// Permissions par défaut pour un nouvel utilisateur
const DEFAULT_PERMISSIONS = [
    'CREATE_IMAGE',
    'CREATE_AUDIO',
    'CREATE_VIDEO',
    'COMPOSE_AUDIO_IMAGE',
    'COMPOSE_AUDIO_VIDEO'
];

const ADMIN_EMAIL = 'ykbass50@gmail.com';
const ADMIN_PERMISSIONS = [
    'ADMIN',
    'CREATE_IMAGE',
    'CREATE_AUDIO',
    'CREATE_VIDEO',
    'COMPOSE_AUDIO_IMAGE',
    'COMPOSE_AUDIO_VIDEO'
];

export const register = (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const passwordHash = bcrypt.hashSync(password, 10);
        const userId = uuidv4();
        const apiKey = uuidv4().replace(/-/g, '');
        const permissions = email === ADMIN_EMAIL ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS;

        const insert = db.prepare(`
            INSERT INTO users (id, email, password_hash, permissions, api_key) 
            VALUES (?, ?, ?, ?, ?)
        `);

        insert.run(userId, email, passwordHash, JSON.stringify(permissions), apiKey);

        res.status(201).json({ 
            message: 'User registered successfully',
            userId 
        });
    } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        res.status(500).json({ error: err.message });
    }
};

export const login = (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
        
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const permissions = JSON.parse(user.permissions);
        const token = jwt.sign(
            { id: user.id, email: user.email, permissions },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                permissions,
                apiKey: user.api_key
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const me = (req: any, res: Response) => {
    res.json(req.user);
};

export const deleteAccount = (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Endpoint non protecté pour reset le mot de passe admin (via secret de développement)
export const resetAdminPassword = (req: Request, res: Response) => {
    const { secret, newPassword } = req.body;
    const devSecret = process.env.DEV_RESET_SECRET || 'reset123';

    if (secret !== devSecret) {
        return res.status(403).json({ error: 'Invalid secret' });
    }

    try {
        const hash = bcrypt.hashSync(newPassword, 10);
        const result = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?')
            .run(hash, ADMIN_EMAIL);
        
        if (result.changes === 0) {
            // Admin n'existe pas, on le crée
            const userId = uuidv4();
            const apiKey = uuidv4().replace(/-/g, '');
            db.prepare('INSERT INTO users (id, email, password_hash, permissions, api_key) VALUES (?, ?, ?, ?, ?)')
                .run(userId, ADMIN_EMAIL, hash, JSON.stringify(ADMIN_PERMISSIONS), apiKey);
            return res.json({ message: 'Admin account created', email: ADMIN_EMAIL });
        }
        
        // Foré ADMIN permissions
        db.prepare('UPDATE users SET permissions = ? WHERE email = ?')
            .run(JSON.stringify(ADMIN_PERMISSIONS), ADMIN_EMAIL);

        res.json({ message: 'Admin password reset', email: ADMIN_EMAIL });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

