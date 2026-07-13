import { Request, Response } from 'express';
import pool                   from '../config/db';

// ── GET ALL USERS (Admin only) ─────────────────────────
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_active, last_login_at, created_at
       FROM users
       ORDER BY created_at ASC`
    );

    res.json({
      count: result.rows.length,
      users: result.rows
    });

  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// ── PROMOTE USER TO ADMIN ──────────────────────────────
export const promoteToAdmin = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  // Prevent self promotion
  if (parseInt(userId) === req.userId) {
    res.status(400).json({ error: 'You cannot change your own role' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = 'admin'
       WHERE id = $1
       RETURNING id, first_name, email, role`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: `${result.rows[0].first_name} promoted to admin`,
      user:    result.rows[0]
    });

  } catch (err) {
    console.error('Promote to admin error:', err);
    res.status(500).json({ error: 'Failed to promote user' });
  }
};

// ── DEMOTE ADMIN TO USER ───────────────────────────────
export const demoteToUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  // Prevent self demotion
  if (parseInt(userId) === req.userId) {
    res.status(400).json({ error: 'You cannot change your own role' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = 'user'
       WHERE id = $1
       RETURNING id, first_name, email, role`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: `${result.rows[0].first_name} demoted to user`,
      user:    result.rows[0]
    });

  } catch (err) {
    console.error('Demote to user error:', err);
    res.status(500).json({ error: 'Failed to demote user' });
  }
};

// ── ACTIVATE / DEACTIVATE USER ─────────────────────────
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  // Prevent self deactivation
  if (parseInt(userId) === req.userId) {
    res.status(400).json({ error: 'You cannot deactivate your own account' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET is_active = NOT is_active
       WHERE id = $1
       RETURNING id, first_name, email, is_active`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const status = result.rows[0].is_active ? 'activated' : 'deactivated';

    res.json({
      message: `${result.rows[0].first_name} ${status}`,
      user:    result.rows[0]
    });

  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};  