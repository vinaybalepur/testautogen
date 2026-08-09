import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

// AI responses sometimes wrap JSON in markdown code fences even when
// asked for raw JSON — strip those before attempting to parse.
const CODE_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export class JsonValidator implements IOutputGuardrail {
  readonly name = 'JsonValidator';

  private extractJson(output: string): string {
    const fenced = output.trim().match(CODE_FENCE_PATTERN);
    return fenced ? fenced[1] : output.trim();
  }

  async check(output: string, context?: PipelineContext): Promise<OutputGuardrailResult> {
    // Only meaningful when the caller expects JSON output — e.g. Postman
    // collection generation or discovery results. Skip silently otherwise.
    if (context?.action !== 'generate_postman_collection' && context?.metadata?.expectsJson !== true) {
      return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
    }

    const candidate = this.extractJson(output);

    try {
      JSON.parse(candidate);
      return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: candidate };
    } catch (err) {
      return {
        passed:    false,
        action:    'block',
        guardrail: this.name,
        reason:    'AI output is not valid JSON',
        details:   [err instanceof Error ? err.message : 'Unknown parse error'],
      };
    }
  }
}
