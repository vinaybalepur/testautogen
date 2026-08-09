import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';

interface SecretPattern { name: string; regex: RegExp; mask: string; }

export class SecretDetector implements IInputGuardrail {
  readonly name = 'SecretDetector';

  private readonly patterns: SecretPattern[] = [
    { name: 'OpenAI Key', regex: /sk-[a-zA-Z0-9]{20,}/g, mask: '[OPENAI_KEY REDACTED]' },
    { name: 'Anthropic Key', regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/g, mask: '[ANTHROPIC_KEY REDACTED]' },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, mask: '[GOOGLE_KEY REDACTED]' },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, mask: '[AWS_KEY REDACTED]' },
    { name: 'AWS Secret Key', regex: /aws.{0,20}?['"][0-9a-zA-Z/+]{40}['"]/i, mask: '[AWS_SECRET REDACTED]' },
    { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/g, mask: '[GITHUB_TOKEN REDACTED]' },
    { name: 'GitHub Token v2', regex: /github_pat_[a-zA-Z0-9_]{82}/g, mask: '[GITHUB_TOKEN REDACTED]' },
    { name: 'GitLab Token', regex: /glpat-[a-zA-Z0-9\-_]{20}/g, mask: '[GITLAB_TOKEN REDACTED]' },
    { name: 'JWT', regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, mask: '[JWT REDACTED]' },
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----[\s\S]+?-----END/g, mask: '[PRIVATE_KEY REDACTED]' },
    { name: 'SSH Key', regex: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END/g, mask: '[SSH_KEY REDACTED]' },
    { name: 'Connection String', regex: /(?:mongodb|postgresql|mysql|redis):\/\/[^\s"']+/gi, mask: '[CONN_STRING REDACTED]' },
    { name: 'DB Password', regex: /(db_password|database_password|db_pass)\s*[=:]\s*\S+/gi, mask: '[DB_PASS REDACTED]' },
    { name: 'OAuth Token', regex: /ya29\.[a-zA-Z0-9_\-]+/g, mask: '[OAUTH_TOKEN REDACTED]' },
    { name: 'Azure Key', regex: /[a-zA-Z0-9+\/]{43}=\s*$/gm, mask: '[AZURE_KEY REDACTED]' },
    { name: 'Gemini Key', regex: /AQ\.[a-zA-Z0-9_\-]{30,}/g, mask: '[GEMINI_KEY REDACTED]' },
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const found: string[] = [];
    let sanitised = input;

    for (const p of this.patterns) {
      p.regex.lastIndex = 0;
      if (new RegExp(p.regex.source, p.regex.flags).test(input)) {
        found.push(p.name);
        p.regex.lastIndex = 0;
        sanitised = sanitised.replace(p.regex, p.mask);
      }
    }

    if (found.length > 0) {
      return {
        passed: false,
        action: 'mask',
        guardrail: this.name,
        reason: `Secrets Detected: ${found.join(', ')}`,
        details: found,
        sanitisedInput: sanitised,
      };
    }

    return { passed: true, action: 'allow', guardrail: this.name, sanitisedInput: input };
  }

  mask(text: string): string {
    let result = text;
    for (const p of this.patterns) {
      p.regex.lastIndex = 0;
      result = result.replace(p.regex, p.mask);
    }
    return result;
  }
}
