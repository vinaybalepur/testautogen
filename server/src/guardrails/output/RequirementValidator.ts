import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

// Extract meaningful words (4+ chars, not common stopwords) from the
// ticket summary/description to check the AI actually engaged with it,
// rather than generating generic filler test cases.
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'should', 'when', 'will',
  'must', 'user', 'users', 'system', 'ticket', 'issue', 'story',
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    )
  );
}

export class RequirementValidator implements IOutputGuardrail {
  readonly name = 'RequirementValidator';

  async check(output: string, context?: PipelineContext): Promise<OutputGuardrailResult> {
    const requirementText = context?.metadata?.requirementText as string | undefined;

    // Nothing to compare against — pass through silently.
    if (!requirementText || requirementText.trim().length === 0) {
      return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
    }

    const keywords = extractKeywords(requirementText);
    if (keywords.length === 0) {
      return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
    }

    const outputLower = output.toLowerCase();
    const matched      = keywords.filter(k => outputLower.includes(k));
    const overlapRatio = matched.length / keywords.length;

    // Very low overlap suggests the AI ignored the actual requirement
    // and generated generic or unrelated test cases.
    if (overlapRatio < 0.1) {
      return {
        passed:    true,
        action:    'warn',
        guardrail: this.name,
        reason:    `Low topical overlap with requirement (${(overlapRatio * 100).toFixed(0)}% of key terms matched) — output may be generic rather than ticket-specific`,
        sanitisedOutput: output,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
