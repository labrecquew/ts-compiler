import type { BlockAst, BlockMember, ExprAst } from "./ast-nodes";

/** Hyphen depth matches `semanticAnalysisExamples.txt`: root `<Block>` uses a leading space. */
function pad(depth: number): string {
  return depth === 0 ? " " : "-".repeat(depth);
}

/** Lines only (no `INFO` prefix); caller prints the header. */
export function formatAstLines(root: BlockAst): string[] {
  return formatBlock(root, 0);
}

function formatBlock(block: BlockAst, depth: number): string[] {
  const lines = [`${pad(depth)}<Block>`];
  for (const m of block.members) {
    lines.push(...formatMember(m, depth + 1));
  }
  return lines;
}

function formatMember(m: BlockMember, depth: number): string[] {
  switch (m.kind) {
    case "Block":
      return formatBlock(m, depth);
    case "VarDecl":
      return [
        `${pad(depth)}<VarDecl>`,
        `${pad(depth + 1)}[${m.varType}]`,
        `${pad(depth + 1)}[${m.name}]`
      ];
    case "Assign":
      return [`${pad(depth)}<Assign>`, `${pad(depth + 1)}[${m.target}]`, ...formatExprLines(m.value, depth + 1)];
    case "Print":
      return [`${pad(depth)}<Print>`, ...formatExprLines(m.argument, depth + 1)];
    case "While":
      return [
        `${pad(depth)}<While>`,
        ...formatExprLines(m.condition, depth + 1),
        ...formatBlock(m.body, depth + 1)
      ];
    case "If":
      return [
        `${pad(depth)}<If>`,
        ...formatExprLines(m.condition, depth + 1),
        ...formatBlock(m.body, depth + 1)
      ];
    default: {
      const _exhaustive: never = m;
      return _exhaustive;
    }
  }
}

function formatExprLines(e: ExprAst, depth: number): string[] {
  switch (e.kind) {
    case "IntLiteral":
      return [`${pad(depth)}[${e.value}]`];
    case "IntAdd":
      return [
        `${pad(depth)}<IntAdd>`,
        ...formatExprLines(e.left, depth + 1),
        ...formatExprLines(e.right, depth + 1)
      ];
    case "StringLiteral":
      return [`${pad(depth)}["${e.value}"]`];
    case "BoolLiteral":
      return [`${pad(depth)}[${e.value ? "true" : "false"}]`];
    case "Id":
      return [`${pad(depth)}[${e.name}]`];
    case "BooleanBinary":
      return [
        `${pad(depth)}<BooleanBinary>`,
        `${pad(depth + 1)}[${e.operator}]`,
        ...formatExprLines(e.left, depth + 1),
        ...formatExprLines(e.right, depth + 1)
      ];
    default: {
      const _exhaustive: never = e;
      return _exhaustive;
    }
  }
}
