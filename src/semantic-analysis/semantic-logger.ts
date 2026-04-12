/**
 * Semantic phase console output: same severity families as lexer/parser
 * (`INFO` / `DEBUG` / `ERROR` / `WARN` / `HINT`).
 */
export class SemanticLogger {
  constructor(private readonly debugEnabled: boolean) {}

  info(message: string): void {
    console.log(`INFO  SemanticAnalysis - ${message}`);
  }

  debug(message: string): void {
    if (!this.debugEnabled) {
      return;
    }
    console.log(`DEBUG SemanticAnalysis - ${message}`);
  }

  errorLine(line: number, column: number, message: string): void {
    console.log(`ERROR SemanticAnalysis - Error:${line}:${column} ${message}`);
  }

  warnLine(line: number, column: number, message: string): void {
    console.log(`WARN  SemanticAnalysis - Warning:${line}:${column} ${message}`);
  }

  hintLine(line: number, column: number, message: string): void {
    console.log(`HINT  SemanticAnalysis - Hint:${line}:${column} ${message}`);
  }

  semanticFailed(errorCount: number): void {
    console.log(
      `ERROR SemanticAnalysis - Semantic analysis failed with ${errorCount} error(s)`
    );
  }
}
