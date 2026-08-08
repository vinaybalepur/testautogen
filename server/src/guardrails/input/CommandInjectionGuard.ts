import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';

export class CommandInjectionGuard implements IInputGuardrail {
  readonly name = 'CommandInjectionGuard';

  private readonly patterns: RegExp[] = [
    /\brm\s+-rf?\b/i,
    /\bsudo\s+\w+/i,
    /\bchmod\s+[0-9]{3,4}\b/i,
    /\bchown\s+\w+/i,
    /\bpowershell\b/i,
    /\bcmd\.exe\b/i,
    /\bbash\s+-[ci]/i,
    /\b(sh|bash|zsh|ksh|csh)\s+(-[ceils]+\s+)?['"]/i,
    /\bcurl\s+(-[a-zA-Z]+\s+)*https?:\/\//i,
    /\bwget\s+https?:\/\//i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bhalt\b/i,
    /\bkill\s+-9\b/i,
    /\bkillall\b/i,
    /\bpkill\b/i,
    /\bnc\s+(-[a-z]+\s+)?\d+\.\d+/i,   // netcat
    /\bnetcat\b/i,
    /\bdd\s+if=/i,
    /\bmkfs\b/i,
    /\bfdisk\b/i,
    /\bformat\s+[a-z]:/i,
    /\b(python|python3|ruby|perl|node)\s+-[ec]\s+["']/i,
    /\bexec\s*\(/i,
    /\bsystem\s*\(/i,
    /\bpopen\s*\(/i,
    /[|;&`$]\s*(rm|curl|wget|bash|sh|python|nc|kill)/i,
    /\$\(.*\)/,                          // command substitution
    /`[^`]+`/,                           // backtick execution
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const triggered: string[] = [];

    for (const p of this.patterns) {
      if (p.test(input)) triggered.push(p.source);
    }

    if (triggered.length > 0) {
      return { passed: false, action: 'block', guardrail: this.name, reason: 'Command Injection Detected', details: triggered };
    }
    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
