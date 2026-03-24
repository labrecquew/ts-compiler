import { Token, TokenType } from "./tokens";

// Allows optional debug mode
interface LexerOptions {
  debug?: boolean;
}

// High-level token scan states used by the primary DFA.
enum StartState {
  START = "START",
  ACCEPT_OPEN_BLOCK = "ACCEPT_OPEN_BLOCK",
  ACCEPT_CLOSE_BLOCK = "ACCEPT_CLOSE_BLOCK",
  ACCEPT_EOP = "ACCEPT_EOP",
  POSSIBLE_COMMENT = "POSSIBLE_COMMENT",
  POSSIBLE_WORD = "POSSIBLE_WORD",
  SKIP = "SKIP"
}

// Dedicated DFA states for scanning block comments.
enum CommentState {
  EXPECT_STAR = "EXPECT_STAR",
  IN_COMMENT = "IN_COMMENT",
  POSSIBLE_END = "POSSIBLE_END",
  TERMINATED = "TERMINATED",
  UNTERMINATED = "UNTERMINATED",
  NOT_A_COMMENT = "NOT_A_COMMENT"
}

// Dedicated DFA states for scanning contiguous lowercase words.
enum WordState {
  START = "START",
  IN_WORD = "IN_WORD",
  ACCEPT = "ACCEPT"
}

// Input alphabet classes consumed by DFA tables.
enum CharClass {
  OPEN_BLOCK = "OPEN_BLOCK",
  CLOSE_BLOCK = "CLOSE_BLOCK",
  EOP = "EOP",
  SLASH = "SLASH",
  STAR = "STAR",
  LETTER = "LETTER",
  WHITESPACE = "WHITESPACE",
  OTHER = "OTHER",
  EOF = "EOF"
}

// Main token-dispatch DFA: classifies one char and routes to an accept/skip/comment state.
const START_TRANSITION_TABLE: Record<StartState, Partial<Record<CharClass, StartState>>> = {
  [StartState.START]: {
    [CharClass.OPEN_BLOCK]: StartState.ACCEPT_OPEN_BLOCK,
    [CharClass.CLOSE_BLOCK]: StartState.ACCEPT_CLOSE_BLOCK,
    [CharClass.EOP]: StartState.ACCEPT_EOP,
    [CharClass.SLASH]: StartState.POSSIBLE_COMMENT,
    [CharClass.LETTER]: StartState.POSSIBLE_WORD,
    [CharClass.WHITESPACE]: StartState.SKIP,
    [CharClass.OTHER]: StartState.SKIP,
    [CharClass.STAR]: StartState.SKIP,
    [CharClass.EOF]: StartState.SKIP
  },
  [StartState.ACCEPT_OPEN_BLOCK]: {},
  [StartState.ACCEPT_CLOSE_BLOCK]: {},
  [StartState.ACCEPT_EOP]: {},
  [StartState.POSSIBLE_COMMENT]: {},
  [StartState.POSSIBLE_WORD]: {},
  [StartState.SKIP]: {}
};

// Comment DFA: validates and consumes /* ... */ including multi-line comments.
const COMMENT_TRANSITION_TABLE: Record<CommentState, Partial<Record<CharClass, CommentState>>> = {
  [CommentState.EXPECT_STAR]: {
    [CharClass.STAR]: CommentState.IN_COMMENT,
    [CharClass.EOF]: CommentState.UNTERMINATED,
    [CharClass.OPEN_BLOCK]: CommentState.NOT_A_COMMENT,
    [CharClass.CLOSE_BLOCK]: CommentState.NOT_A_COMMENT,
    [CharClass.EOP]: CommentState.NOT_A_COMMENT,
    [CharClass.SLASH]: CommentState.NOT_A_COMMENT,
    [CharClass.WHITESPACE]: CommentState.NOT_A_COMMENT,
    [CharClass.LETTER]: CommentState.NOT_A_COMMENT,
    [CharClass.OTHER]: CommentState.NOT_A_COMMENT
  },
  [CommentState.IN_COMMENT]: {
    [CharClass.EOF]: CommentState.UNTERMINATED,
    [CharClass.STAR]: CommentState.POSSIBLE_END,
    [CharClass.OPEN_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.CLOSE_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.EOP]: CommentState.IN_COMMENT,
    [CharClass.SLASH]: CommentState.IN_COMMENT,
    [CharClass.WHITESPACE]: CommentState.IN_COMMENT,
    [CharClass.LETTER]: CommentState.IN_COMMENT,
    [CharClass.OTHER]: CommentState.IN_COMMENT
  },
  [CommentState.POSSIBLE_END]: {
    [CharClass.EOF]: CommentState.UNTERMINATED,
    [CharClass.SLASH]: CommentState.TERMINATED,
    [CharClass.STAR]: CommentState.POSSIBLE_END,
    [CharClass.OPEN_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.CLOSE_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.EOP]: CommentState.IN_COMMENT,
    [CharClass.WHITESPACE]: CommentState.IN_COMMENT,
    [CharClass.LETTER]: CommentState.IN_COMMENT,
    [CharClass.OTHER]: CommentState.IN_COMMENT
  },
  [CommentState.TERMINATED]: {},
  [CommentState.UNTERMINATED]: {},
  [CommentState.NOT_A_COMMENT]: {}
};

// Word DFA: consume one or more lowercase letters, then resolve keyword vs ID.
const WORD_TRANSITION_TABLE: Record<WordState, Partial<Record<CharClass, WordState>>> = {
  [WordState.START]: {
    [CharClass.LETTER]: WordState.IN_WORD
  },
  [WordState.IN_WORD]: {
    [CharClass.LETTER]: WordState.IN_WORD,
    [CharClass.OPEN_BLOCK]: WordState.ACCEPT,
    [CharClass.CLOSE_BLOCK]: WordState.ACCEPT,
    [CharClass.EOP]: WordState.ACCEPT,
    [CharClass.SLASH]: WordState.ACCEPT,
    [CharClass.STAR]: WordState.ACCEPT,
    [CharClass.WHITESPACE]: WordState.ACCEPT,
    [CharClass.OTHER]: WordState.ACCEPT,
    [CharClass.EOF]: WordState.ACCEPT
  },
  [WordState.ACCEPT]: {}
};

// Accepting start states that produce concrete tokens.
const ACCEPTING_TOKENS: Partial<Record<StartState, TokenType>> = {
  [StartState.ACCEPT_OPEN_BLOCK]: TokenType.OPEN_BLOCK,
  [StartState.ACCEPT_CLOSE_BLOCK]: TokenType.CLOSE_BLOCK,
  [StartState.ACCEPT_EOP]: TokenType.EOP
};

const KEYWORD_TOKENS: Record<string, TokenType> = {
  int: TokenType.I_TYPE,
  string: TokenType.STRING_TYPE,
  boolean: TokenType.BOOLEAN_TYPE,
  true: TokenType.BOOL_TRUE,
  false: TokenType.BOOL_FALSE,
  print: TokenType.PRINT,
  while: TokenType.WHILE,
  if: TokenType.IF
};

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

    while (!this.isAtEnd()) {
      // A non-whitespace char starts a new program segment until we hit EOP.
      if (!inProgram && this.classify(this.peek()) !== CharClass.WHITESPACE) {
        currentProgram += 1;
        inProgram = true;
        console.log(`INFO  Lexer - Lexing program ${currentProgram}...`);
      }

      const state = this.nextStartState();
      const position = this.currentPosition();
      const acceptingToken = ACCEPTING_TOKENS[state];

      // Accepting states emit a token from the current character.
      if (acceptingToken !== undefined) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(acceptingToken, lexeme, position));
        this.debugToken(acceptingToken, lexeme, position.line, position.column);

        // EOP marks the end of one program in a multi-program input stream.
        if (acceptingToken === TokenType.EOP) {
          console.log("INFO  Lexer - Lex completed with 0 errors");
          inProgram = false;
        }

        continue;
      }

      // Slash can start a block comment; comment DFA handles the rest.
      if (state === StartState.POSSIBLE_COMMENT) {
        const commentStart = this.currentPosition();
        const commentTerminated = this.consumeCommentByDfa();

        if (commentTerminated === false) {
          this.warn(
            commentStart.line,
            commentStart.column,
            "Unterminated comment block. Reached end of input before finding closing '*/'. Add '*/' to end the comment."
          );
        }

        continue;
      }

      // Lowercase words are scanned by a separate DFA, then resolved as keyword or ID.
      if (state === StartState.POSSIBLE_WORD) {
        const lexeme = this.consumeWordByDfa();
        const tokenType = this.resolveWordTokenType(lexeme);

        if (tokenType !== undefined) {
          tokens.push(this.createToken(tokenType, lexeme, position));
          this.debugToken(tokenType, lexeme, position.line, position.column);
        }

        continue;
      }

      // Unknown or currently unsupported chars are consumed and ignored for now.
      this.consumeChar();
    }

    return tokens;
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private peek(): string {
    return this.source[this.index] ?? "\0";
  }

  private advance(): string {
    const char = this.source[this.index] ?? "\0";
    this.index += 1;
    return char;
  }

  private classify(char: string): CharClass {
    if (char === "\0") {
      return CharClass.EOF;
    }
    if (char === "{") {
      return CharClass.OPEN_BLOCK;
    }
    if (char === "}") {
      return CharClass.CLOSE_BLOCK;
    }
    if (char === "$") {
      return CharClass.EOP;
    }
    if (char === "/") {
      return CharClass.SLASH;
    }
    if (char === "*") {
      return CharClass.STAR;
    }
    if (char >= "a" && char <= "z") {
      return CharClass.LETTER;
    }
    if (char === " " || char === "\t" || char === "\r" || char === "\n") {
      return CharClass.WHITESPACE;
    }
    return CharClass.OTHER;
  }

  // One table lookup from START determines what to do with the next character.
  private nextStartState(): StartState {
    const charClass = this.classify(this.peek());
    return START_TRANSITION_TABLE[StartState.START][charClass] ?? StartState.SKIP;
  }

  private consumeChar(): string {
    const char = this.advance();
    this.updatePositionAfterConsume(char);
    return char;
  }

  private currentPosition(): { line: number; column: number; index: number } {
    return { line: this.line, column: this.column, index: this.index };
  }

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

  private debugToken(type: TokenType, lexeme: string, line: number, column: number): void {
    if (!this.debug) {
      return;
    }

    console.log(`DEBUG Lexer - ${type} '${lexeme}' found at (${line}:${column})`);
  }

  private consumeCommentByDfa(): boolean {
    let state = CommentState.EXPECT_STAR;

    // We enter here after seeing '/', so consume it before checking for '*'.
    this.consumeChar(); // initial '/'

    while (true) {
      const currentChar = this.peek();
      const currentClass = this.classify(currentChar);
      state = this.nextCommentStateByTable(state, currentClass);

      // '/x' where x != '*' is not a block comment in this grammar stage.
      if (state === CommentState.NOT_A_COMMENT) {
        return true;
      }
      // EOF reached before comment terminator.
      if (state === CommentState.UNTERMINATED) {
        return false;
      }
      // We are on the trailing '/' in '*/', consume it and finish.
      if (state === CommentState.TERMINATED) {
        this.consumeChar(); // consume '/'
        return true;
      }

      this.consumeChar();
    }
  }

  private nextCommentStateByTable(state: CommentState, charClass: CharClass): CommentState {
    return COMMENT_TRANSITION_TABLE[state][charClass] ?? CommentState.UNTERMINATED;
  }

  private consumeWordByDfa(): string {
    let lexeme = "";
    let state = WordState.START;

    while (state !== WordState.ACCEPT) {
      const currentChar = this.peek();
      const currentClass = this.classify(currentChar);
      const nextState: WordState = WORD_TRANSITION_TABLE[state][currentClass] ?? WordState.ACCEPT;

      if (nextState === WordState.ACCEPT) {
        state = nextState;
        continue;
      }

      lexeme += this.consumeChar();
      state = nextState;
    }

    return lexeme;
  }

  private resolveWordTokenType(lexeme: string): TokenType | undefined {
    const keywordToken = KEYWORD_TOKENS[lexeme];

    if (keywordToken !== undefined) {
      return keywordToken;
    }

    if (lexeme.length === 1) {
      return TokenType.ID;
    }

    return undefined;
  }

  // Keeps line/column tracking accurate for token and warning locations.
  private updatePositionAfterConsume(char: string): void {
    if (char === "\n") {
      this.line += 1;
      this.column = 1;
      return;
    }

    this.column += 1;
  }

  // Warning doesn't terminate the program, it just warns the user.
  private warn(line: number, column: number, message: string): void {
    console.log(`WARN  Lexer - Warning:${line}:${column} ${message}`);
  }
}