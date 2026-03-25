//What a token can be
export enum TokenType {
  OPEN_BLOCK = "OPEN_BLOCK",
  CLOSE_BLOCK = "CLOSE_BLOCK",
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  EOP = "EOP",
  ASSIGN_OP = "ASSIGN_OP",
  EQUALITY_OP = "EQUALITY_OP",
  INEQUALITY_OP = "INEQUALITY_OP",
  INT_OP = "INT_OP",
  I_TYPE = "I_TYPE",
  PRINT = "PRINT",
  WHILE = "WHILE",
  IF = "IF",
  BOOL_TRUE = "BOOL_TRUE",
  BOOL_FALSE = "BOOL_FALSE",
  ID = "ID",
  DIGIT = "DIGIT",
  QUOTE = "QUOTE",
  CHAR = "CHAR",
  SPACE = "SPACE"
}

//Information about tokens
export interface SourcePosition {
  line: number;
  column: number;
  index: number;
}

//Actual finished token
export interface Token {
  type: TokenType;
  lexeme: string;
  position: SourcePosition;
}
