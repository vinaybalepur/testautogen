import { IOutputGuardrail, OutputGuardrailResult, PipelineContext } from '../types';
import { SecretDetector } from '../input/SecretDetector';

export class SecretMasker implements IOutputGuardrail {
  readonly name = 'SecretMasker';
  private readonly detector = new SecretDetector();

  async check(output: string, _context?: PipelineContext): Promise<OutputGuardrailResult> {
    const result = await this.detector.check(output);

    if (!result.passed && result.action === 'mask') {
      return {
        passed:          true,   // masked — pipeline continues
        action:          'mask',
        guardrail:       this.name,
        reason:          result.reason,
        details:         result.details,
        sanitisedOutput: result.sanitisedInput,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedOutput: output };
  }
}
