import { Request, Response }  from 'express';
import pool                    from '../config/db';
import newman                  from 'newman';
import path                    from 'path';
import fs                      from 'fs';

// ── Reports directory ──────────────────────────────────
const REPORTS_DIR = path.join(__dirname, '../../reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── CLEANUP OLD TEST RUNS ──────────────────────────────
const cleanupOldRuns = async (): Promise<void> => {
  try {
    const retentionDays = parseInt(process.env.REPORT_RETENTION_DAYS || '60');

    // Get report paths before deleting
    const oldRuns = await pool.query(
      `SELECT report_path FROM test_runs
       WHERE run_at < NOW() - INTERVAL '${retentionDays} days'
       AND   report_path IS NOT NULL`
    );

    // Delete report files
    oldRuns.rows.forEach((run: any) => {
      if (run.report_path && fs.existsSync(run.report_path)) {
        fs.unlinkSync(run.report_path);
        console.log(`🗑️ Deleted report: ${run.report_path}`);
      }
    });

    // Delete DB records
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
  const TIMEOUT_MS       = parseInt(process.env.NEWMAN_TIMEOUT_MS || '180000');

  try {
    await cleanupOldRuns();

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

    const runResult = await pool.query(
      `INSERT INTO test_runs
        (collection_id, ticket_key, user_id, status)
       VALUES ($1, $2, $3, 'running')
       RETURNING id`,
      [collectionId, collection.ticket_key, req.userId]
    );

    const runId      = runResult.rows[0].id;
    const reportPath = path.join(REPORTS_DIR, `run-${runId}.html`);

    let isCompleted  = false;

    const timeoutHandle = setTimeout(async () => {
      if (!isCompleted) {
        console.warn(`⚠️ Run ${runId} timed out`);
        await pool.query(
          `UPDATE test_runs SET status = 'timeout' WHERE id = $1`,
          [runId]
        );
      }
    }, TIMEOUT_MS);

    newman.run(
      {
        collection:  collection.collection_json,
        reporters:   ['htmlextra', 'json'],
        reporter: {
          htmlextra: {
            export:        reportPath,
            title:         `${collection.ticket_key} Test Report`,
            darkTheme:     false,
            showOnlyFails: false,
            testPaging:    true
          }
        }
      },
      async (err: any, summary: any) => {
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

        const stats      = summary.run.stats;
        const totalTests = stats.assertions.total  || 0;
        const failed     = stats.assertions.failed || 0;
        const passed     = totalTests - failed;
        const skipped    = stats.items.pending     || 0;
        const duration   = summary.run.timings.completed -
                           summary.run.timings.started   || 0;

        await pool.query(
          `UPDATE test_runs
           SET
             status      = $1,
             total_tests = $2,
             passed      = $3,
             failed      = $4,
             skipped     = $5,
             duration_ms = $6,
             report_json = $7,
             report_path = $8
           WHERE id = $9`,
          [
            failed > 0 ? 'failed' : 'passed',
            totalTests,
            passed,
            failed,
            skipped,
            duration,
            JSON.stringify(summary.run),
            reportPath,
            runId
          ]
        );

        console.log(`✅ Run ${runId}: total=${totalTests} passed=${passed} failed=${failed}`);
      }
    );

    res.status(202).json({
      message:   'Test run started',
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
         id, collection_id, ticket_key, status,
         total_tests, passed, failed, skipped,
         duration_ms, run_at, report_path,
         CASE
           WHEN report_path IS NOT NULL THEN true
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

    const run      = result.rows[0];
    const passRate = run.total_tests > 0
      ? Math.round((run.passed / run.total_tests) * 100)
      : 0;

    const isComplete = ['passed', 'failed', 'error', 'timeout'].includes(run.status);

    res.json({
      run: {
        ...run,
        passRate,
        isComplete,
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

// ── GET HTML REPORT ────────────────────────────────────
export const getReport = async (req: Request, res: Response): Promise<void> => {
  const { runId } = req.params;

  try {
    const result = await pool.query(
      `SELECT report_path, ticket_key, status
       FROM test_runs
       WHERE id      = $1
       AND   user_id = $2`,
      [runId, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Test run not found' });
      return;
    }

    const reportPath = result.rows[0].report_path;

    if (!reportPath || !fs.existsSync(reportPath)) {
      res.status(404).json({ error: 'Report not ready yet or file not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    res.sendFile(reportPath);

  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
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
         duration_ms, run_at,
         CASE WHEN report_path IS NOT NULL THEN true ELSE false END AS has_report
       FROM test_runs
       WHERE collection_id = $1
       AND   user_id       = $2
       ORDER BY run_at DESC`,
      [collectionId, req.userId]
    );

    res.json({
      collectionId,
      count: result.rows.length,
      runs:  result.rows
    });

  } catch (err) {
    console.error('Get runs error:', err);
    res.status(500).json({ error: 'Failed to fetch runs' });
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
         pc.collection_name,
         CASE WHEN tr.report_path IS NOT NULL THEN true ELSE false END AS has_report
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
      runs:  result.rows
    });

  } catch (err) {
    console.error('Get ticket runs error:', err);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
};