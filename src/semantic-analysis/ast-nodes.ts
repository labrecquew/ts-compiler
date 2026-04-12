import type { LanguageType } from "./language-type";
import type { SourcePosition } from "../lexer/tokens";

/**
 * Phase A builds this tree from the token stream (second pass after parse succeeds).
 * Shape matches the strict pretty-print in `cursor-only/semanticAnalysisExamples.txt`:
 * root `<Block>`, nested `<Block>` children, `VarDecl` / `Assign` / `Print` as siblings in order.
 *
 * Phase B performs one depth-first in-order walk: scope table + name + type rules.
 */
export type AstRoot = BlockAst;

/** Outermost `{ ... }` of a program (before `$`) and every nested block. */
export interface BlockAst {
  kind: "Block";
  /** Nested blocks and statements in source order. */
  members: BlockMember[];
}

export type BlockMember =
  | BlockAst
  | VarDeclAst
  | AssignAst
  | PrintAst
  | WhileAst
  | IfAst;

export interface VarDeclAst {
  kind: "VarDecl";
  varType: LanguageType;
  name: string;
  /** Position of the identifier token (decl site for diagnostics). */
  namePosition: SourcePosition;
}

export interface AssignAst {
  kind: "Assign";
  target: string;
  targetPosition: SourcePosition;
  value: ExprAst;
}

export interface PrintAst {
  kind: "Print";
  argument: ExprAst;
}

export interface WhileAst {
  kind: "While";
  condition: ExprAst;
  body: BlockAst;
}

export interface IfAst {
  kind: "If";
  condition: ExprAst;
  body: BlockAst;
}

export type ExprAst =
  | IntLiteralExpr
  | IntAddExpr
  | StringLiteralExpr
  | BoolLiteralExpr
  | IdExpr
  | BooleanBinaryExpr;

export interface IntLiteralExpr {
  kind: "IntLiteral";
  /** Numeric value of the digit sequence. */
  value: number;
  position: SourcePosition;
}

/** `IntExpr ::= digit intop Expr` — only `+` is an intop in the grammar. */
export interface IntAddExpr {
  kind: "IntAdd";
  left: ExprAst;
  right: ExprAst;
  position: SourcePosition;
}

export interface StringLiteralExpr {
  kind: "StringLiteral";
  /** Characters inside the quotes (lexeme without surrounding `"`). */
  value: string;
  position: SourcePosition;
}

export interface BoolLiteralExpr {
  kind: "BoolLiteral";
  value: boolean;
  position: SourcePosition;
}

export interface IdExpr {
  kind: "Id";
  name: string;
  position: SourcePosition;
}

export interface BooleanBinaryExpr {
  kind: "BooleanBinary";
  operator: "==" | "!=";
  left: ExprAst;
  right: ExprAst;
  /** Anchor for errors (e.g. `(` or operator). */
  position: SourcePosition;
}
