import { Request, Response } from 'express';
import pool from '../config/db';
import { Parser } from 'json2csv';
import { parse } from 'csv-parse/sync';



// CSV row interface
interface CSVRow {
  id: string;
  jira_id: string;
  test_case: string;
  defect_jira_id: string;
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
      count: result.rows.length,
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
      message: `Approved ${result.rows.length} test cases`,
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
      message: 'Test case approved',
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
      message: 'Test case rejected',
      testCase: result.rows[0]
    });

  } catch (err) {
    console.error('Reject test case error:', err);
    res.status(500).json({ error: 'Failed to reject test case' });
  }
};

// ── UPDATE TEST CASE ───────────────────────────────────
export const updateTestCase = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
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
         defect_jira_id = COALESCE($2, defect_jira_id)
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
      message: 'Test case updated',
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
  var responseMessage = "";
  if (!req.body.csv) {
    res.status(400).json({ error: 'No CSV data provided' });
    return;
  }

  try {
    const records = parse(req.body.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    }) as CSVRow[];

    const ALLOWED_COLUMNS = ['id', 'jira_id', 'test_case', 'defect_jira_id'];
    const REQUIRED_COLUMNS = ['id', 'jira_id'];

    if (records.length === 0) {
      res.status(400).json({ error: 'CSV file is empty' });
      return;
    }

    const actualColumns = Object.keys(records[0]);
    const unknownColumns = actualColumns.filter(col => !ALLOWED_COLUMNS.includes(col));
    const missingColumns = REQUIRED_COLUMNS.filter(col => !actualColumns.includes(col));

    if (unknownColumns.length > 0) {
       console.log("Unkown columns");
      res.status(400).json({
        error: `Invalid columns: ${unknownColumns.join(', ')}`,
        message: `Allowed columns: ${ALLOWED_COLUMNS.join(', ')}`
      });
      return;
    }

    if (missingColumns.length > 0) {
      console.log("Missing columns");
      res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        message: `Required columns: ${REQUIRED_COLUMNS.join(', ')}`
      });
      return;
    }


    const updated: any[] = [];
    const failed: any[] = [];

for (const row of records) {
  try {
    if (!row.jira_id) {
      failed.push({ row, error: 'Missing jira_id' });
      continue;
    }

    // ── INSERT if no id or id is empty ────────────
    if (!row.id || row.id.trim() === '') {
      const inserted = await pool.query(
        `INSERT INTO test_cases
          (jira_id, user_id, test_case, defect_jira_id, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING id`,
        [
          ticketKey,
          req.userId,
          row.test_case?.trim()      || '',
          row.defect_jira_id?.trim() || null
        ]
      );
      updated.push({ action: 'inserted', id: inserted.rows[0].id });
      continue;
    }

    // ── Check if ID exists in DB ───────────────────
    const existing = await pool.query(
      `SELECT id, test_case, defect_jira_id
       FROM test_cases
       WHERE id      = $1::integer
       AND   jira_id = $2
       AND   user_id = $3`,
      [parseInt(row.id), ticketKey, req.userId]
    );

    // ── ID not found — insert as new ───────────────
    if (existing.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO test_cases
          (jira_id, user_id, test_case, defect_jira_id, status)
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING id`,
        [
          ticketKey,
          req.userId,
          row.test_case?.trim()      || '',
          row.defect_jira_id?.trim() || null
        ]
      );
      updated.push({ action: 'inserted', id: inserted.rows[0].id });
      continue;
    }

    // ── Compare with current DB values ─────────────
    const currentRow      = existing.rows[0];
    const newTestCase     = row.test_case?.trim()      || '';
    const newDefectJiraId = row.defect_jira_id?.trim() || null;

    const testCaseChanged   = newTestCase     !== '' && newTestCase     !== currentRow.test_case;
    const defectJiraChanged = newDefectJiraId !== null && newDefectJiraId !== currentRow.defect_jira_id;

    // ── Skip if nothing changed ────────────────────
    if (!testCaseChanged && !defectJiraChanged) {
      continue;
    }

    // ── Update only changed fields ─────────────────
    const result = await pool.query(
      `UPDATE test_cases
       SET
         test_case      = CASE WHEN $1 THEN $2::text ELSE test_case END,
         defect_jira_id = CASE WHEN $3 THEN $4::text ELSE defect_jira_id END,
         status         = CASE WHEN $1 THEN 'modified' ELSE status END
       WHERE id      = $5::integer
       AND   jira_id = $6
       AND   user_id = $7`,
      [
        testCaseChanged,
        newTestCase     || null,
        defectJiraChanged,
        newDefectJiraId || null,
        parseInt(row.id),
        ticketKey,
        req.userId
      ]
    );

    if (result.rowCount && result.rowCount > 0) {
      updated.push({ action: 'updated', id: row.id });
    }

  } catch (rowErr: any) {
    console.error('Row error:', rowErr.message);
    failed.push({ row, error: rowErr.message });
  }
}

// ── Response ───────────────────────────────────────
const inserted = updated.filter((r: any) => r.action === 'inserted').length;
const updatedCount = updated.filter((r: any) => r.action === 'updated').length;

res.json({
  message: `Inserted ${inserted} and updated ${updatedCount} test cases`,
  inserted,
  updated:  updatedCount,
  failed:   failed.length,
  errors:   failed
});

    res.json({
      updated: updated.length,
      failed: failed.length,
      errors: failed,
      message: responseMessage
    });

  } catch (err) {
    console.error('Upload CSV error:', err);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
};