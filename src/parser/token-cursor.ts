import type { Token } from "../lexer/tokens";

/**
 * Sequential access over one program's token list (including trailing EOP).
 * The parser never backtracks across alternative arms in this assignment; a single index suffices.
 */
export class TokenCursor {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

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
