import { Request, Response }      from 'express';
import pool                        from '../config/db';
import { fetchJiraTicket }         from '../services/jiraService';
import { generateBDDTestCases }    from '../services/aiService';
import { AIRequest }               from '../types';

export const generateTestCases = async (req: Request, res: Response): Promise<void> => {
  const { ticketKey, provider, model, modelFamily } = req.body;

  // Validate required fields
  if (!ticketKey || !provider || !model) {
    res.status(400).json({ error: 'ticketKey, provider and model are required' });
    return;
  }

  try {
    // Step 1 — Fetch live ticket from Jira
    const ticket = await fetchJiraTicket(ticketKey);

    // Step 2 — Build AI request
    const aiRequest: AIRequest = {
      summary:     ticket.summary,
      description: ticket.description,
      provider,
      model
    };

    // Step 3 — Generate BDD test cases
    const aiResponse = await generateBDDTestCases(aiRequest);

    // Step 4 — Store each test case as individual row in DB
    const savedTestCases = await Promise.all(
      aiResponse.testCases.map((testCase: string) =>
        pool.query(
          `INSERT INTO test_cases 
            (jira_id, user_id, test_case, status)
           VALUES ($1, $2, $3, 'draft')
           RETURNING *`,
          [ticketKey, req.userId, testCase]
        )
      )
    );

    // Step 5 — Log token consumption
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
        aiResponse.tokensConsumed
      ]
    );

    // Step 6 — Return saved test cases
    res.status(201).json({
      message:   'Test cases generated successfully',
      ticketKey,
      provider,
      model,
      count:     savedTestCases.length,
      testCases: savedTestCases.map(r => r.rows[0])
    });

  } catch (err: any) {
    if (err.response?.status === 404) {
      res.status(404).json({ error: `Ticket ${ticketKey} not found in Jira` });
      return;
    }

    if (err.response?.status === 401) {
      res.status(401).json({ error: 'Authentication failed. Check your credentials' });
      return;
    }

    if (err.response?.status === 429) {
      res.status(429).json({ error: 'AI provider rate limit exceeded. Try again later' });
      return;
    }

    console.error('Generate test cases error:', err.message);
    res.status(500).json({ error: 'Failed to generate test cases' });
  }
};