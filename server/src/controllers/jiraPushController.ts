import { Request, Response } from 'express';
import pool from '../config/db';
import { createTestTicket, updateTestTicket, ticketExistsInJIRA } from '../services/jiraService';

// Read the variable using process.env
const testProjectKey = process.env.JIRA_TEST_PROJECT_KEY as string;

export const pushTestCasesToJira = async (req: Request, res: Response): Promise<void> => {
    const ticketKey = req.params.ticketKey as string;



    if (!testProjectKey) {
        throw new Error("Missing JIRA_PROJECT_KEY environment variable");
    }

    try {
        // Get approved (not yet pushed) AND modified (already pushed but changed)
        const result = await pool.query(
       `SELECT * FROM test_cases
       WHERE jira_id = $1
       AND   status  IN ('approved', 'approved_modified')`,
            [ticketKey]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'No approved or modified test cases found' });
            return;
        }

        const pushed: any[] = [];
        const updated: any[] = [];
        const failed: any[] = [];

        for (const testCase of result.rows) {
  try {
    if (testCase.jira_subtask_key) {
      // Already pushed — check if needs update
      if (!await ticketExistsInJIRA(testCase.jira_subtask_key)) {
        // Recreate deleted ticket
        const jiraKey = await createTicketInJIRA(ticketKey, testCase);
        await pool.query(
          `UPDATE test_cases
           SET jira_subtask_key = $1, status = 'approved'
           WHERE id = $2`,
          [jiraKey, testCase.id]
        );
        updated.push({ testCaseId: testCase.id, jiraKey });
      } else if (testCase.status === 'approved_modified') {
        // Modified — update Jira
        await updateTestTicket(testCase.jira_subtask_key, testCase.test_case);
        await pool.query(
          `UPDATE test_cases SET status = 'approved' WHERE id = $1`,
          [testCase.id]
        );
        updated.push({ testCaseId: testCase.id, jiraKey: testCase.jira_subtask_key });
      } else {
        // Approved but unchanged — skip
        console.log(`Test case ${testCase.id} unchanged — skipping`);
      }
    } else {
      // Never pushed — create new
      const jiraKey = await createTicketInJIRA(ticketKey, testCase);
      await pool.query(
        `UPDATE test_cases
         SET jira_subtask_key = $1, status = 'approved'
         WHERE id = $2`,
        [jiraKey, testCase.id]
      );
      pushed.push({ testCaseId: testCase.id, jiraKey });
    }
  } catch (err: any) {
    console.error(`Failed test case ${testCase.id}:`, err.message);
    failed.push({ testCaseId: testCase.id, error: err.message });
  }
}

        res.json({
            message: `Pushed ${pushed.length} new, updated ${updated.length} modified test cases`,
            pushed,
            updated,
            failed
        });

    } catch (err: any) {
        console.error('Push to Jira error:', err.message);
        res.status(500).json({ error: 'Failed to push test cases to Jira' });
    }
};

const createTicketInJIRA = async (ticketKey: String, testCase: any) => {
    const jiraKey = await createTestTicket(
        `Test: ${ticketKey} - ${testCase.id}`,
        testCase.test_case,
        testProjectKey
    );
    return jiraKey;
}