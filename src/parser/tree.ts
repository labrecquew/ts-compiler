// Based on tree demo by Alan G. Labouseur (from JS by Ardizzone/Smith); adapted for this compiler's CST.
// Branch nodes use kind "branch"; terminals use "leaf" (any kind other than "branch").

export interface TreeNode {
  name: string;
  children: TreeNode[];
  parent: TreeNode | Record<string, never>;
  /** Interior/branch vs leaf — empty branches still print as `<name>`, not `[name]`. */
  isBranch: boolean;
}

export class Tree {
  root: TreeNode | null = null;
  cur: Record<string, never> | TreeNode = {};

  /**
   * Add a node: `kind === "branch"` moves `cur` into the new node; leaves stay under `cur` without descending.
   */
  addNode(name: string, kind: string): void {
    const node: TreeNode = {
      name,
      children: [],
      parent: {},
      isBranch: kind === "branch"
    };

    if (this.root == null) {
      this.root = node;
    } else {
      node.parent = this.cur as TreeNode;
      (this.cur as TreeNode).children.push(node);
    }

    if (kind === "branch") {
      this.cur = node;
    }
  }

  /** Finished with the current branch: move `cur` up to the parent. */
  endChildren(): void {
    const cur = this.cur as TreeNode & { parent?: TreeNode | Record<string, never> };
    if (cur.parent !== null && (cur.parent as TreeNode).name !== undefined) {
      this.cur = cur.parent as TreeNode;
    }
  }

  /** Lines for the CST body (no "CST for program…" header), matching prior `cst-printer` output. */
  cstBodyLines(): string[] {
    if (this.root === null) {
      return [];
    }
    return expandNode(this.root, 0);
  }
}

const pad = (depth: number): string => "-".repeat(depth);

function isEmptyStatementList(node: TreeNode): boolean {
  return node.isBranch && node.name === "Statement List" && node.children.length === 0;
}

/**
 * Same rules as former `cst-printer`: ε `Statement List` under a `Block`, and omit redundant empty rest lists.
 */
function expandNode(node: TreeNode, depth: number): string[] {
  if (!node.isBranch) {
    return [`${pad(depth)}[${node.name}]`];
  }

  if (node.name === "Statement List") {
    return expandStatementList(node, depth);
  }

  const lines = [`${pad(depth)}<${node.name}>`];
  for (const child of node.children) {
    lines.push(...expandNode(child, depth + 1));
  }
  return lines;
}

function expandStatementList(node: TreeNode, depth: number): string[] {
  const lines = [`${pad(depth)}<Statement List>`];
  if (node.children.length === 0) {
    return lines;
  }
  if (node.children.length !== 2) {
    for (const child of node.children) {
      lines.push(...expandNode(child, depth + 1));
    }
    return lines;
  }

  const [first, rest] = node.children;
  lines.push(...expandNode(first, depth + 1));
  if (isEmptyStatementList(rest)) {
    return lines;
  }
  lines.push(...expandNode(rest, depth + 1));
  return lines;
}

export function printProgramCst(programNumber: number, tree: Tree): void {
  console.log(`CST for program ${programNumber}...`);
  for (const line of tree.cstBodyLines()) {
    console.log(line);
  }
}
