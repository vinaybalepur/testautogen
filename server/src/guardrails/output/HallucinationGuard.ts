import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';

const SAFE_RESPONSE =
  "I don't have sufficient information to generate a reliable response. " +
  'Please provide additional context or upload the relevant requirement document.';

// Phrases that indicate the model is fabricating without evidence
const FABRICATION_SIGNALS: RegExp[] = [
  /test\s+(passed|failed|executed)\s+(successfully|with\s+\d+\s+(error|failure))/i,
  /\d+\s*%\s*(code\s+)?coverage\s+(achieved|measured)/i,
  /execution\s+time\s*:\s*\d+\s*(ms|seconds?|minutes?)/i,
  /defect\s+#?\s*\d+\s+(found|detected|reported)/i,
  /as\s+(per|per\s+the)\s+requirement\s+[A-Z]+-\d+/i,
  /requirement\s+[A-Z]+-\d+\s+states?\s+that/i,
  /the\s+(system|api|application)\s+(returns?|responds?)\s+with\s+(status\s+)?\d{3}/i,
  /\b(confirmed|verified|validated)\s+(by|with)\s+(the\s+)?(team|client|stakeholder)/i,
];

// Confidence indicators in output — signals the model is uncertain
const LOW_CONFIDENCE_SIGNALS: RegExp[] = [
  /\bi\s+(assume|believe|think|suppose)\s+that\b/i,
  /\b(probably|possibly|maybe|perhaps|might|could)\s+(be|have|work|return)\b/i,
  /\bi\s+am\s+not\s+(sure|certain|confident)\b/i,
  /\b(approximately|roughly|around|about)\s+\d+\s*%/i,
  /\bcannot\s+(confirm|verify|validate)\b/i,
  /\bno\s+(information|data|evidence|context)\s+(provided|available|given)\b/i,
];

export class HallucinationGuard implements IOutputGuardrail {
  readonly name = 'HallucinationGuard';

  private calculateConfidence(output: string, context?: PipelineContext): number {
    let score = 1.0;

    // Penalise fabrication signals
    for (const p of FABRICATION_SIGNALS) {
      if (p.test(output)) score -= 0.2;
    }

    // Penalise low-confidence language
    for (const p of LOW_CONFIDENCE_SIGNALS) {
      if (p.test(output)) score -= 0.1;
    }

    // Reward: if context has uploaded docs/ticket data, boost slightly
    if (context?.metadata?.hasRequirementDoc) score += 0.1;
    if (context?.metadata?.hasJiraTicket)     score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  async check(output: string, context?: PipelineContext): Promise<OutputGuardrailResult> {
    const confidence = this.calculateConfidence(output, context);
    const fabricationHits: string[] = [];

    for (const p of FABRICATION_SIGNALS) {
      if (p.test(output)) fabricationHits.push(p.source);
    }

    // Hard block: explicit fabrication without supporting context
    if (fabricationHits.length > 0 && !context?.metadata?.hasRequirementDoc && !context?.metadata?.hasJiraTicket) {
      return {
        passed:          false,
        action:          'block',
        guardrail:       this.name,
        reason:          'Potential hallucination: fabricated facts detected without supporting evidence',
        details:         fabricationHits,
        confidence,
        sanitisedOutput: SAFE_RESPONSE,
      };
    }

    // Warn: low confidence but not outright fabrication
    if (confidence < 0.4) {
      return {
        passed:          true,
        action:          'warn',
        guardrail:       this.name,
        reason:          `Low confidence score: ${(confidence * 100).toFixed(0)}%`,
        confidence,
        sanitisedOutput: output,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, confidence, sanitisedOutput: output };
  }
}
