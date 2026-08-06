import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import config from '../config/guardrails.json';

export class TokenLimitGuard implements IInputGuardrail {
  readonly name = 'TokenLimitGuard';

  private readonly maxChars:  number;
  private readonly maxTokens: number;

  constructor() {
    this.maxChars  = config.input.tokenLimit.maxCharacters;
    this.maxTokens = config.input.tokenLimit.maxTokens;
  }

  // Rough token estimate: ~4 chars per token (GPT-style)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const charCount    = input.length;
    const tokenEstimate = this.estimateTokens(input);

    if (charCount > this.maxChars) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    `Input exceeds character limit: ${charCount.toLocaleString()} chars (max ${this.maxChars.toLocaleString()})`,
        metadata:  { charCount, maxChars: this.maxChars },
      };
    }

    if (tokenEstimate > this.maxTokens) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    `Input exceeds token limit: ~${tokenEstimate.toLocaleString()} tokens (max ${this.maxTokens.toLocaleString()})`,
        metadata:  { tokenEstimate, maxTokens: this.maxTokens },
      };
    }

    return {
      passed:    true,
      action:    'allow',
      guardrail: this.name,
      metadata:  { charCount, tokenEstimate },
    };
  }
}
