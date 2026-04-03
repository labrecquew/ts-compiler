import fs from "node:fs";
import { Parser } from "../parser/parser";
import { Lexer } from "./lexer";

const CLI_USAGE = "Usage: npm start -- [--quiet|--debug] <filePath>";

interface CliOptions {
  filePath: string;
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

    if (filePath === undefined) {
      filePath = arg;
      continue;
    }

    console.error(`Unexpected argument: ${arg}`);
    console.error(CLI_USAGE);
    process.exit(1);
  }

  if (filePath === undefined) {
    console.error("Missing required file path.");
    console.error(CLI_USAGE);
    process.exit(1);
  }

  return { filePath, debug };
}

function readInput(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function main(): void {
  const options = parseCliOptions(process.argv);
  const source = readInput(options.filePath);
  const lexer = new Lexer(source, { debug: options.debug });

  for (;;) {
    const segment = lexer.lexNextProgram();
    if (segment === null) {
      break;
    }

    if (segment.lexErrorCount > 0) {
      console.log(
        `INFO  Parser - Skipping parse for program ${segment.programNumber} because lexing reported ${segment.lexErrorCount} error(s).`
      );
      continue;
    }

    const parser = new Parser(segment.tokens, segment.programNumber, { debug: options.debug });
    parser.run();
  }
}

main();
