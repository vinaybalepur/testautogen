import { Request, Response } from 'express';
import pool from '../config/db';
import { convertPostmanToJmx, LoadTestParams } from '../utils/postmanToJmx';

const JMETER_RUNNER_URL = process.env.JMETER_RUNNER_URL || 'http://jmeter-runner:4000';

interface JMeterMetrics {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  p90ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  throughputPerSec: number;
  byLabel: { label: string; count: number; errors: number; avgResponseTimeMs: number }[];
}

// ── RUN A PERFORMANCE TEST ────────────────────────────
export const runPerformanceTest = async (req: Request, res: Response): Promise<void> => {
  const { collectionId } = req.params;
  const { threads, rampUpSeconds, loops, durationSeconds } = req.body;

  if (!threads || !rampUpSeconds) {
    res.status(400).json({ error: 'threads and rampUpSeconds are required' });
    return;
  }
  if (!loops && !durationSeconds) {
    res.status(400).json({ error: 'Either loops or durationSeconds is required' });
    return;
  }

  try {
    // Fetch the Postman collection
    const collectionResult = await pool.query(
      `SELECT id, ticket_key, collection_json FROM postman_collections WHERE id = $1`,
      [collectionId]
    );

    if (collectionResult.rows.length === 0) {
      res.status(404).json({ error: 'Postman collection not found' });
      return;
    }

    const { ticket_key: ticketKey, collection_json: collectionJson } = collectionResult.rows[0];

    // Insert a "running" row up front so the UI can poll it
    const runInsert = await pool.query(
      `INSERT INTO performance_runs
        (collection_id, ticket_key, user_id, threads, ramp_up_seconds, duration_seconds, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'running')
       RETURNING id`,
      [collectionId, ticketKey, req.userId, threads, rampUpSeconds, durationSeconds || null]
    );
    const runId = runInsert.rows[0].id;

    // Respond immediately — the actual JMeter run can take a while
    res.status(202).json({ message: 'Performance test started', runId });

    // Run JMeter asynchronously; update the row when done
    const params: LoadTestParams = { threads, rampUpSeconds, loops, durationSeconds };
    const jmx = convertPostmanToJmx(collectionJson, params);

    const timeoutMs = Math.max(60_000, ((durationSeconds || loops * 5) + rampUpSeconds + 30) * 1000);

    try {
      const response = await fetch(`${JMETER_RUNNER_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jmx, timeoutMs }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        await pool.query(
          `UPDATE performance_runs
           SET status = 'failed', error_message = $1
           WHERE id = $2`,
          [errBody.message || errBody.error || `jmeter-runner returned ${response.status}`, runId]
        );
        return;
      }

      const result: { metrics: JMeterMetrics } = await response.json();
      const m = result.metrics;

      await pool.query(
        `UPDATE performance_runs
         SET status              = 'completed',
             total_requests      = $1,
             success_count       = $2,
             error_count         = $3,
             error_rate          = $4,
             avg_response_ms     = $5,
             min_response_ms     = $6,
             max_response_ms     = $7,
             p90_response_ms     = $8,
             p95_response_ms     = $9,
             p99_response_ms     = $10,
             throughput_per_sec  = $11,
             by_label            = $12
         WHERE id = $13`,
        [
          m.totalRequests, m.successCount, m.errorCount, m.errorRate,
          m.avgResponseTimeMs, m.minResponseTimeMs, m.maxResponseTimeMs,
          m.p90ResponseTimeMs, m.p95ResponseTimeMs, m.p99ResponseTimeMs,
          m.throughputPerSec, JSON.stringify(m.byLabel), runId,
        ]
      );
    } catch (err: any) {
      console.error('Performance test execution error:', err.message);
      console.error('Full error:', err);
      console.error('Error cause:', err.cause);
      await pool.query(
        `UPDATE performance_runs SET status = 'failed', error_message = $1 WHERE id = $2`,
        [err.message || 'Unknown error running JMeter', runId]
      );
    }
  } catch (err: any) {
    console.error('Run performance test error:', err.message);
    res.status(500).json({ error: 'Failed to start performance test' });
  }
};

// ── GET PERFORMANCE RUN STATUS ────────────────────────
export const getPerformanceRunStatus = async (req: Request, res: Response): Promise<void> => {
  const { runId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM performance_runs WHERE id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Performance run not found' });
      return;
    }

    res.json({ run: result.rows[0] });
  } catch (err) {
    console.error('Get performance run status error:', err);
    res.status(500).json({ error: 'Failed to fetch performance run status' });
  }
};

// ── GET ALL PERFORMANCE RUNS FOR A TICKET ─────────────
export const getPerformanceRunsByTicket = async (req: Request, res: Response): Promise<void> => {
  const { ticketKey } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM performance_runs
       WHERE ticket_key = $1
       ORDER BY run_at DESC`,
      [ticketKey]
    );

    res.json({ ticketKey, count: result.rows.length, runs: result.rows });
  } catch (err) {
    console.error('Get performance runs error:', err);
    res.status(500).json({ error: 'Failed to fetch performance runs' });
  }
};
