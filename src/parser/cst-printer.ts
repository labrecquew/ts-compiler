import type { CstNode } from "./cst";

const pad = (depth: number): string => "-".repeat(depth);

function formatTerminalLexeme(lexeme: string): string {
  return `[${lexeme}]`;
}

/**
 * Pretty-print the CST: non-terminals as `<Name>`, terminals as `[lexeme]`, hyphen depth like parseExamples.
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

  console.log(`${pad(depth)}<${node.name}>`);
  for (const child of node.children) {
    printNode(child, depth + 1);
  }
}
