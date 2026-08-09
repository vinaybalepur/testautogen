import path from 'path';
import { IInputGuardrail, InputGuardrailResult, PipelineContext } from '../types';
import config from '../config/guardrails.json';

export interface FileValidationInput {
  filename:  string;
  sizeMB:    number;
  pages?:    number;
  mimeType?: string;
}

export class FileValidator implements IInputGuardrail {
  readonly name = 'FileValidator';

  private readonly allowedExts  = new Set(config.file.allowedExtensions.map(e => e.toLowerCase()));
  private readonly blockedExts  = new Set(config.file.blockedExtensions.map(e => e.toLowerCase()));
  private readonly maxSizeMB    = config.file.maxSizeMB;
  private readonly maxPages     = config.file.maxPages;

  
  

  // IInputGuardrail.check — accepts JSON-stringified FileValidationInput
  async check(input: string, _context?: PipelineContext): Promise<InputGuardrailResult> {
    let fileInput: FileValidationInput;
    try {
      fileInput = JSON.parse(input) as FileValidationInput;
    } catch {
      return { passed: false, action: 'block', guardrail: this.name, reason: 'Invalid file metadata' };
    }
    return this.validateFile(fileInput);
  }

  validateFile(file: FileValidationInput): InputGuardrailResult {
    const ext = path.extname(file.filename).toLowerCase();

    if (this.blockedExts.has(ext)) {
      return { passed: false, action: 'block', guardrail: this.name, reason: `Blocked file type: ${ext}` };
    }

    if (!this.allowedExts.has(ext)) {
      return { passed: false, action: 'block', guardrail: this.name, reason: `Unsupported file type: ${ext}` };
    }

    if (file.sizeMB > this.maxSizeMB) {
      return { passed: false, action: 'block', guardrail: this.name, reason: `File exceeds ${this.maxSizeMB}MB limit (${file.sizeMB.toFixed(1)}MB)` };
    }

    if (file.pages !== undefined && file.pages > this.maxPages) {
      return { passed: false, action: 'block', guardrail: this.name, reason: `File exceeds ${this.maxPages} page limit (${file.pages} pages)` };
    }

    return { passed: true, action: 'allow', guardrail: this.name };
  }
}
