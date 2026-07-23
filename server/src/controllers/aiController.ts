import { Request, Response } from 'express';
import pool from '../config/db';
import { fetchJiraTicket } from '../services/jiraService';
import { generateBDDTestCases } from '../services/aiService';
import { AIRequest } from '../types';

export const generateTestCases = async (req: Request, res: Response): Promise<void> => {
  const { ticketKey, provider, model, modelFamily } = req.body;

  if (!ticketKey || !provider || !model) {
    res.status(400).json({ error: 'ticketKey, provider and model are required' });
    return;
  }

  try {
    // Fetch Jira ticket
    const ticket = await fetchJiraTicket(ticketKey);

    // ── Delete existing test cases first ──────────────
    await pool.query(
      `DELETE FROM test_cases
       WHERE jira_id = $1
       AND   user_id = $2`,
      [ticketKey, req.userId]
    );

    // Reset sequence if no test cases remain
    const remaining = await pool.query(`SELECT COUNT(*) FROM test_cases`);
    if (parseInt(remaining.rows[0].count) === 0) {
      await pool.query(`ALTER SEQUENCE test_cases_id_seq RESTART WITH 1`);
    }

    // Generate new test cases via AI
    const result = await generateBDDTestCases({
      ticketKey,
      summary: ticket.summary,
      description: ticket.description,
      provider,
      model,
      modelFamily: modelFamily || model,
      userId: req.userId              // ← add here
    });

    // Store new test cases in DB
    const inserted = [];
    for (const tc of result.testCases) {
      const row = await pool.query(
        `INSERT INTO test_cases (jira_id, user_id, test_case, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING *`,
        [ticketKey, req.userId, tc]
      );
      inserted.push(row.rows[0]);
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
        'generate_bdd',
        result.tokensConsumed
      ]
    );

    res.status(201).json({
      message: `Generated ${inserted.length} test cases`,
      count: inserted.length,
      testCases: inserted
    });

  } catch (err: any) {
    console.error('Generate test cases error:', err.message);
    res.status(500).json({ error: 'Failed to generate test cases' });
  }
};