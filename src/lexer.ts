import { Token, TokenType } from "./tokens";

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
    let currentProgram = 0;
    let inProgram = false;

    // The if statements correspond to the grammar rules
    while (!this.isAtEnd()) {
      const current = this.peek();
      const position = this.currentPosition();

      if (this.isWhitespace(current)) {
        this.consumeWhitespace();
        continue;
      }

      if (!inProgram) {
        currentProgram += 1;
        inProgram = true;
        console.log(`INFO  Lexer - Lexing program ${currentProgram}...`);
      }

      if (current === "{") {
        tokens.push(this.createToken(TokenType.OPEN_BLOCK, this.advance(), position));
        this.column += 1;
        this.debugToken(TokenType.OPEN_BLOCK, "{", position.line, position.column);
        continue;
      }

      if (current === "}") {
        tokens.push(this.createToken(TokenType.CLOSE_BLOCK, this.advance(), position));
        this.column += 1;
        this.debugToken(TokenType.CLOSE_BLOCK, "}", position.line, position.column);
        continue;
      }

      if (current === "$") {
        tokens.push(this.createToken(TokenType.EOP, this.advance(), position));
        this.column += 1;
        this.debugToken(TokenType.EOP, "$", position.line, position.column);
        console.log("INFO  Lexer - Lex completed with 0 errors");
        inProgram = false;
        continue;
      }

      if (current === "/" && this.peekNext() === "*") {
        const commentStart = this.currentPosition();
        const terminated = this.consumeCommentBlock();

        if (!terminated) {
          this.warn(
            commentStart.line,
            commentStart.column,
            "Unterminated comment block. Reached end of input before finding closing '*/'. Add '*/' to end the comment."
          );
        }

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

  // Looks at the current character without increasing the index
  private peek(): string {
    return this.source[this.index] ?? "\0";// Prevents index out of bounds error
  }

  // Looks at the next character without increasing the index
  private peekNext(): string {
    return this.source[this.index + 1] ?? "\0";
  }

  // Consumes the current character and increases the index
  private advance(): string {
    const char = this.source[this.index] ?? "\0";// Same as peek when it did \0
    this.index += 1;
    return char;
  }

  // Checks if the character is whitespace
  private isWhitespace(char: string): boolean {
    return char === " " || char === "\t" || char === "\r" || char === "\n";
  }

  // Uses advance function to consume whitespace
  private consumeWhitespace(): void {
    const char = this.advance();
    this.updatePositionAfterConsume(char);
  }

  // Returns the current position of the lexer
  private currentPosition(): { line: number; column: number; index: number } {
    return { line: this.line, column: this.column, index: this.index };
  }

  // Creates a token
  private createToken(
    type: TokenType,
    lexeme: string,
    position: { line: number; column: number; index: number }
  ): Token {
    return {
      type,
      lexeme,
      position
    };
  }

  // Debugs a token if debug mode is enabled
  private debugToken(type: TokenType, lexeme: string, line: number, column: number): void {
    if (!this.debug) {
      return;
    }

    console.log(`DEBUG Lexer - ${type} '${lexeme}' found at (${line}:${column})`);
  }

  // Consumes a comment block
  private consumeCommentBlock(): boolean {
    this.updatePositionAfterConsume(this.advance()); // /
    this.updatePositionAfterConsume(this.advance()); // *

    while (!this.isAtEnd()) {
      const char = this.advance();
      this.updatePositionAfterConsume(char);

      if (char === "*" && this.peek() === "/") {
        this.updatePositionAfterConsume(this.advance()); // /
        return true;
      }
    }

    return false;
  }

  // Updates the line and column after consuming a character
  private updatePositionAfterConsume(char: string): void {
    if (char === "\n") {
      this.line += 1;
      this.column = 1;
      return;
    }

    this.column += 1;
  }

  // Sends warnings to the console
  private warn(line: number, column: number, message: string): void {
    console.log(`WARN  Lexer - Warning:${line}:${column} ${message}`);
  }
}
