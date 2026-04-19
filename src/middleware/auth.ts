import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-saas-2024';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        permissions: string[];
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

export const checkPermission = (requiredPermission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ error: 'Auth context missing' });

        if (req.user.permissions.includes('ADMIN') || req.user.permissions.includes(requiredPermission)) {
            return next();
        }

        return res.status(403).json({ 
            error: 'Forbidden: Insufficient permissions', 
            required: requiredPermission 
        });
    };
};

