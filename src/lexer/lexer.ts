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
  ACCEPT_OPEN_PAREN = "ACCEPT_OPEN_PAREN",
  ACCEPT_CLOSE_PAREN = "ACCEPT_CLOSE_PAREN",
  ACCEPT_EOP = "ACCEPT_EOP",
  POSSIBLE_COMMENT = "POSSIBLE_COMMENT",
  POSSIBLE_OPERATOR = "POSSIBLE_OPERATOR",
  POSSIBLE_WORD = "POSSIBLE_WORD",
  POSSIBLE_DIGITS = "POSSIBLE_DIGITS",
  POSSIBLE_STRING = "POSSIBLE_STRING",
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

// Dedicated DFA states for operators that may be one or two characters long.
enum OperatorState {
  START = "START",
  AFTER_ASSIGN = "AFTER_ASSIGN",
  AFTER_BANG = "AFTER_BANG",
  ACCEPT_ASSIGN = "ACCEPT_ASSIGN",
  ACCEPT_EQUALITY = "ACCEPT_EQUALITY",
  ACCEPT_INEQUALITY = "ACCEPT_INEQUALITY",
  ACCEPT_INT_OP = "ACCEPT_INT_OP",
  INVALID = "INVALID"
}

// Dedicated DFA states for runs of digits.
enum DigitState {
  START = "START",
  IN_DIGITS = "IN_DIGITS",
  ACCEPT = "ACCEPT"
}

// Dedicated DFA states for quoted strings with char and space contents.
enum StringState {
  START = "START",
  IN_STRING = "IN_STRING",
  ACCEPT = "ACCEPT",
  UNTERMINATED = "UNTERMINATED"
}

// Input alphabet classes consumed by DFA tables.
enum CharClass {
  OPEN_BLOCK = "OPEN_BLOCK",
  CLOSE_BLOCK = "CLOSE_BLOCK",
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  EOP = "EOP",
  SLASH = "SLASH",
  STAR = "STAR",
  ASSIGN = "ASSIGN",
  BANG = "BANG",
  PLUS = "PLUS",
  DIGIT = "DIGIT",
  QUOTE = "QUOTE",
  SPACE = "SPACE",
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
    [CharClass.OPEN_PAREN]: StartState.ACCEPT_OPEN_PAREN,
    [CharClass.CLOSE_PAREN]: StartState.ACCEPT_CLOSE_PAREN,
    [CharClass.EOP]: StartState.ACCEPT_EOP,
    [CharClass.SLASH]: StartState.POSSIBLE_COMMENT,
    [CharClass.ASSIGN]: StartState.POSSIBLE_OPERATOR,
    [CharClass.BANG]: StartState.POSSIBLE_OPERATOR,
    [CharClass.PLUS]: StartState.POSSIBLE_OPERATOR,
    [CharClass.LETTER]: StartState.POSSIBLE_WORD,
    [CharClass.DIGIT]: StartState.POSSIBLE_DIGITS,
    [CharClass.QUOTE]: StartState.POSSIBLE_STRING,
    [CharClass.SPACE]: StartState.SKIP,
    [CharClass.WHITESPACE]: StartState.SKIP,
    [CharClass.OTHER]: StartState.SKIP,
    [CharClass.STAR]: StartState.SKIP,
    [CharClass.EOF]: StartState.SKIP
  },
  [StartState.ACCEPT_OPEN_BLOCK]: {},
  [StartState.ACCEPT_CLOSE_BLOCK]: {},
  [StartState.ACCEPT_OPEN_PAREN]: {},
  [StartState.ACCEPT_CLOSE_PAREN]: {},
  [StartState.ACCEPT_EOP]: {},
  [StartState.POSSIBLE_COMMENT]: {},
  [StartState.POSSIBLE_OPERATOR]: {},
  [StartState.POSSIBLE_WORD]: {},
  [StartState.POSSIBLE_DIGITS]: {},
  [StartState.POSSIBLE_STRING]: {},
  [StartState.SKIP]: {}
};

// Comment DFA: validates and consumes /* ... */ including multi-line comments.
const COMMENT_TRANSITION_TABLE: Record<CommentState, Partial<Record<CharClass, CommentState>>> = {
  [CommentState.EXPECT_STAR]: {
    [CharClass.STAR]: CommentState.IN_COMMENT,
    [CharClass.EOF]: CommentState.UNTERMINATED,
    [CharClass.OPEN_BLOCK]: CommentState.NOT_A_COMMENT,
    [CharClass.CLOSE_BLOCK]: CommentState.NOT_A_COMMENT,
    [CharClass.OPEN_PAREN]: CommentState.NOT_A_COMMENT,
    [CharClass.CLOSE_PAREN]: CommentState.NOT_A_COMMENT,
    [CharClass.EOP]: CommentState.NOT_A_COMMENT,
    [CharClass.SLASH]: CommentState.NOT_A_COMMENT,
    [CharClass.ASSIGN]: CommentState.NOT_A_COMMENT,
    [CharClass.BANG]: CommentState.NOT_A_COMMENT,
    [CharClass.PLUS]: CommentState.NOT_A_COMMENT,
    [CharClass.DIGIT]: CommentState.NOT_A_COMMENT,
    [CharClass.QUOTE]: CommentState.NOT_A_COMMENT,
    [CharClass.SPACE]: CommentState.NOT_A_COMMENT,
    [CharClass.WHITESPACE]: CommentState.NOT_A_COMMENT,
    [CharClass.LETTER]: CommentState.NOT_A_COMMENT,
    [CharClass.OTHER]: CommentState.NOT_A_COMMENT
  },
  [CommentState.IN_COMMENT]: {
    [CharClass.EOF]: CommentState.UNTERMINATED,
    [CharClass.STAR]: CommentState.POSSIBLE_END,
    [CharClass.OPEN_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.CLOSE_BLOCK]: CommentState.IN_COMMENT,
    [CharClass.OPEN_PAREN]: CommentState.IN_COMMENT,
    [CharClass.CLOSE_PAREN]: CommentState.IN_COMMENT,
    [CharClass.EOP]: CommentState.IN_COMMENT,
    [CharClass.SLASH]: CommentState.IN_COMMENT,
    [CharClass.ASSIGN]: CommentState.IN_COMMENT,
    [CharClass.BANG]: CommentState.IN_COMMENT,
    [CharClass.PLUS]: CommentState.IN_COMMENT,
    [CharClass.DIGIT]: CommentState.IN_COMMENT,
    [CharClass.QUOTE]: CommentState.IN_COMMENT,
    [CharClass.SPACE]: CommentState.IN_COMMENT,
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
    [CharClass.OPEN_PAREN]: CommentState.IN_COMMENT,
    [CharClass.CLOSE_PAREN]: CommentState.IN_COMMENT,
    [CharClass.EOP]: CommentState.IN_COMMENT,
    [CharClass.ASSIGN]: CommentState.IN_COMMENT,
    [CharClass.BANG]: CommentState.IN_COMMENT,
    [CharClass.PLUS]: CommentState.IN_COMMENT,
    [CharClass.DIGIT]: CommentState.IN_COMMENT,
    [CharClass.QUOTE]: CommentState.IN_COMMENT,
    [CharClass.SPACE]: CommentState.IN_COMMENT,
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
    [CharClass.OPEN_PAREN]: WordState.ACCEPT,
    [CharClass.CLOSE_PAREN]: WordState.ACCEPT,
    [CharClass.EOP]: WordState.ACCEPT,
    [CharClass.SLASH]: WordState.ACCEPT,
    [CharClass.STAR]: WordState.ACCEPT,
    [CharClass.ASSIGN]: WordState.ACCEPT,
    [CharClass.BANG]: WordState.ACCEPT,
    [CharClass.PLUS]: WordState.ACCEPT,
    [CharClass.DIGIT]: WordState.ACCEPT,
    [CharClass.QUOTE]: WordState.ACCEPT,
    [CharClass.SPACE]: WordState.ACCEPT,
    [CharClass.WHITESPACE]: WordState.ACCEPT,
    [CharClass.OTHER]: WordState.ACCEPT,
    [CharClass.EOF]: WordState.ACCEPT
  },
  [WordState.ACCEPT]: {}
};

// Digit DFA: consumes one or more adjacent digits.
const DIGIT_TRANSITION_TABLE: Record<DigitState, Partial<Record<CharClass, DigitState>>> = {
  [DigitState.START]: {
    [CharClass.DIGIT]: DigitState.IN_DIGITS
  },
  [DigitState.IN_DIGITS]: {
    [CharClass.DIGIT]: DigitState.IN_DIGITS,
    [CharClass.OPEN_BLOCK]: DigitState.ACCEPT,
    [CharClass.CLOSE_BLOCK]: DigitState.ACCEPT,
    [CharClass.OPEN_PAREN]: DigitState.ACCEPT,
    [CharClass.CLOSE_PAREN]: DigitState.ACCEPT,
    [CharClass.EOP]: DigitState.ACCEPT,
    [CharClass.SLASH]: DigitState.ACCEPT,
    [CharClass.STAR]: DigitState.ACCEPT,
    [CharClass.ASSIGN]: DigitState.ACCEPT,
    [CharClass.BANG]: DigitState.ACCEPT,
    [CharClass.PLUS]: DigitState.ACCEPT,
    [CharClass.QUOTE]: DigitState.ACCEPT,
    [CharClass.SPACE]: DigitState.ACCEPT,
    [CharClass.LETTER]: DigitState.ACCEPT,
    [CharClass.WHITESPACE]: DigitState.ACCEPT,
    [CharClass.OTHER]: DigitState.ACCEPT,
    [CharClass.EOF]: DigitState.ACCEPT
  },
  [DigitState.ACCEPT]: {}
};

// String DFA: starts at a quote, stays inside on chars/spaces, and accepts on closing quote.
const STRING_TRANSITION_TABLE: Record<StringState, Partial<Record<CharClass, StringState>>> = {
  [StringState.START]: {
    [CharClass.QUOTE]: StringState.IN_STRING
  },
  [StringState.IN_STRING]: {
    [CharClass.LETTER]: StringState.IN_STRING,
    [CharClass.SPACE]: StringState.IN_STRING,
    [CharClass.QUOTE]: StringState.ACCEPT,
    [CharClass.EOF]: StringState.UNTERMINATED,
    [CharClass.WHITESPACE]: StringState.UNTERMINATED,
    [CharClass.OPEN_BLOCK]: StringState.UNTERMINATED,
    [CharClass.CLOSE_BLOCK]: StringState.UNTERMINATED,
    [CharClass.OPEN_PAREN]: StringState.UNTERMINATED,
    [CharClass.CLOSE_PAREN]: StringState.UNTERMINATED,
    [CharClass.EOP]: StringState.UNTERMINATED,
    [CharClass.SLASH]: StringState.UNTERMINATED,
    [CharClass.STAR]: StringState.UNTERMINATED,
    [CharClass.ASSIGN]: StringState.UNTERMINATED,
    [CharClass.BANG]: StringState.UNTERMINATED,
    [CharClass.PLUS]: StringState.UNTERMINATED,
    [CharClass.DIGIT]: StringState.UNTERMINATED,
    [CharClass.OTHER]: StringState.UNTERMINATED
  },
  [StringState.ACCEPT]: {},
  [StringState.UNTERMINATED]: {}
};

// Operator DFA: supports =, ==, !=, and + with maximal munch.
const OPERATOR_TRANSITION_TABLE: Record<OperatorState, Partial<Record<CharClass, OperatorState>>> = {
  [OperatorState.START]: {
    [CharClass.ASSIGN]: OperatorState.AFTER_ASSIGN,
    [CharClass.BANG]: OperatorState.AFTER_BANG,
    [CharClass.PLUS]: OperatorState.ACCEPT_INT_OP
  },
  [OperatorState.AFTER_ASSIGN]: {
    [CharClass.OPEN_BLOCK]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.CLOSE_BLOCK]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.OPEN_PAREN]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.CLOSE_PAREN]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.EOP]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.SLASH]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.STAR]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.ASSIGN]: OperatorState.ACCEPT_EQUALITY,
    [CharClass.BANG]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.PLUS]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.LETTER]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.SPACE]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.WHITESPACE]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.OTHER]: OperatorState.ACCEPT_ASSIGN,
    [CharClass.EOF]: OperatorState.ACCEPT_ASSIGN
  },
  [OperatorState.AFTER_BANG]: {
    [CharClass.ASSIGN]: OperatorState.ACCEPT_INEQUALITY,
    [CharClass.OPEN_BLOCK]: OperatorState.INVALID,
    [CharClass.CLOSE_BLOCK]: OperatorState.INVALID,
    [CharClass.OPEN_PAREN]: OperatorState.INVALID,
    [CharClass.CLOSE_PAREN]: OperatorState.INVALID,
    [CharClass.EOP]: OperatorState.INVALID,
    [CharClass.SLASH]: OperatorState.INVALID,
    [CharClass.STAR]: OperatorState.INVALID,
    [CharClass.BANG]: OperatorState.INVALID,
    [CharClass.PLUS]: OperatorState.INVALID,
    [CharClass.LETTER]: OperatorState.INVALID,
    [CharClass.SPACE]: OperatorState.INVALID,
    [CharClass.WHITESPACE]: OperatorState.INVALID,
    [CharClass.OTHER]: OperatorState.INVALID,
    [CharClass.EOF]: OperatorState.INVALID
  },
  [OperatorState.ACCEPT_ASSIGN]: {},
  [OperatorState.ACCEPT_EQUALITY]: {},
  [OperatorState.ACCEPT_INEQUALITY]: {},
  [OperatorState.ACCEPT_INT_OP]: {},
  [OperatorState.INVALID]: {}
};

// Accepting start states that produce concrete tokens.
const ACCEPTING_TOKENS: Partial<Record<StartState, TokenType>> = {
  [StartState.ACCEPT_OPEN_BLOCK]: TokenType.OPEN_BLOCK,
  [StartState.ACCEPT_CLOSE_BLOCK]: TokenType.CLOSE_BLOCK,
  [StartState.ACCEPT_OPEN_PAREN]: TokenType.OPEN_PAREN,
  [StartState.ACCEPT_CLOSE_PAREN]: TokenType.CLOSE_PAREN,
  [StartState.ACCEPT_EOP]: TokenType.EOP
};

// All three declared types share the same token in this grammar/output format.
const KEYWORD_TOKENS: Record<string, TokenType> = {
  int: TokenType.I_TYPE,
  string: TokenType.I_TYPE,
  boolean: TokenType.I_TYPE,
  true: TokenType.BOOL_TRUE,
  false: TokenType.BOOL_FALSE,
  print: TokenType.PRINT,
  while: TokenType.WHILE,
  if: TokenType.IF
};

enum CommentScanResult {
  TERMINATED = "TERMINATED",
  UNTERMINATED = "UNTERMINATED",
  NOT_A_COMMENT = "NOT_A_COMMENT"
}

interface CommentScanOutcome {
  result: CommentScanResult;
}

interface StringScanOutcome {
  tokens: Token[];
  terminated: boolean;
  errorMessage?: string;
  errorPosition?: { line: number; column: number; index: number };
}

interface OperatorScanOutcome {
  token?: Token;
  errorMessage?: string;
  errorLexeme: string;
}

/** One program's tokens through `EOP`, with per-program stats for lex-then-parse drivers. */
export interface LexProgramResult {
  tokens: Token[];
  lexErrorCount: number;
  programNumber: number;
}

export class Lexer {
  private readonly source: string;
  private readonly debug: boolean;
  private index = 0;
  private line = 1;
  private column = 1;
  private programSequence = 0;

  constructor(source: string, options: LexerOptions = {}) {
    this.source = source;
    this.debug = options.debug ?? true;
  }

  /**
   * Lex one program: first significant character through `EOP` (inclusive), after skipping
   * inter-program whitespace. Returns `null` when there is no next program.
   */
  public lexNextProgram(): LexProgramResult | null {
    while (!this.isAtEnd() && this.isIgnoredOutsideString(this.classify(this.peek()))) {
      this.consumeChar();
    }

    if (this.isAtEnd()) {
      return null;
    }

    this.programSequence += 1;
    const programNumber = this.programSequence;
    let currentProgramErrors = 0;
    const tokens: Token[] = [];

    console.log(`INFO  Lexer - Lexing program ${programNumber}...`);

    while (true) {
      if (this.isAtEnd()) {
        const syntheticEopPosition = this.currentPosition();
        const syntheticEop = this.createToken(TokenType.EOP, "$", syntheticEopPosition);

        this.warn(
          syntheticEopPosition.line,
          syntheticEopPosition.column,
          "Missing end-of-program marker '$'. The lexer inserted a synthetic '$' at end of input so this program can be finalized."
        );
        tokens.push(syntheticEop);
        this.debugToken(TokenType.EOP, syntheticEop.lexeme, syntheticEopPosition.line, syntheticEopPosition.column);
        this.finishProgram(currentProgramErrors);
        return { tokens, lexErrorCount: currentProgramErrors, programNumber };
      }

      const state = this.nextStartState();
      const position = this.currentPosition();
      const acceptingToken = ACCEPTING_TOKENS[state];

      if (acceptingToken !== undefined) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(acceptingToken, lexeme, position));
        this.debugToken(acceptingToken, lexeme, position.line, position.column);

        if (acceptingToken === TokenType.EOP) {
          this.finishProgram(currentProgramErrors);
          return { tokens, lexErrorCount: currentProgramErrors, programNumber };
        }

        continue;
      }

      if (state === StartState.POSSIBLE_COMMENT) {
        const commentStart = this.currentPosition();
        const commentOutcome = this.consumeCommentByDfa();

        if (commentOutcome.result === CommentScanResult.UNTERMINATED) {
          this.warn(
            commentStart.line,
            commentStart.column,
            "Unterminated comment block. Reached end of input before finding closing '*/'. Add '*/' to end the comment."
          );
        }

        if (commentOutcome.result === CommentScanResult.NOT_A_COMMENT) {
          currentProgramErrors += 1;
          this.error(
            commentStart.line,
            commentStart.column,
            "Unrecognized Token: /. The grammar only allows '/' as the start of a block comment '/* ... */'. Replace it with a valid token or complete the comment opener."
          );
        }

        continue;
      }

      if (state === StartState.POSSIBLE_OPERATOR) {
        const operatorOutcome = this.consumeOperatorByDfa(position);

        if (operatorOutcome.token !== undefined) {
          tokens.push(operatorOutcome.token);
          this.debugToken(
            operatorOutcome.token.type,
            operatorOutcome.token.lexeme,
            operatorOutcome.token.position.line,
            operatorOutcome.token.position.column
          );
        } else {
          currentProgramErrors += 1;
          this.error(
            position.line,
            position.column,
            operatorOutcome.errorMessage ?? "Unrecognized Token: <operator>. This operator is not valid in the grammar."
          );
        }

        continue;
      }

      if (state === StartState.POSSIBLE_WORD) {
        const lexeme = this.consumeWordByDfa();
        const tokenType = this.resolveWordTokenType(lexeme);

        if (tokenType !== undefined) {
          tokens.push(this.createToken(tokenType, lexeme, position));
          this.debugToken(tokenType, lexeme, position.line, position.column);
        } else {
          currentProgramErrors += 1;
          this.error(
            position.line,
            position.column,
            `Unrecognized Token: ${lexeme}. The grammar allows multi-character words only for reserved keywords, and identifiers must be a single lowercase letter. Use a keyword or split this into valid one-character identifiers.`
          );
        }

        continue;
      }

      if (state === StartState.POSSIBLE_DIGITS) {
        const digitTokens = this.consumeDigitsByDfa(position);

        for (const digitToken of digitTokens) {
          tokens.push(digitToken);
          this.debugToken(
            digitToken.type,
            digitToken.lexeme,
            digitToken.position.line,
            digitToken.position.column
          );
        }

        continue;
      }

      if (state === StartState.POSSIBLE_STRING) {
        const stringOutcome = this.consumeStringByDfa(position);

        for (const stringToken of stringOutcome.tokens) {
          tokens.push(stringToken);
          this.debugToken(
            stringToken.type,
            stringToken.lexeme,
            stringToken.position.line,
            stringToken.position.column
          );
        }

        if (!stringOutcome.terminated && stringOutcome.errorMessage !== undefined && stringOutcome.errorPosition !== undefined) {
          currentProgramErrors += 1;
          this.error(
            stringOutcome.errorPosition.line,
            stringOutcome.errorPosition.column,
            stringOutcome.errorMessage
          );
        }

        continue;
      }

      const currentCharClass = this.classify(this.peek());

      if (this.isIgnoredOutsideString(currentCharClass)) {
        this.consumeChar();
        continue;
      }

      const badPosition = this.currentPosition();
      const badLexeme = this.consumeChar();
      currentProgramErrors += 1;
      this.error(
        badPosition.line,
        badPosition.column,
        `Unrecognized Token: ${badLexeme}. This character is not part of the grammar at this position. Remove it or replace it with a valid token.`
      );
    }
  }

  // Lex the full source; equivalent to concatenating every `lexNextProgram` segment.
  public lex(): Token[] {
    const tokens: Token[] = [];

    for (;;) {
      const segment = this.lexNextProgram();
      if (segment === null) {
        return tokens;
      }
      tokens.push(...segment.tokens);
    }
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
    if (char === "(") {
      return CharClass.OPEN_PAREN;
    }
    if (char === ")") {
      return CharClass.CLOSE_PAREN;
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
    if (char === "=") {
      return CharClass.ASSIGN;
    }
    if (char === "!") {
      return CharClass.BANG;
    }
    if (char === "+") {
      return CharClass.PLUS;
    }
    if (char >= "0" && char <= "9") {
      return CharClass.DIGIT;
    }
    if (char === "\"") {
      return CharClass.QUOTE;
    }
    if (char === " ") {
      return CharClass.SPACE;
    }
    if (char >= "a" && char <= "z") {
      return CharClass.LETTER;
    }
    if (char === "\t" || char === "\r" || char === "\n") {
      return CharClass.WHITESPACE;
    }
    return CharClass.OTHER;
  }

  // One table lookup from START determines what to do with the next character.
  private nextStartState(): StartState {
    const charClass = this.classify(this.peek());
    return START_TRANSITION_TABLE[StartState.START][charClass] ?? StartState.SKIP;
  }

  private isIgnoredOutsideString(charClass: CharClass): boolean {
    return charClass === CharClass.SPACE || charClass === CharClass.WHITESPACE;
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

    console.log(`DEBUG Lexer - ${type} [ ${lexeme} ] found at (${line}:${column})`);
  }

  private consumeCommentByDfa(): CommentScanOutcome {
    let state = CommentState.EXPECT_STAR;

    // We enter here after seeing '/', so consume it before checking for '*'.
    this.consumeChar(); // initial '/'

    while (true) {
      const currentChar = this.peek();
      const currentClass = this.classify(currentChar);
      state = this.nextCommentStateByTable(state, currentClass);

      // '/x' where x != '*' is not a block comment in this grammar stage.
      if (state === CommentState.NOT_A_COMMENT) {
        return { result: CommentScanResult.NOT_A_COMMENT };
      }
      // EOF reached before comment terminator.
      if (state === CommentState.UNTERMINATED) {
        return { result: CommentScanResult.UNTERMINATED };
      }
      // We are on the trailing '/' in '*/', consume it and finish.
      if (state === CommentState.TERMINATED) {
        this.consumeChar(); // consume '/'
        return { result: CommentScanResult.TERMINATED };
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

  private consumeDigitsByDfa(position: { line: number; column: number; index: number }): Token[] {
    const tokens: Token[] = [];
    let lexeme = "";
    let state = DigitState.START;

    while (state !== DigitState.ACCEPT) {
      const currentClass = this.classify(this.peek());
      const nextState: DigitState = DIGIT_TRANSITION_TABLE[state][currentClass] ?? DigitState.ACCEPT;

      if (nextState === DigitState.ACCEPT) {
        state = nextState;
        continue;
      }

      lexeme += this.consumeChar();
      state = nextState;
    }

    for (let offset = 0; offset < lexeme.length; offset += 1) {
      tokens.push(
        this.createToken(TokenType.DIGIT, lexeme[offset], {
          line: position.line,
          column: position.column + offset,
          index: position.index + offset
        })
      );
    }

    return tokens;
  }

  private consumeStringByDfa(position: { line: number; column: number; index: number }): StringScanOutcome {
    const tokens: Token[] = [];
    let state = StringState.START;

    while (state !== StringState.ACCEPT && state !== StringState.UNTERMINATED) {
      const currentChar = this.peek();
      const currentClass = this.classify(currentChar);
      const nextState: StringState = STRING_TRANSITION_TABLE[state][currentClass] ?? StringState.UNTERMINATED;
      const tokenPosition = this.currentPosition();

      if (state === StringState.START && currentClass === CharClass.QUOTE) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(TokenType.QUOTE, lexeme, tokenPosition));
        state = nextState;
        continue;
      }

      if (state === StringState.IN_STRING && currentClass === CharClass.QUOTE) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(TokenType.QUOTE, lexeme, tokenPosition));
        state = nextState;
        continue;
      }

      if (state === StringState.IN_STRING && currentClass === CharClass.LETTER) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(TokenType.CHAR, lexeme, tokenPosition));
        state = nextState;
        continue;
      }

      if (state === StringState.IN_STRING && currentClass === CharClass.SPACE) {
        const lexeme = this.consumeChar();
        tokens.push(this.createToken(TokenType.SPACE, lexeme, tokenPosition));
        state = nextState;
        continue;
      }

      if (nextState === StringState.UNTERMINATED) {
        return {
          tokens,
          terminated: false,
          errorPosition: tokenPosition,
          errorMessage: this.buildStringErrorMessage(position, currentChar)
        };
      }

      state = nextState;
    }

    return {
      tokens,
      terminated: true
    };
  }

  private consumeOperatorByDfa(position: { line: number; column: number; index: number }): OperatorScanOutcome {
    const firstClass = this.classify(this.peek());
    let state = OPERATOR_TRANSITION_TABLE[OperatorState.START][firstClass] ?? OperatorState.INVALID;
    let lexeme = this.consumeChar();

    if (state === OperatorState.ACCEPT_INT_OP) {
      return {
        token: this.createToken(TokenType.INT_OP, lexeme, position),
        errorLexeme: lexeme
      };
    }

    while (true) {
      const nextClass = this.classify(this.peek());
      state = OPERATOR_TRANSITION_TABLE[state][nextClass] ?? OperatorState.INVALID;

      if (state === OperatorState.ACCEPT_ASSIGN) {
        return {
          token: this.createToken(TokenType.ASSIGN_OP, lexeme, position),
          errorLexeme: lexeme
        };
      }

      if (state === OperatorState.ACCEPT_EQUALITY) {
        lexeme += this.consumeChar();
        return {
          token: this.createToken(TokenType.EQUALITY_OP, lexeme, position),
          errorLexeme: lexeme
        };
      }

      if (state === OperatorState.ACCEPT_INEQUALITY) {
        lexeme += this.consumeChar();
        return {
          token: this.createToken(TokenType.INEQUALITY_OP, lexeme, position),
          errorLexeme: lexeme
        };
      }

      if (state === OperatorState.INVALID) {
        return {
          errorLexeme: lexeme,
          errorMessage:
            lexeme === "!"
              ? "Unrecognized Token: !. The grammar does not allow a standalone '!'; boolean inequality must be written as '!='. Add '=' after '!' or replace it with a valid token."
              : `Unrecognized Token: ${lexeme}. This operator is not valid in the grammar. Replace it with '=', '==', '!=', or '+'.`
        };
      }
    }
  }

  private resolveWordTokenType(lexeme: string): TokenType | undefined {
    const keywordToken = KEYWORD_TOKENS[lexeme];

    if (keywordToken !== undefined) {
      return keywordToken;
    }

    // Non-keyword identifiers are a single lowercase character in this grammar.
    if (lexeme.length === 1) {
      return TokenType.ID;
    }

    return undefined;
  }

  private buildStringErrorMessage(
    startPosition: { line: number; column: number; index: number },
    offendingChar: string
  ): string {
    const printableChar = this.formatCharForMessage(offendingChar);

    if (offendingChar === "\0") {
      return `Unterminated string beginning at ${startPosition.line}:${startPosition.column}. Reached end of input before finding the closing quote. Add a closing '"' before the program ends.`;
    }

    if (offendingChar === "\n" || offendingChar === "\r") {
      return `Unterminated string beginning at ${startPosition.line}:${startPosition.column}. Encountered ${printableChar} before a closing quote. Strings may only contain lowercase letters and spaces on a single line. Close the string before the line break.`;
    }

    return `Unterminated string beginning at ${startPosition.line}:${startPosition.column}. Encountered ${printableChar} before a closing quote. Strings may only contain lowercase letters and spaces. Remove the invalid character or close the string with '"'.`;
  }

  private formatCharForMessage(char: string): string {
    if (char === "\0") {
      return "EOF";
    }
    if (char === "\n") {
      return "newline";
    }
    if (char === "\r") {
      return "carriage return";
    }
    if (char === "\t") {
      return "tab";
    }

    return `'${char}'`;
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

  private error(line: number, column: number, message: string): void {
    console.log(`ERROR Lexer - Error:${line}:${column} ${message}`);
  }

  private finishProgram(errorCount: number): void {
    if (errorCount === 0) {
      console.log("INFO  Lexer - Lex completed with 0 errors");
      return;
    }

    console.log(`ERROR Lexer - Lex failed with ${errorCount} error(s)`);
  }
}