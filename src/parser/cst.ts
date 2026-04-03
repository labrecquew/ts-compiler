import type { Token } from "../lexer/tokens";

/** Branch node: name matches grammar / CST printout (e.g. `Statement List`, `Program`). */
export interface CstNonTerminal {
  kind: "nonTerminal";
  name: string;
  children: CstNode[];
}

/** Leaf: one concrete token from the lexer. */
export interface CstTerminal {
  kind: "terminal";
  token: Token;
}

export type CstNode = CstNonTerminal | CstTerminal;

export function nonTerminal(name: string, children: CstNode[] = []): CstNonTerminal {
  return { kind: "nonTerminal", name, children };
}

export function terminal(token: Token): CstTerminal {
  return { kind: "terminal", token };
}
