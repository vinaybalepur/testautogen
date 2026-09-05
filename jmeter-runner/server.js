const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

const WORK_DIR = '/work';

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * POST /run
 * Body: {
 *   jmx: string,          // full JMeter test plan XML
 *   timeoutMs?: number    // optional hard timeout, defaults to 5 minutes
 * }
 *
 * Runs JMeter in non-GUI mode against the provided JMX, waits for
 * completion, parses the resulting .jtl (CSV) file, and returns
 * aggregate performance metrics.
 */
app.post('/run', async (req, res) => {
  const { jmx, timeoutMs = 5 * 60 * 1000 } = req.body;

  if (!jmx || typeof jmx !== 'string') {
    res.status(400).json({ error: 'jmx (string) is required in the request body' });
    return;
  }

  const runId    = randomUUID();
  const jmxPath  = path.join(WORK_DIR, `${runId}.jmx`);
  const jtlPath  = path.join(WORK_DIR, `${runId}.jtl`);
  const logPath  = path.join(WORK_DIR, `${runId}.log`);

  try {
    fs.writeFileSync(jmxPath, jmx, 'utf-8');

    const args = [
      '-n',                     // non-GUI mode
      '-t', jmxPath,            // test plan
      '-l', jtlPath,            // results file (CSV)
      '-j', logPath,            // jmeter's own log file
    ];

    const startedAt = Date.now();
    const exitCode  = await runJMeter(args, timeoutMs);
    const durationMs = Date.now() - startedAt;

    if (!fs.existsSync(jtlPath)) {
      res.status(500).json({
        error: 'JMeter did not produce a results file',
        exitCode,
        log: safeReadTail(logPath, 4000),
      });
      return;
    }

    const jtlContent = fs.readFileSync(jtlPath, 'utf-8');
    const metrics     = parseJtl(jtlContent);

    res.json({
      runId,
      durationMs,
      exitCode,
      metrics,
    });
  } catch (err) {
    res.status(500).json({ error: 'JMeter run failed', message: err.message });
  } finally {
    // Best-effort cleanup — don't let disk fill up across repeated runs
    [jmxPath, jtlPath, logPath].forEach(p => {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

function runJMeter(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn('jmeter', args, { cwd: WORK_DIR });

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`JMeter run exceeded ${timeoutMs}ms timeout`));
    }, timeoutMs);

    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) {
        console.warn(`jmeter exited with code ${code}: ${stderr.slice(-2000)}`);
      }
      resolve(code);
    });
  });
}

function safeReadTail(filePath, maxChars) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.length > maxChars ? content.slice(-maxChars) : content;
  } catch {
    return null;
  }
}

/**
 * Parses JMeter's default CSV (.jtl) output into aggregate metrics.
 * Default CSV columns: timeStamp,elapsed,label,responseCode,responseMessage,
 * threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,
 * allThreads,URL,Latency,IdleTime,Connect
 */
function parseJtl(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      avgResponseTimeMs: 0,
      minResponseTimeMs: 0,
      maxResponseTimeMs: 0,
      p90ResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      p99ResponseTimeMs: 0,
      throughputPerSec: 0,
      byLabel: [],
    };
  }

  const header = lines[0].split(',');
  const idx = {
    elapsed:  header.indexOf('elapsed'),
    label:    header.indexOf('label'),
    success:  header.indexOf('success'),
    timeStamp: header.indexOf('timeStamp'),
  };

  const rows = lines.slice(1).map(line => {
    // Simple split is sufficient here — JMeter's default CSV writer does
    // not quote label values in typical setups (no embedded commas from
    // our own generated JMX, since labels come from Postman request names).
    const cols = line.split(',');
    return {
      elapsed:   parseInt(cols[idx.elapsed], 10) || 0,
      label:     cols[idx.label] || 'unknown',
      success:   cols[idx.success] === 'true',
      timeStamp: parseInt(cols[idx.timeStamp], 10) || 0,
    };
  });

  const elapsedTimes = rows.map(r => r.elapsed).sort((a, b) => a - b);
  const successCount = rows.filter(r => r.success).length;
  const errorCount    = rows.length - successCount;

  const totalDurationSec = rows.length > 0
    ? (Math.max(...rows.map(r => r.timeStamp)) - Math.min(...rows.map(r => r.timeStamp))) / 1000
    : 0;

  const byLabelMap = {};
  for (const row of rows) {
    if (!byLabelMap[row.label]) {
      byLabelMap[row.label] = { label: row.label, count: 0, errors: 0, totalElapsed: 0 };
    }
    byLabelMap[row.label].count += 1;
    if (!row.success) byLabelMap[row.label].errors += 1;
    byLabelMap[row.label].totalElapsed += row.elapsed;
  }

  const byLabel = Object.values(byLabelMap).map(l => ({
    label:            l.label,
    count:            l.count,
    errors:           l.errors,
    avgResponseTimeMs: Math.round(l.totalElapsed / l.count),
  }));

  return {
    totalRequests:      rows.length,
    successCount,
    errorCount,
    errorRate:          rows.length > 0 ? +(errorCount / rows.length * 100).toFixed(2) : 0,
    avgResponseTimeMs:  rows.length > 0 ? Math.round(elapsedTimes.reduce((a, b) => a + b, 0) / rows.length) : 0,
    minResponseTimeMs:  elapsedTimes[0] || 0,
    maxResponseTimeMs:  elapsedTimes[elapsedTimes.length - 1] || 0,
    p90ResponseTimeMs:  percentile(elapsedTimes, 90),
    p95ResponseTimeMs:  percentile(elapsedTimes, 95),
    p99ResponseTimeMs:  percentile(elapsedTimes, 99),
    throughputPerSec:   totalDurationSec > 0 ? +(rows.length / totalDurationSec).toFixed(2) : 0,
    byLabel,
  };
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`jmeter-runner listening on port ${PORT}`);
});
