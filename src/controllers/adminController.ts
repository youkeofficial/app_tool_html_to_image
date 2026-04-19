import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../db';

export const listUsers = (req: AuthRequest, res: Response) => {
    const users = db.prepare('SELECT id, email, permissions, api_key, created_at FROM users').all();
    res.json(users.map((u: any) => ({ ...u, permissions: JSON.parse(u.permissions) })));
};

export const updateUserPermissions = (req: AuthRequest, res: Response) => {
    const { userId, permissions } = req.body;
    if (!userId || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'userId and permissions array required' });
    }

    try {
        db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), userId);
        res.json({ message: 'Permissions updated successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteUser = (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ message: 'User deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const listAllJobs = (req: AuthRequest, res: Response) => {
    const jobs = db.prepare(`
        SELECT jobs.*, users.email 
        FROM jobs 
        JOIN users ON jobs.user_id = users.id 
        ORDER BY created_at DESC
    `).all();
    res.json(jobs);
};

export const deleteJob = (req: AuthRequest, res: Response) => {
    const { jobId } = req.params;
    try {
        db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
        res.json({ message: 'Job deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

