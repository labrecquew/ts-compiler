import type { CstNode, CstNonTerminal } from "./cst";

const pad = (depth: number): string => "-".repeat(depth);

function formatTerminalLexeme(lexeme: string): string {
  return `[${lexeme}]`;
}

function isEmptyStatementList(node: CstNode): boolean {
  return (
    node.kind === "nonTerminal" && node.name === "Statement List" && node.children.length === 0
  );
}

/**
 * Pretty-print the CST: non-terminals as `<Name>`, terminals as `[lexeme]`, hyphen depth like parseExamples.
 *
 * For `StatementList ::= Statement StatementList | ε`, an empty **rest** `StatementList` after a statement
 * is not printed as its own line — only the ε list directly under a `Block` appears (matches parseExamples).
 */
export function printCst(programNumber: number, root: CstNode): void {
  console.log(`CST for program ${programNumber}...`);
  printNode(root, 0);
}

function printNode(node: CstNode, depth: number): void {
  if (node.kind === "terminal") {
    console.log(`${pad(depth)}${formatTerminalLexeme(node.token.lexeme)}`);
    return;
  }

  if (node.name === "Statement List") {
    printStatementList(node, depth);
    return;
  }

  console.log(`${pad(depth)}<${node.name}>`);
  for (const child of node.children) {
    printNode(child, depth + 1);
  }
}

function printStatementList(node: CstNonTerminal, depth: number): void {
  console.log(`${pad(depth)}<Statement List>`);
  if (node.children.length === 0) {
    return;
  }

  if (node.children.length !== 2) {
    for (const child of node.children) {
      printNode(child, depth + 1);
    }
    return;
  }

  const [first, rest] = node.children;
  printNode(first, depth + 1);
  if (isEmptyStatementList(rest)) {
    return;
  }
  printNode(rest, depth + 1);
}
