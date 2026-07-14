import { Request, Response } from 'express';
import pool                   from '../config/db';
import { Parser }             from 'json2csv';
import { parse } from 'csv-parse/sync';



// CSV row interface
interface CSVRow {
  id:               string;
  jira_id:          string;
  test_case:        string;
  defect_jira_id:   string;
}

// ── GET ALL TEST CASES FOR A TICKET ───────────────────
export const getTestCases = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  try {
    const result = await pool.query(
      `SELECT 
        id,
        jira_id,
        test_case,
        status,
        defect_jira_id,
        reviewed_by,
        created_at,
        updated_at
       FROM test_cases
       WHERE jira_id = $1 AND user_id = $2
       ORDER BY created_at ASC`,
      [ticketKey, req.userId]
    );

    res.json({
      ticketKey,
      count:     result.rows.length,
      testCases: result.rows
    });

  } catch (err) {
    console.error('Get test cases error:', err);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
};

// ── APPROVE ALL TEST CASES FOR A TICKET ───────────────
export const approveAllTestCases = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  try {
    const result = await pool.query(
      `UPDATE test_cases
       SET
         status      = 'approved',
         reviewed_by = $1,
         reviewed_at = NOW()
       WHERE jira_id = $2
       AND   user_id = $3
       AND   status  = 'draft'
       RETURNING id`,
      [req.userId, ticketKey, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No draft test cases found for this ticket' });
      return;
    }

    res.json({
      message:  `Approved ${result.rows.length} test cases`,
      approved: result.rows.length
    });

  } catch (err) {
    console.error('Approve all error:', err);
    res.status(500).json({ error: 'Failed to approve all test cases' });
  }
};

// ── APPROVE TEST CASE ──────────────────────────────────
export const approveTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const result = await pool.query(
      `UPDATE test_cases
       SET 
         status      = 'approved',
         reviewed_by = $1,
         reviewed_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [req.userId, id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json({
      message:  'Test case approved',
      testCase: result.rows[0]
    });

  } catch (err) {
    console.error('Approve test case error:', err);
    res.status(500).json({ error: 'Failed to approve test case' });
  }
};

// ── REJECT TEST CASE ───────────────────────────────────
export const rejectTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const result = await pool.query(
      `UPDATE test_cases
       SET
         status      = 'rejected',
         reviewed_by = $1,
         reviewed_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [req.userId, id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json({
      message:  'Test case rejected',
      testCase: result.rows[0]
    });

  } catch (err) {
    console.error('Reject test case error:', err);
    res.status(500).json({ error: 'Failed to reject test case' });
  }
};

// ── UPDATE TEST CASE ───────────────────────────────────
export const updateTestCase = async (req: Request, res: Response): Promise<void> => {
  const id                            = req.params.id as string;
  const { test_case, defect_jira_id } = req.body;

  if (!test_case && !defect_jira_id) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE test_cases
       SET
         test_case      = COALESCE($1, test_case),
         defect_jira_id = COALESCE($2, defect_jira_id),
         -- If already pushed to Jira, mark as modified
         status         = CASE
                            WHEN jira_subtask_key IS NOT NULL AND $1 IS NOT NULL
                            THEN 'modified'
                            ELSE status
                          END
       WHERE id      = $3
       AND   user_id = $4
       RETURNING *`,
      [test_case || null, defect_jira_id || null, id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json({
      message:  'Test case updated',
      testCase: result.rows[0]
    });

  } catch (err) {
    console.error('Update test case error:', err);
    res.status(500).json({ error: 'Failed to update test case' });
  }
};

// ── DOWNLOAD TEST CASES AS CSV ─────────────────────────
export const downloadTestCases = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  try {
    const result = await pool.query(
      `SELECT
        id,
        jira_id,
        test_case,
        defect_jira_id
       FROM test_cases
       WHERE jira_id = $1 AND user_id = $2
       ORDER BY id ASC`,
      [ticketKey, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No test cases found for this ticket' });
      return;
    }

    // Convert to CSV — content columns only
    const parser = new Parser({
      fields: ['id', 'jira_id', 'test_case', 'defect_jira_id']
    });
    const csv = parser.parse(result.rows);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${ticketKey}-testcases.csv"`);
    res.send(csv);

  } catch (err) {
    console.error('Download test cases error:', err);
    res.status(500).json({ error: 'Failed to download test cases' });
  }
};

// ── DELETE TEST CASE ───────────────────────────────────
export const deleteTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const result = await pool.query(
      `DELETE FROM test_cases
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json({ message: 'Test case deleted' });

  } catch (err) {
    console.error('Delete test case error:', err);
    res.status(500).json({ error: 'Failed to delete test case' });
  }
};

// Upload test cases to jira
export const uploadTestCases = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  if (!req.body.csv) {
    res.status(400).json({ error: 'No CSV data provided' });
    return;
  }

  try {
    // Parse CSV with type
    const records = parse(req.body.csv, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true
    }) as CSVRow[];                    

    const updated: any[] = [];
    const failed:  any[] = [];

    for (const row of records) {      
      try {
        if (!row.id) {
          failed.push({ row, error: 'Missing id' });
          continue;
        }

        await pool.query(
          `UPDATE test_cases
           SET
             defect_jira_id   = COALESCE(NULLIF($1, ''), defect_jira_id),
             
           WHERE id      = $3
           AND   jira_id = $4
           AND   user_id = $5`,
          [
            row.defect_jira_id   || null,
            row.id,
            ticketKey,
            req.userId
          ]
        );

        updated.push({ id: row.id });

      } catch (err: any) {
        failed.push({ row, error: err.message });
      }
    }

    res.json({
      message: `Updated ${updated.length} test cases`,
      updated,
      failed
    });

  } catch (err) {
    console.error('Upload CSV error:', err);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
};