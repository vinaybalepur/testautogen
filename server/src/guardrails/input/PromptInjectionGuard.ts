import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import blockedWords from '../config/blockedWords.json';

export class PromptInjectionGuard implements IInputGuardrail {
  readonly name = 'PromptInjectionGuard';

  // Patterns from config + additional regex-based detection
  private readonly patterns: RegExp[] = [
    // From config word list
    ...blockedWords.promptInjection.map(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),

    // Structural injection patterns
    /\bsystem\s*:\s*/i,
    /\bhuman\s*:\s*/i,
    /\bassistant\s*:\s*/i,
    /<<<\s*system/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /\bINSTRUCTION\s*OVERRIDE\b/i,
    /\bENDOFTEXT\b/i,
    /\bSTOP\s+SEQUENCE\b/i,
    /prompt\s*leak/i,
    /extract\s+(system|hidden|internal)\s+(prompt|instruction)/i,
    /what\s+(are|were)\s+your\s+(original|initial|system)\s+instructions/i,
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
        reason:    'Prompt Injection Detected',
        details:   triggered,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
