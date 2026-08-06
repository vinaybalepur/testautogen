import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import blockedWords from '../config/blockedWords.json';

export class JailbreakDetector implements IInputGuardrail {
  readonly name = 'JailbreakDetector';

  private readonly patterns: RegExp[] = [
    // Config-driven word list
    ...blockedWords.jailbreak.map(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')),

    // DAN and variants
    /\bD\.?A\.?N\.?\b/i,
    /do\s+anything\s+now/i,

    // Mode bypass patterns
    /developer\s+mode\s*(enabled|on|activated)?/i,
    /god\s+mode/i,
    /jailbreak\s+mode/i,
    /maintenance\s+mode/i,
    /unrestricted\s+mode/i,
    /unlimited\s+mode/i,

    // Social engineering patterns
    /pretend\s+(that\s+)?(you\s+)?(have\s+no|don'?t\s+have)\s+(any\s+)?(rules|restrictions|guidelines|ethics|limits)/i,
    /you\s+are\s+now\s+(free|unrestricted|unlimited)/i,
    /your\s+(true|real|hidden)\s+(self|nature|purpose)/i,
    /ignore\s+(all\s+)?(your\s+)?(safety|ethical|content)\s+(guidelines|rules|policies|restrictions)/i,
    /you\s+(must|should|will)\s+(now\s+)?obey\s+(only\s+)?me/i,
    /from\s+now\s+on\s+(you\s+)?(are|will\s+be)\s+(an?\s+)?ai\s+without/i,

    // Role-play bypass
    /roleplay\s+as\s+(an?\s+)?(evil|malicious|unrestricted|unethical)/i,
    /act\s+as\s+(an?\s+)?(ai\s+without\s+restrictions|evil\s+ai|harmful)/i,
    /simulate\s+being\s+(an?\s+)?(evil|unethical|unrestricted)/i,
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const triggered: string[] = [];

    for (const pattern of this.patterns) {
      if (pattern.test(input)) {
        triggered.push(pattern.source);
      }
    }

    if (triggered.length > 0) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'Jailbreak Attempt Detected',
        details:   triggered,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
