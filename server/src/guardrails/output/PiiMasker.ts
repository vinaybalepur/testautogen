import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';
import { PIIDetector } from '../input/PIIDetector';

export class PiiMasker implements IOutputGuardrail {
  readonly name = 'PiiMasker';
  private readonly detector = new PIIDetector();

  async check(output: string, _context?: PipelineContext): Promise<OutputGuardrailResult> {
    const result = await this.detector.check(output);

    if (!result.passed && result.action === 'mask') {
      return {
        passed:           true,   // masked — pipeline continues
        action:           'mask',
        guardrail:        this.name,
        reason:           result.reason,
        details:          result.details,
        sanitisedOutput:  result.sanitisedInput,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
