import { Request, Response } from 'express';
import pool                   from '../config/db';

// ── GET ALL APIs ───────────────────────────────────────
export const getAPIs = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM api_registry
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json({ apis: result.rows });
  } catch (err) {
    console.error('Get APIs error:', err);
    res.status(500).json({ error: 'Failed to fetch APIs' });
  }
};

// ── CREATE API ─────────────────────────────────────────
export const createAPI = async (req: Request, res: Response): Promise<void> => {
  const { name, method, path, auth_type, headers, body } = req.body;

  if (!name || !method || !path) {
    res.status(400).json({ error: 'name, method and path are required' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO api_registry
        (user_id, name, method, path, auth_type, headers, body, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
       RETURNING *`,
      [
        req.userId,
        name,
        method.toUpperCase(),
        path,
        auth_type || 'none',
        JSON.stringify(headers || []),
        body ? JSON.stringify(body) : null
      ]
    );
    res.status(201).json({ message: 'API created', api: result.rows[0] });
  } catch (err) {
    console.error('Create API error:', err);
    res.status(500).json({ error: 'Failed to create API' });
  }
};

// ── UPDATE API ─────────────────────────────────────────
export const updateAPI = async (req: Request, res: Response): Promise<void> => {
  const { id }                                           = req.params;
  const { name, method, path, auth_type, headers, body } = req.body;

  try {
    const result = await pool.query(
      `UPDATE api_registry
       SET
         name      = COALESCE($1, name),
         method    = COALESCE($2, method),
         path      = COALESCE($3, path),
         auth_type = COALESCE($4, auth_type),
         headers   = COALESCE($5, headers),
         body      = COALESCE($6, body),
         updated_at = NOW()
       WHERE id      = $7
       AND   user_id = $8
       RETURNING *`,
      [
        name,
        method?.toUpperCase(),
        path,
        auth_type,
        headers ? JSON.stringify(headers) : null,
        body    ? JSON.stringify(body)    : null,
        id,
        req.userId
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'API not found' });
      return;
    }

    res.json({ message: 'API updated', api: result.rows[0] });
  } catch (err) {
    console.error('Update API error:', err);
    res.status(500).json({ error: 'Failed to update API' });
  }
};

// ── DELETE API ─────────────────────────────────────────
export const deleteAPI = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM api_registry
       WHERE id      = $1
       AND   user_id = $2
       RETURNING id, name`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'API not found' });
      return;
    }

    res.json({ message: `${result.rows[0].name} deleted` });
  } catch (err) {
    console.error('Delete API error:', err);
    res.status(500).json({ error: 'Failed to delete API' });
  }
};

// ── IMPORT FROM POSTMAN COLLECTION ────────────────────
export const importFromPostman = async (req: Request, res: Response): Promise<void> => {
  const { collection } = req.body;

  if (!collection) {
    res.status(400).json({ error: 'Postman collection JSON is required' });
    return;
  }

  try {
    const imported: any[] = [];
    const failed:   any[] = [];

    // Extract requests from collection
    const extractRequests = (items: any[]): any[] => {
      const requests: any[] = [];
      for (const item of items) {
        if (item.request) {
          // It's a request
          requests.push(item);
        } else if (item.item) {
          // It's a folder — recurse
          requests.push(...extractRequests(item.item));
        }
      }
      return requests;
    };

    const items    = collection.item || [];
    const requests = extractRequests(items);

    for (const item of requests) {
      try {
        const request   = item.request;
        const method    = request.method?.toUpperCase() || 'GET';
        const name      = item.name || 'Unnamed API';

        // Extract path
        const rawUrl    = request.url?.raw || request.url || '';
        const path      = rawUrl
          .replace(/{{base_url}}/gi, '')
          .replace(/^https?:\/\/[^/]+/, '')
          .split('?')[0] || '/';

        // Extract headers (ignore auth headers)
        const headers = (request.header || [])
          .filter((h: any) =>
            !['authorization', 'x-api-key'].includes(h.key?.toLowerCase())
          )
          .map((h: any) => ({ key: h.key, value: h.value }));

        // Extract body
        let body = null;
        if (request.body?.raw) {
          try {
            body = JSON.parse(request.body.raw);
          } catch {
            body = { raw: request.body.raw };
          }
        }

        // Detect auth type
        const hasAuth = (request.header || []).some((h: any) =>
          h.key?.toLowerCase() === 'authorization'
        );
        const auth_type = hasAuth ? 'bearer' : 'none';
        const needs_auth = hasAuth;

        const result = await pool.query(
          `INSERT INTO api_registry
            (user_id, name, method, path, auth_type, headers, body, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'postman')
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            req.userId,
            name,
            method,
            path,
            auth_type,
            JSON.stringify(headers),
            body ? JSON.stringify(body) : null
          ]
        );

        imported.push({ name, method, path });

      } catch (itemErr: any) {
        failed.push({ name: item.name, error: itemErr.message });
      }
    }

    res.status(201).json({
      message:  `Imported ${imported.length} APIs successfully`,
      imported: imported.length,
      failed:   failed.length,
      apis:     imported
    });

  } catch (err: any) {
    console.error('Import Postman error:', err.message);
    res.status(500).json({ error: 'Failed to import Postman collection' });
  }
};

// ── SAVE VARIABLE VALUE ────────────────────────────────
export const saveVariable = async (req: Request, res: Response): Promise<void> => {
  const { apiId }       = req.params;
  const { name, value } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Variable name is required' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO api_registry_variables
        (user_id, api_id, name, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, api_id, name)
       DO UPDATE SET value = $4, updated_at = NOW()
       RETURNING *`,
      [req.userId, apiId, name, value]
    );
    res.json({ message: 'Variable saved', variable: result.rows[0] });
  } catch (err) {
    console.error('Save variable error:', err);
    res.status(500).json({ error: 'Failed to save variable' });
  }
};

// ── GET VARIABLES FOR API ──────────────────────────────
export const getVariables = async (req: Request, res: Response): Promise<void> => {
  const { apiId } = req.params;

  try {
    const result = await pool.query(
      `SELECT name, value, updated_at
       FROM api_registry_variables
       WHERE user_id = $1
       AND   api_id  = $2`,
      [req.userId, apiId]
    );
    res.json({ variables: result.rows });
  } catch (err) {
    console.error('Get variables error:', err);
    res.status(500).json({ error: 'Failed to fetch variables' });
  }
};