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
       AND   user_id = $2
       AND   status  IN ('approved', 'modified')`,
            [ticketKey, req.userId]
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
                
                if (testCase.status === 'modified' && testCase.jira_subtask_key) {
                    
                    if (!await ticketExistsInJIRA(testCase.jira_subtask_key)) {
                        
                         const jiraKey = await createTicketInJIRA(ticketKey, testCase);
                        // Store Jira key in DB
                        
                        await pool.query(
                        `UPDATE test_cases SET jira_subtask_key = $1 WHERE id = $2`,
                        [jiraKey, testCase.id]
                    );
                    } else {
                       // ── UPDATE existing Jira ticket ──────────────
                        await updateTestTicket(
                            testCase.jira_subtask_key,
                            testCase.test_case
                        );
                    }

                    // Reset status back to approved
                    await pool.query(
                        `UPDATE test_cases 
                    SET status = 'approved' 
                    WHERE id = $1`,
                        [testCase.id]
                    );

                    

                    updated.push({
                        testCaseId: testCase.id,
                        jiraKey: testCase.jira_subtask_key
                    });

                } else if (testCase.status === 'approved' && !testCase.jira_subtask_key) {
                    // ── CREATE new Jira ticket ───────────────────
                    const jiraKey = createTicketInJIRA(ticketKey, testCase);

                    // Store Jira key in DB
                    await pool.query(
                        `UPDATE test_cases SET jira_subtask_key = $1 WHERE id = $2`,
                        [jiraKey, testCase.id]
                    );

                    pushed.push({ testCaseId: testCase.id, jiraKey });
                }

            } catch (err: any) {
                failed.push({
                    testCaseId: testCase.id,
                    error: err.response?.data?.errors ||
                        err.response?.data?.errorMessages ||
                        err.message
                });
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