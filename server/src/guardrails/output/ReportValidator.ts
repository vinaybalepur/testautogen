import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

// Newman's JSON reporter output always has these top-level keys.
// A report missing them is likely corrupted or from an unrelated source.
const REQUIRED_KEYS = ['stats', 'executions'] as const;

export class ReportValidator implements IOutputGuardrail {
  readonly name = 'ReportValidator';

  async check(output: string, context?: PipelineContext): Promise<OutputGuardrailResult> {
    // Only relevant when validating a Newman run report — skip for
    // everything else (test case text, chat responses, etc.).
    if (context?.action !== 'validate_test_report' && context?.metadata?.isReport !== true) {
      return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(output);
    } catch (err) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'Report is not valid JSON',
        details:   [err instanceof Error ? err.message : 'Unknown parse error'],
      };
    }

    const missing = REQUIRED_KEYS.filter(key => !(key in parsed));
    if (missing.length > 0) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'Report is missing required Newman fields',
        details:   missing,
      };
    }

    const stats = parsed.stats as Record<string, unknown> | undefined;
    if (!stats || typeof stats !== 'object') {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'Report "stats" field is malformed',
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
