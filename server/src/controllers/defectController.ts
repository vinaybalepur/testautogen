import { Request, Response } from 'express';
import pool                   from '../config/db';
import { createDefect }       from '../services/jiraService';

interface RunDetails {
  status:          string;
  run_at:          Date;
  total_tests:     number;
  passed:          number;
  failed:          number;
  report_json:     any;
  collection_name: string;
}

// ── CREATE DEFECT ──────────────────────────────────────
export const createDefectFromFailure = async (req: Request, res: Response): Promise<void> => {
  const { testCaseId, runId, ticketKey } = req.body;

  // Validate only required fields
  if (!testCaseId || !runId || !ticketKey) {
    res.status(400).json({
      error: 'testCaseId, runId and ticketKey are required'
    });
    return;
  }

  try {
    // Check if defect already exists for this test case and run
    const existing = await pool.query(
      `SELECT id, defect_jira_key FROM defects
       WHERE test_case_id = $1
       AND   run_id       = $2`,
      [testCaseId, runId]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        error:         'Defect already exists for this test case and run',
        defectJiraKey: existing.rows[0].defect_jira_key
      });
      return;
    }

    // Get test case details from DB
    const testCase = await pool.query(
      `SELECT test_case FROM test_cases
       WHERE id      = $1
       AND   user_id = $2`,
      [testCaseId, req.userId]
    );

    if (testCase.rows.length === 0) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    // Get run details from DB
    const run = await pool.query(
      `SELECT
         tr.status,
         tr.run_at,
         tr.total_tests,
         tr.passed,
         tr.failed,
         tr.report_json,
         pc.collection_name
       FROM test_runs tr
       JOIN postman_collections pc ON pc.id = tr.collection_id
       WHERE tr.id      = $1
       AND   tr.user_id = $2`,
      [runId, req.userId]
    );

    if (run.rows.length === 0) {
      res.status(404).json({ error: 'Test run not found' });
      return;
    }

    const testCaseText = testCase.rows[0].test_case;
    const runDetails   = run.rows[0];

    // Extract expected and actual from report_json
    let expected     = 'See test case for expected result';
    let actual       = 'Test assertion failed';
    let responseData = null;

    if (runDetails.report_json) {
      const executions = runDetails.report_json.executions || [];
      const failedExec = executions.find((exec: any) =>
        exec.assertions?.some((a: any) => a.error)
      );

      if (failedExec) {
        const failedAssertion = failedExec.assertions?.find((a: any) => a.error);
        expected     = failedAssertion?.assertion || expected;
        actual       = failedAssertion?.error?.message || actual;
        responseData = {
          statusCode:   failedExec.response?.code,
          responseTime: failedExec.response?.responseTime,
          body:         failedExec.response?.body
        };
      }
    }

    // Build summary from test case text
    const scenarioLine = testCaseText
      .split('\n')
      .find((line: string) => line.startsWith('Scenario:'));
    const summary = scenarioLine
      ? scenarioLine.replace('Scenario:', '').trim()
      : 'Test case failed';

    // Build defect description
    const description = buildDefectDescription(
      testCaseText,
      expected,
      actual,
      responseData,
      runId,
      ticketKey,
      runDetails
    );

    // Create defect in Jira
    const defectJiraKey = await createDefect(
      ticketKey,
      `[${ticketKey}] ${summary}`,
      description
    );

    // Store defect in DB
    const result = await pool.query(
      `INSERT INTO defects
        (test_case_id, run_id, ticket_key, defect_jira_key, summary, expected, actual, response_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        testCaseId,
        runId,
        ticketKey,
        defectJiraKey,
        summary,
        expected,
        actual,
        responseData ? JSON.stringify(responseData) : null
      ]
    );

    res.status(201).json({
      message:       'Defect created successfully',
      defectJiraKey,
      defect:        result.rows[0]
    });

  } catch (err: any) {
    if (err.response?.status === 404) {
      res.status(404).json({ error: `Project not found for ticket ${ticketKey}` });
      return;
    }
    console.error('Create defect error:', err.message);
    res.status(500).json({ error: 'Failed to create defect' });
  }
};

// ── GET ALL DEFECTS FOR A TICKET ───────────────────────
export const getDefectsByTicket = async (req: Request, res: Response): Promise<void> => {
  const ticketKey = req.params.ticketKey as string;

  try {
    const result = await pool.query(
      `SELECT
         d.id,
         d.defect_jira_key,
         d.summary,
         d.expected,
         d.actual,
         d.created_at,
         tc.test_case,
         tr.run_at,
         tr.status AS run_status
       FROM defects d
       JOIN test_cases tc ON tc.id = d.test_case_id
       JOIN test_runs  tr ON tr.id = d.run_id
       WHERE d.ticket_key = $1
       AND   tc.user_id   = $2
       ORDER BY d.created_at DESC`,
      [ticketKey, req.userId]
    );

    res.json({
      ticketKey,
      count:   result.rows.length,
      defects: result.rows
    });

  } catch (err) {
    console.error('Get defects error:', err);
    res.status(500).json({ error: 'Failed to fetch defects' });
  }
};

// ── GET ALL DEFECTS FOR A RUN ──────────────────────────
export const getDefectsByRun = async (req: Request, res: Response): Promise<void> => {
  const { runId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         d.id,
         d.defect_jira_key,
         d.summary,
         d.expected,
         d.actual,
         d.response_data,
         d.created_at,
         tc.test_case
       FROM defects d
       JOIN test_cases tc ON tc.id = d.test_case_id
       WHERE d.run_id    = $1
       AND   tc.user_id  = $2
       ORDER BY d.created_at DESC`,
      [runId, req.userId]
    );

    res.json({
      runId,
      count:   result.rows.length,
      defects: result.rows
    });

  } catch (err) {
    console.error('Get run defects error:', err);
    res.status(500).json({ error: 'Failed to fetch defects' });
  }
};

// ── BUILD DEFECT DESCRIPTION ───────────────────────────
const buildDefectDescription = (
  testCase:     string,
  expected:     string,
  actual:       string,
  responseData: any,
  runId:        number,
  ticketKey:    string,
  runDetails:   RunDetails
): string => {
  return `
TEST CASE
─────────────────────────────────────
${testCase}

EXPECTED RESULT
─────────────────────────────────────
${expected}

ACTUAL RESULT
─────────────────────────────────────
${actual}

RESPONSE DATA
─────────────────────────────────────
${responseData ? JSON.stringify(responseData, null, 2) : 'No response data'}

ENVIRONMENT
─────────────────────────────────────
Run ID:     ${runId}
Ticket:     ${ticketKey}
Run Date:   ${new Date().toISOString()}
  `.trim();
};