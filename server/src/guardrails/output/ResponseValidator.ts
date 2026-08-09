import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

const MIN_LENGTH = 10;

// Signs the response was cut off mid-generation (e.g. hit a token limit
// or the provider errored partway through streaming).
const TRUNCATION_SIGNALS: RegExp[] = [
  /[a-z,]\s*$/,           // ends mid-sentence on a lowercase word or comma
  /\{\s*$/,               // ends on an unclosed opening brace
  /\[\s*$/,               // ends on an unclosed opening bracket
];

// Provider/internal error text that sometimes leaks into the response
// body instead of being caught as an HTTP error.
const LEAKED_ERROR_SIGNALS: RegExp[] = [
  /\btraceback\s*\(most recent call last\)/i,
  /\binternal\s+server\s+error\b/i,
  /\bat\s+\w+\.\w+\s*\(.*:\d+:\d+\)/,   // stack trace frame
  /\bundefined\s+is\s+not\s+a\s+function\b/i,
];

export class ResponseValidator implements IOutputGuardrail {
  readonly name = 'ResponseValidator';

  async check(output: string, _context?: PipelineContext): Promise<OutputGuardrailResult> {
    const trimmed = output.trim();

    if (trimmed.length < MIN_LENGTH) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    `Response too short (${trimmed.length} chars) — likely an empty or failed generation`,
      };
    }

    for (const p of LEAKED_ERROR_SIGNALS) {
      if (p.test(trimmed)) {
        return {
          passed:    false,
          action:    'block',
          guardrail: this.name,
          reason:    'Response appears to contain a leaked internal error rather than a real answer',
          details:   [p.source],
        };
      }
    }

    for (const p of TRUNCATION_SIGNALS) {
      if (p.test(trimmed)) {
        return {
          passed:          true,
          action:          'warn',
          guardrail:       this.name,
          reason:          'Response may be truncated — consider increasing the model\'s max token limit',
          sanitisedOutput: output,
        };
      }
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
