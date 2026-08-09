import fs from 'fs';
import path from 'path';
import {
  IInputGuardrail,
  IOutputGuardrail,
  InputGuardrailResult,
  OutputGuardrailResult,
  PipelineContext,
} from './types';

// ── Input guards ─────────────────────────────────────
import { PromptInjectionGuard }  from './input/PromptInjectionGuard';
import { JailbreakDetector }     from './input/JailbreakDetector';
import { ToxicityGuard }         from './input/ToxicityGuard';
import { PIIDetector }           from './input/PIIDetector';
import { SecretDetector }        from './input/SecretDetector';
import { SQLInjectionGuard }     from './input/SQLInjectionGuard';
import { XSSGuard }              from './input/XSSGuard';
import { CommandInjectionGuard } from './input/CommandInjectionGuard';
import { FileValidator }         from './input/FileValidator';
import { TokenLimitGuard }       from './input/TokenLimitGuard';
import { LanguageValidator }     from './input/LanguageValidator';

// ── Output guards ────────────────────────────────────
import { PiiMasker }             from './output/PiiMasker';
import { SecretMasker }          from './output/SecretMasker';
import { HallucinationGuard }    from './output/HallucinationGuard';
import { JsonValidator }         from './output/JsonValidator';
import { ResponseValidator }     from './output/ResponseValidator';
import { ReportValidator }       from './output/ReportValidator';
import { RequirementValidator }  from './output/RequirementValidator';
import { TestCaseValidator }     from './output/TestCaseValidator';

interface GuardrailConfigEntry {
  enabled: boolean;
  action?: string;
  [key: string]: unknown;
}

interface GuardrailsConfig {
  version: string;
  enabled: boolean;
  input:  Record<string, GuardrailConfigEntry>;
  output: Record<string, GuardrailConfigEntry>;
  [key: string]: unknown;
}

export interface PipelineResult<T> {
  passed:    boolean;             // false only if a 'block' action fired
  blocked:   boolean;              // convenience alias for !passed
  content:   string;               // final content — original, masked, or sanitised
  warnings:  T[];                  // results with action 'warn'
  blockedBy: T | null;              // the guard result that caused the block, if any
  allResults: T[];                 // every guard result, for logging/audit
}

// Config is loaded once at module load — restart the server to pick up
// changes to guardrails.json.
const CONFIG_PATH = path.join(__dirname, 'config', 'guardrails.json');
const config: GuardrailsConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

// ── Guard registries — maps config key -> guard instance ──
const inputGuards: Record<string, IInputGuardrail> = {
  promptInjection:   new PromptInjectionGuard(),
  jailbreak:         new JailbreakDetector(),
  toxicity:          new ToxicityGuard(),
  pii:               new PIIDetector(),
  secrets:           new SecretDetector(),
  sqlInjection:      new SQLInjectionGuard(),
  xss:               new XSSGuard(),
  commandInjection:  new CommandInjectionGuard(),
  fileValidation:    new FileValidator(),
  tokenLimit:        new TokenLimitGuard(),
  languageValidator: new LanguageValidator(),
};

const outputGuards: Record<string, IOutputGuardrail> = {
  piiMasker:            new PiiMasker(),
  secretMasker:         new SecretMasker(),
  hallucinationGuard:   new HallucinationGuard(),
  jsonValidator:        new JsonValidator(),
  responseValidator:    new ResponseValidator(),
  reportValidator:      new ReportValidator(),
  requirementValidator: new RequirementValidator(),
  testCaseValidator:    new TestCaseValidator(),
};

const CONTEXT_ONLY_GUARDS: Record<string, string[]> = {
  fileValidation: ['upload_csv', 'upload_file'],
};

/**
 * Runs every enabled input guard against `input`, in the order they
 * appear in guardrails.json. Stops early if a guard's configured
 * action is 'block' and it fails — later guards are not run.
 *
 * 'mask' actions replace `content` with the guard's `.masked` value
 * and continue the pipeline so later guards see the sanitised text.
 */
export async function runInputGuardrails(
  input: string,
  context?: PipelineContext
): Promise<PipelineResult<InputGuardrailResult>> {
  if (!config.enabled) {
    return { passed: true, blocked: false, content: input, warnings: [], blockedBy: null, allResults: [] };
  }

  let content = input;
  const warnings: InputGuardrailResult[] = [];
  const allResults: InputGuardrailResult[] = [];

for (const [key, guard] of Object.entries(inputGuards)) {
    const entry = config.input[key];
    if (!entry?.enabled) continue;

    // Skip guards that only apply to specific action contexts
    const restrictedTo = CONTEXT_ONLY_GUARDS[key];
    if (restrictedTo && (!context?.action || !restrictedTo.includes(context.action))) {
      continue;
    }

    const result = await guard.check(content, context);
    allResults.push(result);

    if (result.passed) continue;

    const configuredAction = entry.action || result.action;

    if (configuredAction === 'block') {
      return { passed: false, blocked: true, content, warnings, blockedBy: result, allResults };
    }

    if (configuredAction === 'mask' && result.masked) {
      content = result.masked;
      continue;
    }

    if (configuredAction === 'warn') {
      warnings.push(result);
      continue;
    }
  }

  return { passed: true, blocked: false, content, warnings, blockedBy: null, allResults };
}

/**
 * Runs every enabled output guard against `output`, same semantics
 * as runInputGuardrails but operating on AI-generated content before
 * it's persisted or returned to the user.
 */
export async function runOutputGuardrails(
  output: string,
  context?: PipelineContext
): Promise<PipelineResult<OutputGuardrailResult>> {
  if (!config.enabled) {
    return { passed: true, blocked: false, content: output, warnings: [], blockedBy: null, allResults: [] };
  }

  let content = output;
  const warnings: OutputGuardrailResult[] = [];
  const allResults: OutputGuardrailResult[] = [];

  for (const [key, guard] of Object.entries(outputGuards)) {
    const entry = config.output[key];
    if (!entry?.enabled) continue;

    const result = await guard.check(content, context);
    allResults.push(result);

    if (result.passed && result.action !== 'warn') {
      if (result.sanitisedOutput) content = result.sanitisedOutput;
      continue;
    }

    if (!result.passed && result.action === 'block') {
      return { passed: false, blocked: true, content, warnings, blockedBy: result, allResults };
    }

    if (result.action === 'warn') {
      warnings.push(result);
      if (result.sanitisedOutput) content = result.sanitisedOutput;
      continue;
    }

    // mask (output guards use sanitisedOutput rather than .masked)
    if (result.sanitisedOutput) content = result.sanitisedOutput;
  }

  return { passed: true, blocked: false, content, warnings, blockedBy: null, allResults };
}
