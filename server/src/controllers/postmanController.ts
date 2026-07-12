import { Request, Response }           from 'express';
import pool                             from '../config/db';
import { generatePostmanCollection }    from '../services/postmanService';

export const generateCollection = async (req: Request, res: Response): Promise<void> => {
  const {
    ticketKey,
    provider,
    model,
    modelFamily,
    baseUrl,
    username,
    password
  } = req.body;

  // Validate required fields
  if (!ticketKey || !provider || !model || !baseUrl || !username || !password) {
    res.status(400).json({
      error: 'ticketKey, provider, model, baseUrl, username and password are required'
    });
    return;
  }

  try {
    // Get approved test cases for this ticket
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

    // Return collection as downloadable JSON file
    res.setHeader('Content-Type',        'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${ticketKey}-collection.json"`);
    res.send(JSON.stringify(collection, null, 2));

  } catch (err: any) {
    console.error('Generate collection error:', err.message);
    res.status(500).json({ error: 'Failed to generate Postman collection' });
  }
};