import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';

export class LanguageValidator implements IInputGuardrail {
  readonly name = 'LanguageValidator';

  // Script-range based detection — no external library needed
  private readonly scriptRanges: Array<{ name: string; range: RegExp }> = [
    { name: 'Arabic',     range: /[\u0600-\u06FF]/ },
    { name: 'Chinese',    range: /[\u4E00-\u9FFF]/ },
    { name: 'Japanese',   range: /[\u3040-\u30FF]/ },
    { name: 'Korean',     range: /[\uAC00-\uD7AF]/ },
    { name: 'Devanagari', range: /[\u0900-\u097F]/ },
    { name: 'Cyrillic',   range: /[\u0400-\u04FF]/ },
    { name: 'Hebrew',     range: /[\u0590-\u05FF]/ },
    { name: 'Thai',       range: /[\u0E00-\u0E7F]/ },
    { name: 'Bengali',    range: /[\u0980-\u09FF]/ },
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    // Minimum meaningful text to analyse
    if (input.trim().length < 20) {
      return { passed: true, action: 'allow', guardrail: this.name };
    }

    const detected: string[] = [];
    for (const s of this.scriptRanges) {
      if (s.range.test(input)) detected.push(s.name);
    }

    // Count non-ASCII ratio — high ratio with detected scripts = non-English
    const nonAscii    = (input.match(/[^\x00-\x7F]/g) || []).length;
    const nonAsciiRatio = nonAscii / input.length;

    // Warn (not block) if likely non-English — platform may still process it
    if (detected.length > 0 && nonAsciiRatio > 0.3) {
      return {
        passed:    true,    // warn only, don't block
        action:    'warn',
        guardrail: this.name,
        reason:    `Non-English content detected (${detected.join(', ')}). Platform is optimised for English.`,
        metadata:  { detectedScripts: detected, nonAsciiRatio: nonAsciiRatio.toFixed(2) },
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
