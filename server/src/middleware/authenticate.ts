import { Request, Response, NextFunction } from 'express';
import jwt                                  from 'jsonwebtoken';
import pool                                 from '../config/db';
import { JwtPayload }                       from '../types';

const authenticate = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    res.status(401).json({ error: 'Not authenticated', code: 'NO_TOKEN' });
    return;
  }

  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    // Fetch user role from DB
    const result = await pool.query(
      `SELECT id, role FROM users
       WHERE id        = $1
       AND   is_active = TRUE`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.userId = decoded.userId;
    req.role   = result.rows[0].role;
    next();

  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

export default authenticate;