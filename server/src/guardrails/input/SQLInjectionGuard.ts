import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';

export class SQLInjectionGuard implements IInputGuardrail {
  readonly name = 'SQLInjectionGuard';

  private readonly patterns: RegExp[] = [
    /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW)\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\s+(TABLE\s+)?\w+/i,
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    /\bOR\s+['"]?\s*1\s*['"]?\s*=\s*['"]?\s*1/i,
    /\bOR\s+['"]?\s*'[^']*'\s*=\s*'[^']*'/i,
    /\bAND\s+['"]?\s*1\s*['"]?\s*=\s*['"]?\s*1/i,
    /\bxp_cmdshell\b/i,
    /\bEXEC\s*\(/i,
    /\bEXECUTE\s*\(/i,
    /\bALTER\s+(TABLE|DATABASE|USER)\b/i,
    /\bINSERT\s+INTO\b.*\bVALUES\b/i,
    /\bSELECT\s+.*\bFROM\b.*\bWHERE\b.*[=<>]/i,
    /\bCAST\s*\(\s*.*\s+AS\s+/i,
    /\bCONVERT\s*\(\s*\w+\s*,/i,
    /--\s*$/m,                          // SQL comment at end of line
    /;\s*(DROP|DELETE|TRUNCATE|INSERT|UPDATE|ALTER)/i,
    /\bWAITFOR\s+DELAY\b/i,
    /\bSLEEP\s*\(\s*\d+\s*\)/i,
    /\bBENCHMARK\s*\(/i,
    /\/\*.*\*\//s,                       // inline comment
    /\bINFORMATION_SCHEMA\b/i,
    /\bSYSDATE\b|\bVERSION\s*\(\)/i,
    /\bLOAD_FILE\s*\(/i,
    /\bOUTFILE\b/i,
  ];

  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    const triggered: string[] = [];

    for (const p of this.patterns) {
      if (p.test(input)) triggered.push(p.source);
    }

    if (triggered.length > 0) {
      return { passed: false, action: 'block', guardrail: this.name, reason: 'SQL Injection Detected', details: triggered };
    }
    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
