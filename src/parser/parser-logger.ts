/**
 * Parser console output: same severity families as the lexer (`INFO` / `DEBUG` / `ERROR` / `WARN` / `HINT`).
 */
export class ParserLogger {
  constructor(private readonly debugEnabled: boolean) {}

  info(message: string): void {
    console.log(`INFO  Parser - ${message}`);
  }

  debug(message: string): void {
    if (!this.debugEnabled) {
      return;
    }
    console.log(`DEBUG Parser - ${message}`);
  }

  errorLine(line: number, column: number, message: string): void {
    console.log(`ERROR Parser - Error:${line}:${column} ${message}`);
  }

  warnLine(line: number, column: number, message: string): void {
    console.log(`WARN  Parser - Warning:${line}:${column} ${message}`);
  }

  hintLine(line: number, column: number, message: string): void {
    console.log(`HINT  Parser - Hint:${line}:${column} ${message}`);
  }

  parseFailed(errorCount: number): void {
    console.log(`ERROR Parser - Parse failed with ${errorCount} error(s)`);
  }
}
