import type { Token } from "../lexer/tokens";
import { TokenType } from "../lexer/tokens";
import { DiagnosticSeverity, type Diagnostic } from "./diagnostics";
import { ParserLogger } from "./parser-logger";
import { printProgramCst, Tree } from "./tree";
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
  [TokenType.EQUALITY_OP]: "EQUALITY_OP '=='",
  [TokenType.INEQUALITY_OP]: "INEQUALITY_OP '!='",
  [TokenType.INT_OP]: "INT_OP '+'",
  [TokenType.PRINT]: "PRINT 'print'",
  [TokenType.WHILE]: "WHILE 'while'",
  [TokenType.IF]: "IF 'if'",
  [TokenType.I_TYPE]: "type keyword (int|string|boolean)",
  [TokenType.ID]: "identifier (single lowercase letter)",
  [TokenType.DIGIT]: "DIGIT",
  [TokenType.QUOTE]: "QUOTE '\"'",
  [TokenType.CHAR]: "CHAR",
  [TokenType.SPACE]: "SPACE",
  [TokenType.BOOL_TRUE]: "BOOL_TRUE 'true'",
  [TokenType.BOOL_FALSE]: "BOOL_FALSE 'false'"
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

function isBoolOp(
  t: Token | undefined
): t is Token & { type: TokenType.EQUALITY_OP | TokenType.INEQUALITY_OP } {
  return t !== undefined && (t.type === TokenType.EQUALITY_OP || t.type === TokenType.INEQUALITY_OP);
}

/**
 * Recursive-descent parser aligned with cursor-only/grammar.md.
 * Builds the CST with the Labouseur Tree API (`addNode` / `endChild`ren) during the walk.
 */
export class Parser {
  private readonly cursor: TokenCursor;
  private readonly log: ParserLogger;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly tree = new Tree();

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
    this.parseProgram();

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
    this.emitNonErrorDiagnosticsSummary();
    printProgramCst(this.programNumber, this.tree);
  }

  private emitNonErrorDiagnosticsSummary(): void {
    const warns = this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Warning).length;
    const hints = this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Hint).length;
    if (warns > 0) {
      this.log.info(`Parser reported ${warns} warning(s) (non-fatal).`);
    }
    if (hints > 0) {
      this.log.info(`Parser reported ${hints} hint(s).`);
    }
  }

  private addTerminalLeaf(tok: Token): void {
    this.tree.addNode(tok.lexeme, "leaf");
  }

  // --- Program ::= Block $ ---

  private parseProgram(): void {
    this.log.debug("parseProgram()");
    this.tree.addNode("Program", "branch");
    this.parseBlock();
    const eop = this.expect(TokenType.EOP, "Program requires end-of-program marker '$' after Block");
    if (eop !== null) {
      this.addTerminalLeaf(eop);
    }
    this.tree.endChildren();
  }

  // --- Block ::= { StatementList } ---

  private parseBlock(): void {
    this.log.debug("parseBlock()");
    this.tree.addNode("Block", "branch");
    const open = this.expect(TokenType.OPEN_BLOCK, "Block must start with OPEN_BLOCK '{'");
    if (open !== null) {
      this.addTerminalLeaf(open);
    }
    this.parseStatementList();
    const close = this.expect(TokenType.CLOSE_BLOCK, "expected CLOSE_BLOCK '}' to finish Block before the next token");
    if (close !== null) {
      this.addTerminalLeaf(close);
    }
    this.tree.endChildren();
  }

  // --- StatementList ::= Statement StatementList | epsilon ---

  private parseStatementList(): void {
    this.log.debug("parseStatementList()");
    const next = this.cursor.peek();

    this.tree.addNode("Statement List", "branch");

    if (next?.type === TokenType.CLOSE_BLOCK) {
      this.tree.endChildren();
      return;
    }

    if (next === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        "expected CLOSE_BLOCK '}' or the start of a Statement inside Block, but reached end of input. " +
          "Close every '{' with a matching '}' and end the program with '$'."
      );
      this.tree.endChildren();
      return;
    }

    if (next.type === TokenType.EOP) {
      this.reportError(
        next.position.line,
        next.position.column,
        `expected CLOSE_BLOCK '}' or a Statement before EOP '$' (still inside a Block). ` +
          "Add the missing '}' or complete the statement list before ending the program with '$'."
      );
      this.tree.endChildren();
      return;
    }

    this.parseStatement();
    this.parseStatementList();
    this.tree.endChildren();
  }

  // --- Statement ---

  private parseStatement(): void {
    this.log.debug("parseStatement()");
    const t = this.cursor.peek();
    this.tree.addNode("Statement", "branch");

    if (t === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        "expected a Statement but reached end of token stream inside Block — add a statement or '}'."
      );
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.OPEN_BLOCK) {
      this.parseBlock();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.PRINT) {
      this.parsePrintStatement();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.WHILE) {
      this.parseWhileStatement();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.IF) {
      this.parseIfStatement();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.I_TYPE) {
      this.parseVarDecl();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.ID) {
      this.parseAssignmentStatement();
      this.tree.endChildren();
      return;
    }

    this.reportError(
      t.position.line,
      t.position.column,
      `Illegal start of Statement: ${describeGot(t)}. ` +
        "A Statement must begin with '{', 'print', 'while', 'if', a type keyword (int|string|boolean), or a one-letter identifier for assignment. " +
        "Fix the spelling, insert a missing '{', or remove stray tokens."
    );
    this.cursor.consume();
    this.tree.endChildren();
  }

  // --- PrintStatement ::= print ( Expr ) ---

  private parsePrintStatement(): void {
    this.log.debug("parsePrintStatement()");
    this.tree.addNode("Print Statement", "branch");
    const print = this.expect(TokenType.PRINT, "PrintStatement must begin with 'print'");
    if (print !== null) {
      this.addTerminalLeaf(print);
    }
    const open = this.expect(TokenType.OPEN_PAREN, "PrintStatement requires '(' after 'print'");
    if (open !== null) {
      this.addTerminalLeaf(open);
    }
    if (open !== null) {
      this.parseExpr("PrintStatement");
    } else {
      this.tree.addNode("Expr", "branch");
      this.tree.endChildren();
    }
    const close = this.expect(TokenType.CLOSE_PAREN, "PrintStatement requires ')' after the expression");
    if (close !== null) {
      this.addTerminalLeaf(close);
    }
    this.tree.endChildren();
  }

  // --- AssignmentStatement ::= Id = Expr ---

  private parseAssignmentStatement(): void {
    this.log.debug("parseAssignmentStatement()");
    this.tree.addNode("Assignment Statement", "branch");
    this.parseId();
    const afterId = this.cursor.peek();
    if (afterId?.type === TokenType.EQUALITY_OP) {
      this.reportWarning(
        afterId.position.line,
        afterId.position.column,
        "Found '==' where a single '=' assignment was expected. Replace '==' with '=' to assign, or split this into a boolean expression in a different context."
      );
    }
    const eq = this.expect(
      TokenType.ASSIGN_OP,
      "AssignmentStatement requires ASSIGN_OP '=' after Id (use a single '=', not '==')"
    );
    if (eq !== null) {
      this.addTerminalLeaf(eq);
    }
    if (eq !== null) {
      this.parseExpr("AssignmentStatement");
    } else {
      this.tree.addNode("Expr", "branch");
      this.tree.endChildren();
    }
    this.tree.endChildren();
  }

  // --- VarDecl ::= type Id ---

  private parseVarDecl(): void {
    this.log.debug("parseVarDecl()");
    this.tree.addNode("Var Decl", "branch");
    const ty = this.expect(TokenType.I_TYPE, "VarDecl must begin with type (int|string|boolean)");
    if (ty !== null) {
      this.addTerminalLeaf(ty);
    }
    this.parseId();
    this.tree.endChildren();
  }

  // --- WhileStatement ::= while BooleanExpr Block ---

  private parseWhileStatement(): void {
    this.log.debug("parseWhileStatement()");
    this.tree.addNode("While Statement", "branch");
    const kw = this.expect(TokenType.WHILE, "WhileStatement must begin with 'while'");
    if (kw !== null) {
      this.addTerminalLeaf(kw);
    }
    this.parseBooleanExpr("WhileStatement condition");
    this.parseBlock();
    this.tree.endChildren();
  }

  // --- IfStatement ::= if BooleanExpr Block ---

  private parseIfStatement(): void {
    this.log.debug("parseIfStatement()");
    this.tree.addNode("If Statement", "branch");
    const kw = this.expect(TokenType.IF, "IfStatement must begin with 'if'");
    if (kw !== null) {
      this.addTerminalLeaf(kw);
    }
    this.parseBooleanExpr("IfStatement condition");
    this.parseBlock();
    this.tree.endChildren();
  }

  // --- Id ::= char (lexer: ID) ---

  private parseId(): void {
    this.log.debug("parseId()");
    this.tree.addNode("Id", "branch");
    const idTok = this.expect(TokenType.ID, "Id must be a single lowercase letter identifier");
    if (idTok !== null) {
      this.addTerminalLeaf(idTok);
    }
    this.tree.endChildren();
  }

  // --- Expr ::= IntExpr | StringExpr | BooleanExpr | Id ---

  private parseExpr(context: string): void {
    this.log.debug("parseExpr()");
    const t = this.cursor.peek();
    this.tree.addNode("Expr", "branch");

    if (t === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        `Missing expression in ${context}: reached end of input. The grammar expects an Expr (digit/string/boolean/identifier or parenthesized boolean).`
      );
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.DIGIT) {
      this.parseIntExpr();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.QUOTE) {
      this.parseStringExpr();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.OPEN_PAREN) {
      this.parseBooleanExprParenthesized();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.BOOL_TRUE || t.type === TokenType.BOOL_FALSE) {
      this.parseBooleanExprBoolVal();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.ID) {
      this.parseId();
      this.tree.endChildren();
      return;
    }

    this.reportError(
      t.position.line,
      t.position.column,
      `Illegal start of Expr in ${context}: ${describeGot(t)}. ` +
        "An Expr may begin with a digit, '\"', '(', 'true'/'false', or an identifier."
    );
    this.tree.endChildren();
  }

  // --- IntExpr ::= digit intop Expr | digit ---

  private parseIntExpr(): void {
    this.log.debug("parseIntExpr()");
    this.tree.addNode("Int Expr", "branch");
    const d = this.expect(TokenType.DIGIT, "IntExpr must start with a digit token");
    if (d !== null) {
      this.addTerminalLeaf(d);
    }
    const next = this.cursor.peek();
    if (next?.type === TokenType.INT_OP) {
      const plus = this.cursor.consume();
      this.addTerminalLeaf(plus);
      this.parseExpr("IntExpr after '+'");
    }
    this.tree.endChildren();
  }

  // --- StringExpr ::= " CharList " ---

  private parseStringExpr(): void {
    this.log.debug("parseStringExpr()");
    this.tree.addNode("String Expr", "branch");
    const open = this.expect(TokenType.QUOTE, "StringExpr must start with '\"'");
    if (open !== null) {
      if (this.cursor.peek()?.type === TokenType.QUOTE) {
        this.reportHint(
          open.position.line,
          open.position.column,
          'Empty string literal (""). This is valid in the grammar; confirm it is intentional.'
        );
      }
      this.addTerminalLeaf(open);
    }
    this.parseCharList();
    const close = this.expect(TokenType.QUOTE, "StringExpr must end with closing '\"'");
    if (close !== null) {
      this.addTerminalLeaf(close);
    }
    this.tree.endChildren();
  }

  // --- CharList ::= char CharList | space CharList | epsilon ---

  private parseCharList(): void {
    this.log.debug("parseCharList()");
    const t = this.cursor.peek();
    this.tree.addNode("Char List", "branch");

    if (t === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        "Unterminated string: reached end of input before closing '\"'. Add the missing quote."
      );
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.QUOTE) {
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.CHAR) {
      const ch = this.cursor.consume();
      this.tree.addNode(ch.lexeme, "leaf");
      this.parseCharList();
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.SPACE) {
      const sp = this.cursor.consume();
      this.tree.addNode(sp.lexeme, "leaf");
      this.parseCharList();
      this.tree.endChildren();
      return;
    }

    this.reportError(
      t.position.line,
      t.position.column,
      `Invalid character inside string CharList: ${describeGot(t)}. ` +
        "Only lowercase letters and spaces are allowed between quotes in this grammar."
    );
    this.cursor.consume();
    this.tree.endChildren();
  }

  // --- BooleanExpr ::= ( Expr boolop Expr ) | boolval ---

  private parseBooleanExpr(context: string): void {
    this.log.debug("parseBooleanExpr()");
    const t = this.cursor.peek();

    if (t === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        `Missing BooleanExpr for ${context}: expected 'true', 'false', or '(' starting a comparison, but reached end of input.`
      );
      this.tree.addNode("Boolean Expr", "branch");
      this.tree.endChildren();
      return;
    }

    if (t.type === TokenType.BOOL_TRUE || t.type === TokenType.BOOL_FALSE) {
      this.parseBooleanExprBoolVal();
      return;
    }

    if (t.type === TokenType.OPEN_PAREN) {
      this.parseBooleanExprParenthesized();
      return;
    }

    this.reportError(
      t.position.line,
      t.position.column,
      `Illegal start of BooleanExpr for ${context}: ${describeGot(t)}. ` +
        "The grammar allows only boolval ('true'|'false') or '( Expr boolop Expr )' — not a bare identifier or digit."
    );
    this.tree.addNode("Boolean Expr", "branch");
    this.tree.endChildren();
  }

  private parseBooleanExprBoolVal(): void {
    this.log.debug("parseBooleanExprBoolVal()");
    this.tree.addNode("Boolean Expr", "branch");
    const t = this.cursor.peek();
    if (t?.type === TokenType.BOOL_TRUE || t?.type === TokenType.BOOL_FALSE) {
      this.addTerminalLeaf(this.cursor.consume());
    } else {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        "BooleanExpr boolval requires 'true' or 'false' — add a boolean literal."
      );
    }
    this.tree.endChildren();
  }

  private parseBooleanExprParenthesized(): void {
    this.log.debug("parseBooleanExprParenthesized()");
    this.tree.addNode("Boolean Expr", "branch");
    const open = this.expect(TokenType.OPEN_PAREN, "parenthesized BooleanExpr must start with '('");
    if (open !== null) {
      this.addTerminalLeaf(open);
    }
    this.parseExpr("boolean comparison (left)");
    const opPeek = this.cursor.peek();
    if (!isBoolOp(opPeek)) {
      const pos = opPeek === undefined ? this.cursor.errorAnchor() : opPeek.position;
      this.reportError(
        pos.line,
        pos.column,
        opPeek === undefined
          ? "Missing boolop ('==' or '!=') after left Expr in BooleanExpr — comparisons must use == or !=."
          : `Expected boolop ('==' or '!=') after left Expr in BooleanExpr, found ${describeGot(opPeek)}. ` +
              "Insert == or != between the two expressions."
      );
      this.tree.endChildren();
      return;
    }
    const op = this.cursor.consume();
    this.addTerminalLeaf(op);
    this.parseExpr("boolean comparison (right)");
    const close = this.expect(
      TokenType.CLOSE_PAREN,
      "parenthesized BooleanExpr must end with ')' after the right-hand Expr"
    );
    if (close !== null) {
      this.addTerminalLeaf(close);
    }
    this.tree.endChildren();
  }

  // --- expect / reporting ---

  private expect(type: TokenType, reason: string): Token | null {
    const next = this.cursor.peek();
    if (next === undefined) {
      const pos = this.cursor.errorAnchor();
      this.reportError(
        pos.line,
        pos.column,
        `Missing ${describeExpected(type)}: ${reason}. Reached end of token stream — add the missing token or complete the construct.`
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

  private reportWarning(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      line,
      column,
      message
    });
    this.log.warnLine(line, column, message);
  }

  private reportHint(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Hint,
      line,
      column,
      message
    });
    this.log.hintLine(line, column, message);
  }
}
