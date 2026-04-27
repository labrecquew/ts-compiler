import { DiagnosticSeverity, type Diagnostic } from "../parser/diagnostics";

export interface CodeGenDiagnosticContext {
  programNumber: number;
  construct: string;
  byteOffset: number;
}

export function codeGenError(
  context: CodeGenDiagnosticContext,
  what: string,
  why: string,
  howToFix: string
): Diagnostic {
  return {
    severity: DiagnosticSeverity.Error,
    line: 0,
    column: context.byteOffset,
    message:
      `Program ${context.programNumber}, ${context.construct}, byte ${formatByteOffset(context.byteOffset)}: ` +
      `${what} ${why} ${howToFix}`
  };
}

function formatByteOffset(offset: number): string {
  if (offset < 0) {
    return "<unknown>";
  }
  return `$${offset.toString(16).toUpperCase().padStart(2, "0")}`;
}
