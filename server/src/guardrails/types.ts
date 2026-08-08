// ── Shared types for the Guardrails Framework ─────────

export type GuardrailAction = 'block' | 'mask' | 'warn' | 'allow';

export interface GuardrailResult {
  passed:    boolean;
  action:    GuardrailAction;
  guardrail: string;
  reason?:   string;
  details?:  string[];
  masked?:   string;        // sanitised version of the input (for mask actions)
  metadata?: Record<string, any>;
}

export interface PipelineContext {
  userId?:    number;
  userRole?:  string;
  sessionId?: string;
  requestId?: string;
  action?:    string;       // e.g. 'generate_test_cases'
  tool?:      string;       // tool being invoked
  timestamp:  Date;
}

export interface InputGuardrailResult extends GuardrailResult {
  sanitisedInput?: string;  // input after masking
}

export interface OutputGuardrailResult extends GuardrailResult {
  sanitisedOutput?: string; // output after masking
  confidence?:      number; // 0–1
}

// Base interface every guardrail implements
export interface IInputGuardrail {
  name: string;
  check(input: string, context?: PipelineContext): Promise<InputGuardrailResult>;
}

export interface IOutputGuardrail {
  name: string;
  check(output: string, context?: PipelineContext): Promise<OutputGuardrailResult>;
}
