import { Request, Response }      from 'express';
import pool                        from '../config/db';
import { encrypt, decrypt }        from '../utils/encryption';
import { getModelsForProvider }    from '../services/modelService';

// ── SAVE AI CONFIG ─────────────────────────────────────
export const saveAIConfig = async (req: Request, res: Response): Promise<void> => {
  const { provider, api_key } = req.body;

  if (!provider || !api_key) {
    res.status(400).json({ error: 'provider and api_key are required' });
    return;
  }

  try {
    // Validate key by fetching models
    const { models, source } = await getModelsForProvider(provider, api_key);

    // Encrypt key before storing
    const encryptedKey = encrypt(api_key);

    // Save to DB
    const result = await pool.query(
      `INSERT INTO user_ai_configs
        (user_id, provider, api_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET
         api_key    = EXCLUDED.api_key,
         is_active  = TRUE,
         updated_at = NOW()
       RETURNING id, provider, is_active, created_at`,
      [req.userId, provider, encryptedKey]
    );

    res.status(201).json({
      message: `${provider} API key saved successfully`,
      config:  result.rows[0],
      models,
      source
    });

  } catch (err: any) {
    
    if (
      err.message?.includes('Invalid') ||
      err.response?.status === 401
    ) {
      res.status(401).json({ error: `Invalid ${provider} API key` });
      return;
    }
    console.error('Save AI config error details:');
    console.error('Message:', err.message);
    console.error('Stack:',   err.stack);
    console.error('Response:', err.response?.data);
    console.error('Status:',  err.response?.status);
    console.error('Save AI config error:', err.message);
    res.status(500).json({ error: 'Failed to save AI config' });
  }
};

// ── GET USER AI CONFIGS ────────────────────────────────
export const getAIConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, provider, is_active, created_at, updated_at
       FROM user_ai_configs
       WHERE user_id = $1
       ORDER BY provider ASC`,
      [req.userId]
    );

    res.json({ configs: result.rows });  // ← never return api_key

  } catch (err) {
    console.error('Get AI configs error:', err);
    res.status(500).json({ error: 'Failed to fetch AI configs' });
  }
};

// ── GET MODELS FOR PROVIDER ────────────────────────────
export const getModels = async (req: Request, res: Response): Promise<void> => {
  const provider = req.params.provider as string;

  try {
    // Get encrypted key from DB
    const result = await pool.query(
      `SELECT api_key FROM user_ai_configs
       WHERE user_id   = $1
       AND   provider  = $2
       AND   is_active = TRUE`,
      [req.userId, provider]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: `No ${provider} API key configured. Please add your API key in Settings.`
      });
      return;
    }

    // Decrypt key
    const apiKey = decrypt(result.rows[0].api_key);

    // Fetch models — API first, DB fallback
    const { models, source } = await getModelsForProvider(provider, apiKey);

    res.json({ provider, models, source });

  } catch (err: any) {
    console.error('Get models error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch models' });
  }
};

// ── DELETE AI CONFIG ───────────────────────────────────
export const deleteAIConfig = async (req: Request, res: Response): Promise<void> => {
  const provider = req.params.provider as string;

  try {
    const result = await pool.query(
      `DELETE FROM user_ai_configs
       WHERE user_id  = $1
       AND   provider = $2
       RETURNING id`,
      [req.userId, provider]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    res.json({ message: `${provider} API key deleted successfully` });

  } catch (err) {
    console.error('Delete AI config error:', err);
    res.status(500).json({ error: 'Failed to delete config' });
  }
};

// ── GET DECRYPTED KEY (internal use only) ──────────────
export const getDecryptedKey = async (
  userId:   number,
  provider: string
): Promise<string | null> => {
  try {
    const result = await pool.query(
      `SELECT api_key FROM user_ai_configs
       WHERE user_id   = $1
       AND   provider  = $2
       AND   is_active = TRUE`,
      [userId, provider]
    );

    if (result.rows.length === 0) return null;
    return decrypt(result.rows[0].api_key);

  } catch {
    return null;
  }
};