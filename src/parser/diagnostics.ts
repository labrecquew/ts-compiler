export enum DiagnosticSeverity {
  Error = "Error",
  Warning = "Warning",
  Hint = "Hint"
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  line: number;
  column: number;
  message: string;
}
