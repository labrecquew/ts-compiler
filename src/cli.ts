import fs from "node:fs";
import { Lexer } from "./lexer";

function readInput(argv: string[]): string {
  const filePath = argv[2];

  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }

  return fs.readFileSync(0, "utf8");
}

function main(): void {
  const source = readInput(process.argv);
  const lexer = new Lexer(source, { debug: true });

  // Full input scan with no token output, just to make sure the lexer is working
  lexer.lex();
}

main();
