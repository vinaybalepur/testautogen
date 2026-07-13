import { Request, Response } from 'express';
import pool                   from '../config/db';

// ── GET OWN TOKEN USAGE ────────────────────────────────
export const getMyTokenUsage = async (req: Request, res: Response): Promise<void> => {
  const { period } = req.query;   // 7, 30, 60 or lifetime

  try {
    // Build date filter
    const dateFilter = period && period !== 'lifetime'
      ? `AND created_at >= NOW() - INTERVAL '${period} days'`
      : '';

    // Lifetime total
    const lifetimeResult = await pool.query(
      `SELECT COALESCE(SUM(tokens_consumed), 0) AS lifetime_total
       FROM token_usage
       WHERE user_id = $1`,
      [req.userId]
    );

    // Period total
    const periodResult = await pool.query(
      `SELECT COALESCE(SUM(tokens_consumed), 0) AS period_total
       FROM token_usage
       WHERE user_id = $1 ${dateFilter}`,
      [req.userId]
    );

    // Breakdown by provider
    const byProvider = await pool.query(
      `SELECT
         provider,
         SUM(tokens_consumed) AS total_tokens,
         COUNT(*)             AS total_calls
       FROM token_usage
       WHERE user_id = $1 ${dateFilter}
       GROUP BY provider
       ORDER BY total_tokens DESC`,
      [req.userId]
    );

    // Breakdown by model
    const byModel = await pool.query(
      `SELECT
         provider,
         model_family,
         model_version,
         SUM(tokens_consumed) AS total_tokens,
         COUNT(*)             AS total_calls
       FROM token_usage
       WHERE user_id = $1 ${dateFilter}
       GROUP BY provider, model_family, model_version
       ORDER BY total_tokens DESC`,
      [req.userId]
    );

    // Breakdown by action
    const byAction = await pool.query(
      `SELECT
         action,
         SUM(tokens_consumed) AS total_tokens,
         COUNT(*)             AS total_calls
       FROM token_usage
       WHERE user_id = $1 ${dateFilter}
       GROUP BY action
       ORDER BY total_tokens DESC`,
      [req.userId]
    );

    // Daily usage trend
    const dailyTrend = await pool.query(
      `SELECT
         DATE(created_at)     AS date,
         SUM(tokens_consumed) AS total_tokens,
         COUNT(*)             AS total_calls
       FROM token_usage
       WHERE user_id = $1 ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [req.userId]
    );

    res.json({
      period:         period || 'lifetime',
      lifetimeTotal:  parseInt(lifetimeResult.rows[0].lifetime_total),
      periodTotal:    parseInt(periodResult.rows[0].period_total),
      byProvider:     byProvider.rows,
      byModel:        byModel.rows,
      byAction:       byAction.rows,
      dailyTrend:     dailyTrend.rows
    });

  } catch (err) {
    console.error('Get token usage error:', err);
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
};

// ── GET ALL USERS TOKEN USAGE (Admin only) ─────────────
export const getAllUsersTokenUsage = async (req: Request, res: Response): Promise<void> => {
  const { period } = req.query;

  try {
    const dateFilter = period && period !== 'lifetime'
      ? `AND tu.created_at >= NOW() - INTERVAL '${period} days'`
      : '';

    // Per user summary
    const perUser = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.role,
         COALESCE(SUM(tu.tokens_consumed), 0) AS total_tokens,
         COUNT(tu.id)                          AS total_calls
       FROM users u
       LEFT JOIN token_usage tu ON tu.user_id = u.id ${dateFilter}
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
       ORDER BY total_tokens DESC`,
      []
    );

    // Overall total
    const overallTotal = await pool.query(
      `SELECT COALESCE(SUM(tokens_consumed), 0) AS grand_total
       FROM token_usage
       WHERE 1=1 ${dateFilter}`,
      []
    );

    // Breakdown by provider across all users
    const byProvider = await pool.query(
      `SELECT
         provider,
         SUM(tokens_consumed) AS total_tokens,
         COUNT(*)             AS total_calls,
         COUNT(DISTINCT user_id) AS unique_users
       FROM token_usage
       WHERE 1=1 ${dateFilter}
       GROUP BY provider
       ORDER BY total_tokens DESC`,
      []
    );

    // Breakdown by model across all users
    const byModel = await pool.query(
      `SELECT
         provider,
         model_family,
         model_version,
         SUM(tokens_consumed)    AS total_tokens,
         COUNT(*)                AS total_calls,
         COUNT(DISTINCT user_id) AS unique_users
       FROM token_usage
       WHERE 1=1 ${dateFilter}
       GROUP BY provider, model_family, model_version
       ORDER BY total_tokens DESC`,
      []
    );

    // Breakdown by action across all users
    const byAction = await pool.query(
      `SELECT
         action,
         SUM(tokens_consumed)    AS total_tokens,
         COUNT(*)                AS total_calls,
         COUNT(DISTINCT user_id) AS unique_users
       FROM token_usage
       WHERE 1=1 ${dateFilter}
       GROUP BY action
       ORDER BY total_tokens DESC`,
      []
    );

    res.json({
      period:      period || 'lifetime',
      grandTotal:  parseInt(overallTotal.rows[0].grand_total),
      perUser:     perUser.rows,
      byProvider:  byProvider.rows,
      byModel:     byModel.rows,
      byAction:    byAction.rows
    });

  } catch (err) {
    console.error('Get all users token usage error:', err);
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
};