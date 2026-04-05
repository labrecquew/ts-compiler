import type { SourcePosition, Token } from "../lexer/tokens";

/**
 * Sequential access over one program's token list (including trailing EOP).
 * The parser never backtracks across alternative arms in this assignment; a single index suffices.
 */
export class TokenCursor {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  /**
   * Best position for diagnostics when the next token is missing (EOF): prefer current peek, else last consumed token, else (1,1).
   */
  errorAnchor(): SourcePosition {
    const next = this.tokens[this.index];
    if (next !== undefined) {
      return next.position;
    }
    if (this.index > 0) {
      const prev = this.tokens[this.index - 1]!;
      return prev.position;
    }
    return { line: 1, column: 1, index: 0 };
  }

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  peekKindAt(offset: number): string | undefined {
    return this.tokens[this.index + offset]?.type;
  }

  consume(): Token {
    const token = this.tokens[this.index];
    if (token === undefined) {
      throw new Error("TokenCursor.consume past end — parser should call isAtEnd first");
    }
    this.index += 1;
    return token;
  }

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  get position(): number {
    return this.index;
  }
}
