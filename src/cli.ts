import fs from "node:fs";
import { Lexer } from "./lexer";

interface CliOptions {
  filePath?: string;
  debug: boolean;
}

function parseCliOptions(argv: string[]): CliOptions {
  const args = argv.slice(2);
  let filePath: string | undefined;
  let debug = true;

  for (const arg of args) {
    if (arg === "--quiet" || arg === "-q") {
      debug = false;
      continue;
    }

    if (arg === "--debug" || arg === "-d") {
      debug = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm start -- [--quiet|--debug] [filePath]");
      process.exit(0);
    }

    if (filePath === undefined) {
      filePath = arg;
      continue;
    }

    console.error(`Unexpected argument: ${arg}`);
    console.error("Usage: npm start -- [--quiet|--debug] [filePath]");
    process.exit(1);
  }

  return { filePath, debug };
}

function readInput(filePath?: string): string {
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }

  return fs.readFileSync(0, "utf8");
}

function main(): void {
  const options = parseCliOptions(process.argv);
  const source = readInput(options.filePath);
  const lexer = new Lexer(source, { debug: options.debug });

  // Run the lexer with verbose token traces on by default unless quiet mode is requested.
  lexer.lex();
}

main();
