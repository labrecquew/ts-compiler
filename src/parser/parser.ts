import type { Token } from "../lexer/tokens";
import { TokenType } from "../lexer/tokens";
import { nonTerminal, terminal, type CstNode, type CstNonTerminal } from "./cst";
import { DiagnosticSeverity, type Diagnostic } from "./diagnostics";
import { ParserLogger } from "./parser-logger";
import { printCst } from "./cst-printer";
import { TokenCursor } from "./token-cursor";

export interface ParserOptions {
  /** Verbose `DEBUG Parser - …` traces (default true, like the lexer). */
  debug?: boolean;
}

const TOKEN_READABLE: Partial<Record<TokenType, string>> = {
  [TokenType.OPEN_BLOCK]: "OPEN_BLOCK '{'",
  [TokenType.CLOSE_BLOCK]: "CLOSE_BLOCK '}'",
  [TokenType.OPEN_PAREN]: "OPEN_PAREN '('",
  [TokenType.CLOSE_PAREN]: "CLOSE_PAREN ')'",
  [TokenType.EOP]: "EOP '$'",
  [TokenType.ASSIGN_OP]: "ASSIGN_OP '='",
  [TokenType.PRINT]: "PRINT 'print'",
  [TokenType.WHILE]: "WHILE 'while'",
  [TokenType.IF]: "IF 'if'",
  [TokenType.I_TYPE]: "type (int|string|boolean)",
  [TokenType.ID]: "identifier"
};

function describeExpected(type: TokenType): string {
  return TOKEN_READABLE[type] ?? String(type);
}

function describeGot(token: Token | undefined): string {
  if (token === undefined) {
    return "end of token stream (missing token)";
  }
  const base = TOKEN_READABLE[token.type] ?? String(token.type);
  return `${base} lexeme ${JSON.stringify(token.lexeme)}`;
}

/**
 * Recursive-descent parser aligned with grammar.md:
 * Program, Block, StatementList (epsilon and recursion), and Statement → Block for Step 2.
 * Other statement kinds are handled in later steps. Diagnostics are separate from parse control;
 * CST is only printed when there are zero parse errors.
 */
export class Parser {
  private readonly cursor: TokenCursor;
  private readonly log: ParserLogger;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(
    tokens: readonly Token[],
    private readonly programNumber: number,
    options: ParserOptions = {}
  ) {
    this.cursor = new TokenCursor(tokens);
    this.log = new ParserLogger(options.debug ?? true);
  }

  /** Entry point: parse `Program`, emit traces, print CST only on success. */
  run(): void {
    this.log.info(`Parsing program ${this.programNumber}...`);
    this.log.debug("parse()");
    const root = this.parseProgram();

    const errorsBeforeExtraneous = this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error).length;
    if (errorsBeforeExtraneous === 0 && !this.cursor.isAtEnd()) {
      const t = this.cursor.peek()!;
      this.reportError(
        t.position.line,
        t.position.column,
        `Extraneous input after complete Program: ${describeGot(t)} at ${t.position.line}:${t.position.column}. ` +
          "Remove everything after the closing '$' that ends the program, or start a new program segment with '$' only after the previous program has fully ended."
      );
    }

    const errors = this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error);
    if (errors.length > 0) {
      this.log.parseFailed(errors.length);
      console.log(`CST for program ${this.programNumber}: Skipped due to PARSER error(s).`);
      return;
    }

    this.log.info("Parse completed with 0 errors");
    printCst(this.programNumber, root);
  }

  // --- Program ::= Block $ ---

  private parseProgram(): CstNonTerminal {
    this.log.debug("parseProgram()");
    const block = this.parseBlock();
    const eop = this.expect(TokenType.EOP, "Program requires end-of-program marker '$' after Block");
    const children: CstNode[] = [block];
    if (eop !== null) {
      children.push(terminal(eop));
    }
    return nonTerminal("Program", children);
  }

  // --- Block ::= { StatementList } ---

  private parseBlock(): CstNonTerminal {
    this.log.debug("parseBlock()");
    const open = this.expect(TokenType.OPEN_BLOCK, "Block must start with OPEN_BLOCK '{'");
    const list = this.parseStatementList();
    const close = this.expect(TokenType.CLOSE_BLOCK, "expected CLOSE_BLOCK '}' to finish Block before the next token");
    const children: CstNode[] = [];
    if (open !== null) {
      children.push(terminal(open));
    }
    children.push(list);
    if (close !== null) {
      children.push(terminal(close));
    }
    return nonTerminal("Block", children);
  }

  // --- StatementList ::= Statement StatementList | epsilon ---

  private parseStatementList(): CstNonTerminal {
    this.log.debug("parseStatementList()");
    const next = this.cursor.peek();

    if (next?.type === TokenType.CLOSE_BLOCK) {
      return nonTerminal("Statement List", []);
    }

    if (next === undefined) {
      this.reportError(
        1,
        1,
        "expected CLOSE_BLOCK '}' or the start of a Statement inside Block, but reached end of input. " +
          "Close every '{' with a matching '}' and end the program with '$'."
      );
      return nonTerminal("Statement List", []);
    }

    if (next.type === TokenType.EOP) {
      this.reportError(
        next.position.line,
        next.position.column,
        `expected CLOSE_BLOCK '}' or a Statement before EOP '$' (still inside a Block). ` +
          "Add the missing '}' or complete the statement list before ending the program with '$'."
      );
      return nonTerminal("Statement List", []);
    }

    const stmt = this.parseStatement();
    const rest = this.parseStatementList();
    return nonTerminal("Statement List", [stmt, rest]);
  }

  // --- Statement dispatch (Step 2: Block; Steps 3–4: print, assign, decl, while, if) ---

  private parseStatement(): CstNonTerminal {
    this.log.debug("parseStatement()");
    const t = this.cursor.peek();
    if (t === undefined) {
      this.reportError(
        1,
        1,
        "expected a Statement but reached end of token stream inside Block — add a statement or '}'."
      );
      return nonTerminal("Statement", []);
    }

    if (t.type === TokenType.OPEN_BLOCK) {
      return nonTerminal("Statement", [this.parseBlock()]);
    }

    if (
      t.type === TokenType.PRINT ||
      t.type === TokenType.WHILE ||
      t.type === TokenType.IF ||
      t.type === TokenType.I_TYPE ||
      t.type === TokenType.ID
    ) {
      return this.parseStatementNotImplemented(t);
    }

    this.reportError(
      t.position.line,
      t.position.column,
      `Illegal start of Statement: ${describeGot(t)}. ` +
        "A Statement must begin with '{', 'print', 'while', 'if', a type keyword (int|string|boolean), or a one-letter identifier for assignment. " +
        "Fix the spelling, insert a missing '{', or remove stray tokens."
    );
    this.cursor.consume();
    return nonTerminal("Statement", []);
  }

  /** Grammar productions not yet implemented; explicit stubs preserve the dispatch shape for later steps. */
  private parseStatementNotImplemented(t: Token): CstNonTerminal {
    this.log.debug(
      t.type === TokenType.PRINT
        ? "parsePrintStatement()"
        : t.type === TokenType.WHILE
          ? "parseWhileStatement()"
          : t.type === TokenType.IF
            ? "parseIfStatement()"
            : t.type === TokenType.I_TYPE
              ? "parseVarDecl()"
              : "parseAssignmentStatement()"
    );
    this.reportError(
      t.position.line,
      t.position.column,
      `Parser Step 2 scope: ${describeGot(t)} is not parsed yet (PrintStatement, VarDecl, AssignmentStatement, WhileStatement, and IfStatement come in Steps 3–4). ` +
        "Until then, use nested `{ ... }` blocks for statements."
    );
    this.cursor.consume();
    return nonTerminal("Statement", []);
  }

  // --- expect / reporting ---

  private expect(type: TokenType, reason: string): Token | null {
    const next = this.cursor.peek();
    if (next === undefined) {
      this.reportError(
        1,
        1,
        `Missing ${describeExpected(type)}: ${reason}. Reached end of token stream — the lexer should supply a token here; check for truncated input.`
      );
      return null;
    }
    if (next.type !== type) {
      this.reportError(
        next.position.line,
        next.position.column,
        `Expected ${describeExpected(type)}, but found ${describeGot(next)}. ${reason}.`
      );
      return null;
    }
    return this.cursor.consume();
  }

  private reportError(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      line,
      column,
      message
    });
    this.log.errorLine(line, column, message);
  }
}
