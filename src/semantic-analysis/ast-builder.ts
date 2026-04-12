import { TokenType, type Token } from "../lexer/tokens";
import { TokenCursor } from "../parser/token-cursor";
import type { LanguageType } from "./language-type";
import type {
  AssignAst,
  AstRoot,
  BlockAst,
  BlockMember,
  BoolLiteralExpr,
  BooleanBinaryExpr,
  ExprAst,
  IdExpr,
  IfAst,
  IntLiteralExpr,
  PrintAst,
  StringLiteralExpr,
  VarDeclAst,
  WhileAst
} from "./ast-nodes";
import type { SemanticLogger } from "./semantic-logger";

/**
 * Phase A: rebuild structure from `Token[]` after a successful parse.
 * Assumes tokens match the grammar; mismatches throw (internal bug / desync).
 */
export function buildAstFromTokens(tokens: readonly Token[], log: SemanticLogger): AstRoot {
  const cursor = new TokenCursor(tokens);
  const builder = new AstBuilder(cursor, log);
  const block = builder.buildProgram();
  log.debug("AST build: consumed program block and verified EOP");
  return block;
}

class AstBuilder {
  constructor(
    private readonly cursor: TokenCursor,
    private readonly log: SemanticLogger
  ) {}

  /** Entry: `Program ::= Block $` */
  buildProgram(): BlockAst {
    this.log.debug("AST build: parse program (Block $)");
    const block = this.parseBlock();
    this.expect(TokenType.EOP, "Program must end with EOP '$'");
    return block;
  }

  private parseBlock(): BlockAst {
    this.log.debug("AST build: enter Block");
    this.expect(TokenType.OPEN_BLOCK, "Block must start with '{'");
    const members: BlockMember[] = [];
    while (this.cursor.peek()?.type !== TokenType.CLOSE_BLOCK) {
      if (this.cursor.peek() === undefined) {
        throw this.unexpected("end of input inside Block (expected statement or '}')");
      }
      members.push(this.parseBlockMember());
    }
    this.expect(TokenType.CLOSE_BLOCK, "Block must end with '}'");
    this.log.debug("AST build: exit Block");
    return { kind: "Block", members };
  }

  private parseBlockMember(): BlockMember {
    const t = this.cursor.peek()!;

    if (t.type === TokenType.OPEN_BLOCK) {
      return this.parseBlock();
    }
    if (t.type === TokenType.PRINT) {
      return this.parsePrint();
    }
    if (t.type === TokenType.WHILE) {
      return this.parseWhile();
    }
    if (t.type === TokenType.IF) {
      return this.parseIf();
    }
    if (t.type === TokenType.I_TYPE) {
      return this.parseVarDecl();
    }
    if (t.type === TokenType.ID) {
      return this.parseAssign();
    }

    throw this.unexpected(`illegal start of statement: ${t.type} ${JSON.stringify(t.lexeme)}`);
  }

  private parseVarDecl(): VarDeclAst {
    this.log.debug("AST build: VarDecl");
    const ty = this.expect(TokenType.I_TYPE, "VarDecl expects type keyword");
    const id = this.expect(TokenType.ID, "VarDecl expects identifier");
    return {
      kind: "VarDecl",
      varType: lexemeToLanguageType(ty),
      name: id.lexeme,
      namePosition: id.position
    };
  }

  private parseAssign(): AssignAst {
    this.log.debug("AST build: Assign");
    const id = this.expect(TokenType.ID, "Assignment expects identifier");
    this.expect(TokenType.ASSIGN_OP, "Assignment expects '='");
    const value = this.parseExpr();
    return {
      kind: "Assign",
      target: id.lexeme,
      targetPosition: id.position,
      value
    };
  }

  private parsePrint(): PrintAst {
    this.log.debug("AST build: Print");
    this.expect(TokenType.PRINT, "print statement");
    this.expect(TokenType.OPEN_PAREN, "'(' after print");
    const argument = this.parseExpr();
    this.expect(TokenType.CLOSE_PAREN, "')' after print expression");
    return { kind: "Print", argument };
  }

  private parseWhile(): WhileAst {
    this.log.debug("AST build: While");
    this.expect(TokenType.WHILE, "while");
    const condition = this.parseBooleanExpr();
    const body = this.parseBlock();
    return { kind: "While", condition, body };
  }

  private parseIf(): IfAst {
    this.log.debug("AST build: If");
    this.expect(TokenType.IF, "if");
    const condition = this.parseBooleanExpr();
    const body = this.parseBlock();
    return { kind: "If", condition, body };
  }

  private parseBooleanExpr(): ExprAst {
    const t = this.cursor.peek();
    if (t === undefined) {
      throw this.unexpected("missing boolean expression");
    }
    if (t.type === TokenType.BOOL_TRUE || t.type === TokenType.BOOL_FALSE) {
      return this.parseBoolLiteral();
    }
    if (t.type === TokenType.OPEN_PAREN) {
      return this.parseParenthesizedBooleanExpr();
    }
    throw this.unexpected(
      `boolean expression must be true/false or '(', got ${t.type} ${JSON.stringify(t.lexeme)}`
    );
  }

  private parseBoolLiteral(): BoolLiteralExpr {
    const t = this.cursor.consume();
    if (t.type !== TokenType.BOOL_TRUE && t.type !== TokenType.BOOL_FALSE) {
      throw this.unexpected("expected boolean literal");
    }
    return {
      kind: "BoolLiteral",
      value: t.type === TokenType.BOOL_TRUE,
      position: t.position
    };
  }

  private parseParenthesizedBooleanExpr(): BooleanBinaryExpr {
    this.expect(TokenType.OPEN_PAREN, "'('");
    const left = this.parseExpr();
    const opTok = this.cursor.peek();
    if (
      opTok === undefined ||
      (opTok.type !== TokenType.EQUALITY_OP && opTok.type !== TokenType.INEQUALITY_OP)
    ) {
      throw this.unexpected("expected '==' or '!=' in boolean comparison");
    }
    this.cursor.consume();
    const operator = opTok.type === TokenType.EQUALITY_OP ? "==" : "!=";
    const right = this.parseExpr();
    this.expect(TokenType.CLOSE_PAREN, "')'");
    return {
      kind: "BooleanBinary",
      operator,
      left,
      right,
      position: opTok.position
    };
  }

  private parseExpr(): ExprAst {
    const t = this.cursor.peek();
    if (t === undefined) {
      throw this.unexpected("missing expression");
    }

    if (t.type === TokenType.DIGIT) {
      return this.parseIntExpr();
    }
    if (t.type === TokenType.QUOTE) {
      return this.parseStringExpr();
    }
    if (t.type === TokenType.OPEN_PAREN) {
      return this.parseParenthesizedBooleanExpr();
    }
    if (t.type === TokenType.BOOL_TRUE || t.type === TokenType.BOOL_FALSE) {
      return this.parseBoolLiteral();
    }
    if (t.type === TokenType.ID) {
      return this.parseIdExpr();
    }

    throw this.unexpected(`illegal start of expression: ${t.type} ${JSON.stringify(t.lexeme)}`);
  }

  private parseIntExpr(): ExprAst {
    const d = this.expect(TokenType.DIGIT, "digit");
    const first: IntLiteralExpr = {
      kind: "IntLiteral",
      value: Number(d.lexeme),
      position: d.position
    };
    const next = this.cursor.peek();
    if (next?.type === TokenType.INT_OP) {
      this.cursor.consume();
      const right = this.parseExpr();
      return { kind: "IntAdd", left: first, right, position: d.position };
    }
    return first;
  }

  private parseStringExpr(): StringLiteralExpr {
    const open = this.expect(TokenType.QUOTE, "opening '\"'");
    let inner = "";
    for (;;) {
      const t = this.cursor.peek();
      if (t === undefined) {
        throw this.unexpected("unterminated string");
      }
      if (t.type === TokenType.QUOTE) {
        break;
      }
      if (t.type === TokenType.CHAR || t.type === TokenType.SPACE) {
        inner += this.cursor.consume().lexeme;
        continue;
      }
      throw this.unexpected(`invalid character in string: ${t.type}`);
    }
    this.expect(TokenType.QUOTE, "closing '\"'");
    return { kind: "StringLiteral", value: inner, position: open.position };
  }

  private parseIdExpr(): IdExpr {
    const id = this.expect(TokenType.ID, "identifier");
    return { kind: "Id", name: id.lexeme, position: id.position };
  }

  private expect(type: TokenType, ctx: string): Token {
    const next = this.cursor.peek();
    if (next === undefined) {
      throw this.unexpected(`missing token for ${ctx}`);
    }
    if (next.type !== type) {
      throw this.unexpected(`expected ${type} for ${ctx}, got ${next.type} ${JSON.stringify(next.lexeme)}`);
    }
    return this.cursor.consume();
  }

  private unexpected(message: string): Error {
    return new Error(`AST build: ${message}`);
  }
}

function lexemeToLanguageType(tok: Token): LanguageType {
  const m = tok.lexeme;
  if (m === "int" || m === "string" || m === "boolean") {
    return m;
  }
  throw new Error(`AST build: unknown type lexeme ${JSON.stringify(m)}`);
}
