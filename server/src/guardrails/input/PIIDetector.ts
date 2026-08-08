import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import piiConfig from '../config/piiPatterns.json';

interface PIIPattern { name: string; regex: string; mask: string; }

export class PIIDetector implements IInputGuardrail {
  readonly name = 'PIIDetector';

  private readonly patterns: Array<{ name: string; regex: RegExp; mask: string }>;

  constructor() {
    this.patterns = (piiConfig.patterns as PIIPattern[]).map(p => ({
      name:  p.name,
      regex: new RegExp(p.regex, 'gi'),
      mask:  p.mask,
    }));
  }

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const found: string[] = [];
    let sanitised = input;

    for (const p of this.patterns) {
      p.regex.lastIndex = 0;
      if (p.regex.test(input)) {
        found.push(p.name);
        p.regex.lastIndex = 0;
        sanitised = sanitised.replace(p.regex, p.mask);
      }
    }

    if (found.length > 0) {
      return {
        passed:          false,
        action:          'mask',
        guardrail:       this.name,
        reason:          `PII Detected: ${found.join(', ')}`,
        details:         found,
        sanitisedInput:  sanitised,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedInput: input };
  }

  // Utility — mask without failing the pipeline (used by PiiMasker on output)
  mask(text: string): string {
    let result = text;
    for (const p of this.patterns) {
      p.regex.lastIndex = 0;
      result = result.replace(p.regex, p.mask);
    }
    return result;
  }
}
