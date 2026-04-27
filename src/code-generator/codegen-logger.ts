export class CodeGenLogger {
  constructor(private readonly debugEnabled: boolean) {}

  info(message: string): void {
    console.log(`INFO  CodeGen - ${message}`);
  }

  debug(message: string): void {
    if (this.debugEnabled) {
      console.log(`DEBUG CodeGen - ${message}`);
    }
  }

  error(message: string): void {
    console.log(`ERROR CodeGen - ${message}`);
  }
}
