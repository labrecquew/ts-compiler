import { CodeGenerator } from "@compiler/code-generator";
import { Lexer } from "@compiler/lexer/lexer";
import type { Diagnostic } from "@compiler/parser/diagnostics";
import { Parser } from "@compiler/parser/parser";
import { formatAstLines, SemanticAnalyzer, type SymbolEntry } from "@compiler/semantic-analysis";

export interface PipelineOptions {
  source: string;
  debug: boolean;
}

export interface LogEntry {
  phase:
    | "Lexer"
    | "Parser"
    | "SemanticAnalysis"
    | "CodeGen"
    | "CST"
    | "AST"
    | "Symbol Table"
    | "Memory Image"
    | "Other";
  level: "INFO" | "DEBUG" | "WARN" | "ERROR" | "HINT" | "Other";
  text: string;
}

export interface ProgramResult {
  programNumber: number;
  status: "ok" | "lex-failed" | "parse-failed" | "semantic-failed" | "codegen-failed";
  log: LogEntry[];
  cstLines: string[] | null;
  astLines: string[] | null;
  symbols: SymbolEntry[] | null;
  image: { rows: string[]; codeEnd: number; heapStart: number; stream: string } | null;
  diagnostics: Diagnostic[];
}

const LOG_RE = /^(INFO|DEBUG|WARN|ERROR|HINT)\s+(\S+)\s+-\s(.*)$/;
const LEXING_PROGRAM_RE = /^INFO\s+Lexer\s+-\s+Lexing program\s+(\d+)\.\.\.$/;

type BodyPhase = Extract<LogEntry["phase"], "CST" | "AST" | "Symbol Table" | "Memory Image">;

function parseLogLines(lines: string[]): LogEntry[] {
  let bodyPhase: BodyPhase | null = null;

  return lines.map((line) => {
    const parsed = parseLogLine(line, bodyPhase);
    bodyPhase = nextBodyPhase(line, parsed);
    return parsed;
  });
}

function parseLogLine(line: string, bodyPhase: BodyPhase | null): LogEntry {
  const match = LOG_RE.exec(line);
  if (match === null) {
    if (line.startsWith("CST for program ")) {
      return { phase: "CST", level: "Other", text: line };
    }
    return { phase: bodyPhase ?? "Other", level: "Other", text: line };
  }

  const [, level, phase, text] = match;
  if (
    phase === "Lexer" ||
    phase === "Parser" ||
    phase === "SemanticAnalysis" ||
    phase === "CodeGen"
  ) {
    return { phase, level: level as LogEntry["level"], text };
  }

  return { phase: "Other", level: level as LogEntry["level"], text };
}

function nextBodyPhase(line: string, entry: LogEntry): BodyPhase | null {
  if (line.startsWith("CST for program ")) {
    return "CST";
  }
  if (entry.phase === "SemanticAnalysis" && entry.text.startsWith("Printing AST for program ")) {
    return "AST";
  }
  if (entry.phase === "SemanticAnalysis" && entry.text.startsWith("Printing symbol table for program ")) {
    return "Symbol Table";
  }
  if (entry.phase === "CodeGen" && entry.text.startsWith("Printing memory image for program ")) {
    return "Memory Image";
  }
  if (entry.level !== "Other") {
    return null;
  }
  return entry.phase === "CST" ||
    entry.phase === "AST" ||
    entry.phase === "Symbol Table" ||
    entry.phase === "Memory Image"
    ? entry.phase
    : null;
}

export function runPipeline(opts: PipelineOptions): { programs: ProgramResult[] } {
  const originalLog = console.log;
  const rawLogs = new Map<number, string[]>();
  const programs: ProgramResult[] = [];
  let currentProgram = 1;

  const logsFor = (programNumber: number): string[] => {
    const existing = rawLogs.get(programNumber);
    if (existing !== undefined) {
      return existing;
    }
    const next: string[] = [];
    rawLogs.set(programNumber, next);
    return next;
  };

  console.log = (...args: unknown[]) => {
    const line = args.join(" ");
    const programMatch = LEXING_PROGRAM_RE.exec(line);
    if (programMatch !== null) {
      currentProgram = Number(programMatch[1]);
    }
    logsFor(currentProgram).push(line);
  };

  try {
    const lexer = new Lexer(opts.source, { debug: opts.debug });

    for (;;) {
      const segment = lexer.lexNextProgram();
      if (segment === null) {
        break;
      }

      if (segment.lexErrorCount > 0) {
        console.log(
          `INFO  Parser - Skipping parse for program ${segment.programNumber} because lexing reported ${segment.lexErrorCount} error(s).`
        );
        console.log(
          `INFO  SemanticAnalysis - Skipping semantic analysis for program ${segment.programNumber} because lexing reported error(s).`
        );
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because lexing reported error(s).`
        );
        programs.push(emptyResult(segment.programNumber, "lex-failed"));
        continue;
      }

      const parser = new Parser(segment.tokens, segment.programNumber, { debug: opts.debug });
      parser.run();
      const cstLines = parser.cstLines();

      if (parser.parseErrorCount() !== 0) {
        console.log(
          `INFO  SemanticAnalysis - Skipping semantic analysis for program ${segment.programNumber} because parsing reported error(s).`
        );
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because parsing reported error(s).`
        );
        programs.push({
          ...emptyResult(segment.programNumber, "parse-failed"),
          cstLines
        });
        continue;
      }

      const semantics = new SemanticAnalyzer();
      const semanticResult = semantics.run(segment.tokens, segment.programNumber, { quiet: !opts.debug });
      const astLines = semanticResult.ast === null ? null : formatAstLines(semanticResult.ast);
      const symbols =
        semanticResult.errorCount === 0 && semanticResult.scopeState !== null
          ? semanticResult.scopeState.symbolsInOrder
          : null;

      if (
        semanticResult.errorCount !== 0 ||
        semanticResult.ast === null ||
        semanticResult.scopeState === null
      ) {
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because semantic analysis reported error(s).`
        );
        programs.push({
          programNumber: segment.programNumber,
          status: "semantic-failed",
          log: [],
          cstLines,
          astLines,
          symbols,
          image: null,
          diagnostics: semanticResult.diagnostics
        });
        continue;
      }

      const codeGenerator = new CodeGenerator();
      const codegenResult = codeGenerator.run(semanticResult.ast, semanticResult.scopeState, segment.programNumber, {
        quiet: !opts.debug
      });

      programs.push({
        programNumber: segment.programNumber,
        status: codegenResult.errorCount === 0 ? "ok" : "codegen-failed",
        log: [],
        cstLines,
        astLines,
        symbols,
        image:
          codegenResult.errorCount === 0
            ? {
                rows: codegenResult.imageRows,
                codeEnd: codegenResult.codeEnd,
                heapStart: codegenResult.heapStart,
                stream: codegenResult.stream
              }
            : null,
        diagnostics: [...semanticResult.diagnostics, ...codegenResult.diagnostics]
      });
    }
  } finally {
    console.log = originalLog;
  }

  return {
    programs: programs.map((program) => ({
      ...program,
      log: parseLogLines(rawLogs.get(program.programNumber) ?? [])
    }))
  };
}

function emptyResult(programNumber: number, status: ProgramResult["status"]): ProgramResult {
  return {
    programNumber,
    status,
    log: [],
    cstLines: null,
    astLines: null,
    symbols: null,
    image: null,
    diagnostics: []
  };
}
