import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

// A valid BDD test case block must contain a Scenario line and at least
// one Given/When/Then step. Missing these means the AI likely returned
// prose instead of the structured format the rest of the app depends on.
const SCENARIO_PATTERN = /Scenario\s*:/i;
const STEP_PATTERN     = /\b(Given|When|Then|And|But)\b/i;

// Signals the AI refused, hedged, or returned an incomplete response
// instead of actual test cases.
const REFUSAL_SIGNALS: RegExp[] = [
  /^i\s*('m|am)\s+(sorry|unable)/i,
  /\bi\s+cannot\s+(generate|create|provide)\b/i,
  /\bplease\s+provide\s+more\s+(information|details|context)\b/i,
  /^(as\s+an\s+ai|i'm\s+an\s+ai)/i,
];

export class TestCaseValidator implements IOutputGuardrail {
  readonly name = 'TestCaseValidator';

  async check(output: string, _context?: PipelineContext): Promise<OutputGuardrailResult> {
    const trimmed = output.trim();

    if (trimmed.length === 0) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'Empty test case output',
      };
    }

    for (const p of REFUSAL_SIGNALS) {
      if (p.test(trimmed)) {
        return {
          passed:    false,
          action:    'block',
          guardrail: this.name,
          reason:    'AI declined or gave an incomplete response instead of test cases',
          details:   [p.source],
        };
      }
    }

    const hasScenario = SCENARIO_PATTERN.test(trimmed);
    const hasStep      = STEP_PATTERN.test(trimmed);

    if (!hasScenario || !hasStep) {
      return {
        passed:    true,
        action:    'warn',
        guardrail: this.name,
        reason:    !hasScenario
          ? 'No "Scenario:" line detected — output may not follow BDD format'
          : 'No Given/When/Then steps detected — output may not follow BDD format',
        sanitisedOutput: output,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
