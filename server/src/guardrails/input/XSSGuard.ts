import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';

export class XSSGuard implements IInputGuardrail {
  readonly name = 'XSSGuard';

  private readonly patterns: RegExp[] = [
    /<script[\s\S]*?>/i,
    /<\/script>/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /on\w+\s*=\s*["']?[^"'>]*/i,    // onload=, onerror=, onclick= etc.
    /<\s*iframe[\s\S]*?>/i,
    /<\s*object[\s\S]*?>/i,
    /<\s*embed[\s\S]*?>/i,
    /<\s*link[\s\S]*?>/i,
    /<\s*meta[\s\S]*?>/i,
    /document\s*\.\s*cookie/i,
    /document\s*\.\s*write/i,
    /window\s*\.\s*location/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /data\s*:\s*text\/html/i,
    /&#\d+;/,                         // HTML entity encoding
    /&#x[0-9a-fA-F]+;/,              // Hex entity encoding
    /%3C\s*script/i,                  // URL-encoded <script
    /\\u003c\s*script/i,              // Unicode-encoded <script
    /<\s*svg[\s\S]*?on\w+\s*=/i,
    /<\s*img[^>]+onerror\s*=/i,
    /<\s*body[^>]+onload\s*=/i,
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const triggered: string[] = [];

    for (const p of this.patterns) {
      if (p.test(input)) triggered.push(p.source);
    }

    if (triggered.length > 0) {
      return { passed: false, action: 'block', guardrail: this.name, reason: 'XSS Attempt Detected', details: triggered };
    }
    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
