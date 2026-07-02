import { Request, Response, NextFunction } from 'express';
import jwt                                  from 'jsonwebtoken';
import { JwtPayload }                       from '../types';

const authenticate = async (
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> => {

  // Get access token from cookie
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    res.status(401).json({ 
      error: 'Not authenticated',
      code:  'NO_TOKEN'          // Frontend uses this to trigger refresh
    });
    return;
  }

  try {
    // Verify access token
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    // Attach userId to request for use in controllers
    req.userId = decoded.userId;
    next();

  } catch (err: any) {

    // Token expired specifically
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ 
        error: 'Access token expired',
        code:  'TOKEN_EXPIRED'   // Frontend uses this to trigger refresh
      });
      return;
    }

    // Any other token error
    res.status(401).json({ 
      error: 'Invalid token',
      code:  'INVALID_TOKEN'
    });
  }
};

export default authenticate;