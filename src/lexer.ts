import { Token } from "./tokens";

// Allows optional debug mode
interface LexerOptions {
  debug?: boolean;
}

export class Lexer {
  private readonly source: string;
  private readonly debug: boolean;
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(source: string, options: LexerOptions = {}) {
    this.source = source;
    this.debug = options.debug ?? true;
  }

  // Main lexing function, the actual lexing happens here using the helper functions below
  public lex(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const current = this.peek();

      if (current === "\n") {
        this.advance();
        this.line += 1;
        this.column = 1;
        continue;
      }

      this.advance();
      this.column += 1;
    }

    return tokens;
  }

  // Checks if the lexer is at the end, helps lexing function loop
  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  // Looks at the next character without increasing the index
  private peek(): string {
    return this.source[this.index] ?? "\0";// Prevents index out of bounds error
  }

  //Consumes the next character and increases the index
  private advance(): string {
    const char = this.source[this.index] ?? "\0";// Same as peek when it did \0
    this.index += 1;
    return char;
  }
}
