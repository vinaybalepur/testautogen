import { Request, Response } from 'express';
import pool from '../config/db';
import newman from 'newman';
import path from 'path';

// ── CLEANUP OLD TEST RUNS (older than 60 days) ─────────
const cleanupOldRuns = async (): Promise<void> => {
    try {
        const retentionDays = parseInt(process.env.REPORT_RETENTION_DAYS || '60');
        await pool.query(
            `DELETE FROM test_runs
       WHERE run_at < NOW() - INTERVAL '${retentionDays} days'`
        );
        console.log(`✅ Cleaned up runs older than ${retentionDays} days`);
    } catch (err) {
        console.error('Cleanup error:', err);
    }
};

// ── RUN NEWMAN ─────────────────────────────────────────
export const runCollection = async (req: Request, res: Response): Promise<void> => {
    const { collectionId } = req.params;
    const TIMEOUT_MS = parseInt(process.env.NEWMAN_TIMEOUT_MS || '180000'); // 3 mins

    try {
        // Cleanup old runs
        await cleanupOldRuns();

        // Get collection from DB
        const collectionResult = await pool.query(
            `SELECT * FROM postman_collections
       WHERE id      = $1
       AND   user_id = $2`,
            [collectionId, req.userId]
        );

        if (collectionResult.rows.length === 0) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        const collection = collectionResult.rows[0];

        // Create test run record
        const runResult = await pool.query(
            `INSERT INTO test_runs
        (collection_id, ticket_key, user_id, status)
       VALUES ($1, $2, $3, 'running')
       RETURNING id`,
            [collectionId, collection.ticket_key, req.userId]
        );

        const runId = runResult.rows[0].id;

        // Track if run completed normally
        let isCompleted = false;

        // ── Timeout handler ────────────────────────────────
        const timeoutHandle = setTimeout(async () => {
            if (!isCompleted) {
                console.warn(`⚠️ Run ${runId} timed out after ${TIMEOUT_MS / 1000}s`);

                // Update status to timeout
                await pool.query(
                    `UPDATE test_runs
           SET status = 'timeout'
           WHERE id = $1`,
                    [runId]
                );
            }
        }, TIMEOUT_MS);

        // ── Run Newman ─────────────────────────────────────
        newman.run(
            {
                collection: collection.collection_json,
                reporters: ['json'],
                timeoutRequest: TIMEOUT_MS   // ← per request timeout
            },
            async (err: any, summary: any) => {
                // Mark as completed so timeout doesn't fire
                isCompleted = true;
                clearTimeout(timeoutHandle);

                if (err) {
                    await pool.query(
                        `UPDATE test_runs SET status = 'error' WHERE id = $1`,
                        [runId]
                    );
                    console.error('Newman error:', err);
                    return;
                }
                
                const stats = summary.run.stats;
                const totalTests = stats.assertions.total || 0;   // 34
                const failed = stats.assertions.failed || 0;   // 0
                const passed = totalTests - failed;             // 34 - 0 = 34 ✅
                const skipped = stats.items.pending || 0;   // 0
                const duration = summary.run.timings.completed -
                    summary.run.timings.started || 0;
                const htmlReport = generateHTMLReport(summary, collection.ticket_key);

                await pool.query(
                    `UPDATE test_runs
           SET
             status      = $1,
             total_tests = $2,
             passed      = $3,
             failed      = $4,
             duration_ms = $5,
             report_json = $6,
             report_html = $7
           WHERE id = $8`,
                    [
                        failed > 0 ? 'failed' : 'passed',
                        totalTests,
                        passed,
                        failed,
                        duration,
                        JSON.stringify(summary.run),
                        htmlReport,
                        runId
                    ]
                );

                console.log(`✅ Run ${runId} completed: ${passed} passed, ${failed} failed`);
            }
        );

        // Return immediately
        res.status(202).json({
            message: 'Test run started',
            runId,
            ticketKey: collection.ticket_key,
            timeoutIn: `${TIMEOUT_MS / 1000} seconds`
        });

    } catch (err: any) {
        console.error('Run collection error:', err.message);
        res.status(500).json({ error: 'Failed to run collection' });
    }
};

// ── GET RUN STATUS ─────────────────────────────────────
export const getRunStatus = async (req: Request, res: Response): Promise<void> => {
    const { runId } = req.params;

    try {
        const result = await pool.query(
            `SELECT
         id,
         collection_id,
         ticket_key,
         status,
         total_tests,
         passed,
         failed,
         skipped,
         duration_ms,
         run_at,
         CASE
           WHEN report_html IS NOT NULL THEN true
           ELSE false
         END AS has_report
       FROM test_runs
       WHERE id      = $1
       AND   user_id = $2`,
            [runId, req.userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Test run not found' });
            return;
        }

        const run = result.rows[0];

        // Calculate pass rate
        const passRate = run.total_tests > 0
            ? Math.round((run.passed / run.total_tests) * 100)
            : 0;

        // Tell UI whether to keep polling
        const isComplete = ['passed', 'failed', 'error', 'timeout'].includes(run.status);

        res.json({
            run: {
                ...run,
                passRate,
                isComplete,          // ← UI uses this to stop polling
                durationSeconds: run.duration_ms
                    ? (run.duration_ms / 1000).toFixed(2)
                    : null
            }
        });

    } catch (err) {
        console.error('Get run status error:', err);
        res.status(500).json({ error: 'Failed to fetch run status' });
    }
};

// ── GET ALL RUNS FOR A COLLECTION ──────────────────────
export const getCollectionRuns = async (req: Request, res: Response): Promise<void> => {
    const { collectionId } = req.params;

    try {
        const result = await pool.query(
            `SELECT
         id, ticket_key, status,
         total_tests, passed, failed,
         duration_ms, run_at
       FROM test_runs
       WHERE collection_id = $1
       AND   user_id       = $2
       ORDER BY run_at DESC`,
            [collectionId, req.userId]
        );

        res.json({
            collectionId,
            count: result.rows.length,
            runs: result.rows
        });

    } catch (err) {
        console.error('Get runs error:', err);
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
};

// ── GET HTML REPORT ────────────────────────────────────
export const getReport = async (req: Request, res: Response): Promise<void> => {
    const { runId } = req.params;

    try {
        const result = await pool.query(
            `SELECT report_html, ticket_key, status, run_at
       FROM test_runs
       WHERE id      = $1
       AND   user_id = $2`,
            [runId, req.userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Test run not found' });
            return;
        }

        if (!result.rows[0].report_html) {
            res.status(404).json({ error: 'Report not ready yet' });
            return;
        }

        res.setHeader('Content-Type', 'text/html');
        res.send(result.rows[0].report_html);

    } catch (err) {
        console.error('Get report error:', err);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
};

// ── GET ALL RUNS FOR A TICKET ──────────────────────────
export const getTicketRuns = async (req: Request, res: Response): Promise<void> => {
    const ticketKey = req.params.ticketKey as string;

    try {
        const result = await pool.query(
            `SELECT
         tr.id, tr.ticket_key, tr.status,
         tr.total_tests, tr.passed, tr.failed,
         tr.duration_ms, tr.run_at,
         pc.collection_name
       FROM test_runs tr
       JOIN postman_collections pc ON pc.id = tr.collection_id
       WHERE tr.ticket_key = $1
       AND   tr.user_id    = $2
       ORDER BY tr.run_at DESC`,
            [ticketKey, req.userId]
        );

        res.json({
            ticketKey,
            count: result.rows.length,
            runs: result.rows
        });

    } catch (err) {
        console.error('Get ticket runs error:', err);
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
};

// ── GENERATE HTML REPORT ───────────────────────────────
const generateHTMLReport = (summary: any, ticketKey: string): string => {
    const stats = summary.run.stats;
    const totalTests = stats.assertions.total || 0;
    const passed = stats.assertions.pending || 0;
    const failed = stats.assertions.failed || 0;
    const duration = summary.run.timings.completed -
        summary.run.timings.started || 0;
    const passRate = totalTests > 0
        ? Math.round((passed / totalTests) * 100)
        : 0;

    // Build execution details
    const executionRows = summary.run.executions
        .map((exec: any) => {
            const assertionResults = exec.assertions || [];
            const status = assertionResults.every((a: any) => !a.error)
                ? 'PASSED'
                : 'FAILED';
            const statusColor = status === 'PASSED' ? '#28a745' : '#dc3545';

            return `
        <tr>
          <td>${exec.item.name}</td>
          <td>${exec.response?.code || '-'}</td>
          <td>${exec.response?.responseTime || '-'} ms</td>
          <td style="color: ${statusColor}; font-weight: bold">${status}</td>
          <td>${assertionResults
                    .filter((a: any) => a.error)
                    .map((a: any) => a.error.message)
                    .join(', ') || '-'}</td>
        </tr>
      `;
        })
        .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ticketKey} Test Report</title>
  <style>
    body        { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header     { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary    { display: flex; gap: 20px; margin-bottom: 20px; }
    .card       { background: white; padding: 20px; border-radius: 8px; flex: 1; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2    { margin: 0; font-size: 2em; }
    .passed     { color: #28a745; }
    .failed     { color: #dc3545; }
    .total      { color: #2c3e50; }
    .duration   { color: #6c757d; }
    table       { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th          { background: #2c3e50; color: white; padding: 12px; text-align: left; }
    td          { padding: 12px; border-bottom: 1px solid #dee2e6; }
    tr:hover    { background: #f8f9fa; }
    .progress   { background: #dee2e6; border-radius: 4px; height: 10px; margin-top: 10px; }
    .progress-bar { background: #28a745; border-radius: 4px; height: 10px; width: ${passRate}%; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${ticketKey} — Test Execution Report</h1>
    <p>Generated at: ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="card">
      <p>Total Tests</p>
      <h2 class="total">${totalTests}</h2>
    </div>
    <div class="card">
      <p>Passed</p>
      <h2 class="passed">${passed}</h2>
    </div>
    <div class="card">
      <p>Failed</p>
      <h2 class="failed">${failed}</h2>
    </div>
    <div class="card">
      <p>Duration</p>
      <h2 class="duration">${(duration / 1000).toFixed(2)}s</h2>
    </div>
    <div class="card">
      <p>Pass Rate</p>
      <h2 class="${passRate === 100 ? 'passed' : 'failed'}">${passRate}%</h2>
      <div class="progress">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th>Status Code</th>
        <th>Response Time</th>
        <th>Result</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>
      ${executionRows}
    </tbody>
  </table>
</body>
</html>
  `;
};