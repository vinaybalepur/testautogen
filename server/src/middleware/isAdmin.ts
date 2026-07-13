import { Request, Response, NextFunction } from 'express';

const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin only.' });
    return;
  }
  next();
};

export default isAdmin;