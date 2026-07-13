import { Request, Response }           from 'express';
import pool                             from '../config/db';
import { generatePostmanCollection }    from '../services/postmanService';

// ── GENERATE AND STORE COLLECTION ─────────────────────
export const generateCollection = async (req: Request, res: Response): Promise<void> => {
  const {
    ticketKey,
    provider,
    model,
    modelFamily,
    baseUrl,
    username,
    password,
    forceRegenerate   // ← new flag from UI
  } = req.body;

  // Validate required fields
  if (!ticketKey || !provider || !model || !baseUrl || !username || !password) {
    res.status(400).json({
      error: 'ticketKey, provider, model, baseUrl, username and password are required'
    });
    return;
  }

  try {
    // Check if collection already exists
    const existing = await pool.query(
      `SELECT id, collection_name, created_at
       FROM postman_collections
       WHERE ticket_key = $1
       AND   user_id    = $2`,
      [ticketKey, req.userId]
    );

    // If exists and user has not confirmed regeneration
    if (existing.rows.length > 0 && !forceRegenerate) {
      res.status(409).json({
        warning:      'Collection already exists for this ticket',
        message:      'Regenerating will replace the existing collection and consume tokens. Pass forceRegenerate: true to proceed.',
        existingId:   existing.rows[0].id,
        createdAt:    existing.rows[0].created_at,
        forceRegenerate: false
      });
      return;
    }

    // Get approved test cases
    const result = await pool.query(
      `SELECT test_case FROM test_cases
       WHERE jira_id = $1
       AND   user_id = $2
       AND   status  = 'approved'
       ORDER BY created_at ASC`,
      [ticketKey, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No approved test cases found for this ticket' });
      return;
    }

    const testCases = result.rows.map(r => r.test_case);

    // Generate Postman collection via AI
    const { collection, tokensConsumed } = await generatePostmanCollection(
      ticketKey,
      testCases,
      baseUrl,
      username,
      password,
      provider,
      model
    );

    let savedCollection;

    if (existing.rows.length > 0 && forceRegenerate) {
      // Replace existing collection
      savedCollection = await pool.query(
        `UPDATE postman_collections
         SET
           collection_name = $1,
           collection_json = $2,
           created_at      = NOW()
         WHERE ticket_key = $3
         AND   user_id    = $4
         RETURNING id, ticket_key, collection_name, created_at`,
        [
          `${ticketKey} Test Collection`,
          JSON.stringify(collection),
          ticketKey,
          req.userId
        ]
      );
    } else {
      // Insert new collection
      savedCollection = await pool.query(
        `INSERT INTO postman_collections
          (ticket_key, user_id, collection_name, collection_json)
         VALUES ($1, $2, $3, $4)
         RETURNING id, ticket_key, collection_name, created_at`,
        [
          ticketKey,
          req.userId,
          `${ticketKey} Test Collection`,
          JSON.stringify(collection)
        ]
      );
    }

    // Log token usage
    await pool.query(
      `INSERT INTO token_usage
        (user_id, provider, model_family, model_version, action, tokens_consumed)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.userId,
        provider,
        modelFamily || model,
        model,
        'generate_postman_collection',
        tokensConsumed
      ]
    );

    res.status(201).json({
      message:       forceRegenerate
                       ? 'Collection regenerated and replaced successfully'
                       : 'Collection generated and stored successfully',
      collectionId:  savedCollection.rows[0].id,
      ticketKey,
      totalRequests: collection.item.length,
      collection
    });

  } catch (err: any) {
    console.error('Generate collection error:', err.message);
    res.status(500).json({ error: 'Failed to generate Postman collection' });
  }
};

// ── GET ALL COLLECTIONS FOR A TICKET ──────────────────
export const getCollections = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  try {
    const result = await pool.query(
      `SELECT id, ticket_key, collection_name, created_at
       FROM postman_collections
       WHERE ticket_key = $1
       AND   user_id    = $2
       ORDER BY created_at DESC`,
      [ticketKey, req.userId]
    );

    res.json({
      ticketKey,
      count:       result.rows.length,
      collections: result.rows
    });

  } catch (err) {
    console.error('Get collections error:', err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
};

// ── GET SINGLE COLLECTION BY ID ────────────────────────
export const getCollection = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const result = await pool.query(
      `SELECT * FROM postman_collections
       WHERE id      = $1
       AND   user_id = $2`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    res.json({ collection: result.rows[0] });

  } catch (err) {
    console.error('Get collection error:', err);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
};

// ── DOWNLOAD COLLECTION AS JSON FILE ──────────────────
export const downloadCollection = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const result = await pool.query(
      `SELECT * FROM postman_collections
       WHERE id      = $1
       AND   user_id = $2`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    const collection = result.rows[0];

    res.setHeader('Content-Type',        'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${collection.ticket_key}-collection.json"`);
    res.send(JSON.stringify(collection.collection_json, null, 2));

  } catch (err) {
    console.error('Download collection error:', err);
    res.status(500).json({ error: 'Failed to download collection' });
  }
};