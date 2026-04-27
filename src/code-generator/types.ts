import type { Diagnostic } from "../parser/diagnostics";

export interface CodeGeneratorOptions {
  quiet?: boolean;
}

export interface CodeGeneratorResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  imageRows: string[];
  stream: string;
  codeEnd: number;
  heapStart: number;
}
