import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import blockedWords from '../config/blockedWords.json';

export class ToxicityGuard implements IInputGuardrail {
  readonly name = 'ToxicityGuard';

  private readonly categories: Record<string, RegExp[]> = {
    violence: [
      /\b(kill|murder|assassinate|slaughter)\s+(a\s+)?(person|people|human|someone)\b/i,
      /how\s+to\s+(kill|hurt|harm|injure|attack)\s+(a\s+)?(person|people|someone)/i,
      /\b(explosive|bomb)\s+(making|instructions?|how\s+to|create|build)\b/i,
    ],
    selfHarm: [
      /\b(commit|planning|considering)\s+(suicide|self-harm)\b/i,
      /how\s+to\s+(kill\s+myself|hurt\s+myself|end\s+my\s+life)/i,
    ],
    terrorism: [
      /\b(terrorist|terrorism)\s+(attack|plan|instructions?)\b/i,
      /how\s+to\s+(join|plan)\s+(a\s+)?(terrorist|extremist)/i,
    ],
    illegalActivity: [
      /how\s+to\s+(hack|crack|exploit|break\s+into)\s+(a\s+)?(system|database|server|account)/i,
      /\bdrug\s+(synthesis|manufacturing|how\s+to\s+make)\b/i,
      /\b(create|make)\s+(malware|ransomware|virus|trojan|keylogger)\b/i,
      /\bchild\s+(abuse|exploitation|pornography|grooming)\b/i,
    ],
    hateSpeech: [
      /\b(all|every)\s+\w+\s+(should\s+)?(die|be\s+killed|are\s+inferior)\b/i,
      /\b(ethnic|racial)\s+(cleansing|superiority)\b/i,
    ],
    harassment: [
      /\b(stalk|doxx|dox|swat)\s+(someone|a\s+person|them)\b/i,
    ],
  };

  private readonly wordPatterns: RegExp[] = blockedWords.toxicity.map(
    w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  );

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const triggered: string[] = [];

    for (const [category, patterns] of Object.entries(this.categories)) {
      for (const p of patterns) {
        if (p.test(input)) triggered.push(`${category}: ${p.source}`);
      }
    }

    if (triggered.length === 0) {
      for (const p of this.wordPatterns) {
        if (p.test(input)) triggered.push(`keyword: ${p.source}`);
      }
    }

    if (triggered.length > 0) {
      return { passed: false, action: 'block', guardrail: this.name, reason: 'Toxic Content Detected', details: triggered };
    }
    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
