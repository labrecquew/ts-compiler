import { DiagnosticSeverity, type Diagnostic } from "../parser/diagnostics";
import type { LanguageType } from "./language-type";
import type {
  AssignAst,
  BlockAst,
  BlockMember,
  ExprAst,
  IdExpr,
  IfAst,
  PrintAst,
  VarDeclAst,
  WhileAst
} from "./ast-nodes";
import type { SymbolEntry } from "./scope";
import { ScopeNode } from "./scope";
import type { SemanticLogger } from "./semantic-logger";

export interface ScopeAnalysisState {
  /** Outermost program scope (id 0). */
  rootScope: ScopeNode;
  /** Declarations encountered in a single depth-first in-order walk (for symbol table output). */
  symbolsInOrder: SymbolEntry[];
}

/**
 * Resolve `name` starting at `scope`, walking parents until found or exhausted.
 */
export function lookupInChain(scope: ScopeNode | null, name: string): SymbolEntry | undefined {
  let s: ScopeNode | null = scope;
  while (s !== null) {
    const hit = s.symbols.get(name);
    if (hit !== undefined) {
      return hit;
    }
    s = s.parent;
  }
  return undefined;
}

/**
 * Phase B: one depth-first in-order AST pass — scopes, declarations, name resolution,
 * types, assignment init/use flags, and deferred unused/uninit warnings.
 */
export function analyzeScopes(
  ast: BlockAst,
  log: SemanticLogger,
  diagnostics: Diagnostic[]
): ScopeAnalysisState {
  const visitor = new ScopePhaseVisitor(log, diagnostics);
  visitor.visitRootProgramBlock(ast);
  return {
    rootScope: visitor.rootScope,
    symbolsInOrder: visitor.symbolsInOrder
  };
}

class ScopePhaseVisitor {
  readonly symbolsInOrder: SymbolEntry[] = [];
  rootScope!: ScopeNode;
  private current!: ScopeNode;

  constructor(
    private readonly log: SemanticLogger,
    private readonly diagnostics: Diagnostic[]
  ) {}

  visitRootProgramBlock(block: BlockAst): void {
    this.rootScope = new ScopeNode(null, 0);
    this.current = this.rootScope;
    this.log.debug("Phase B: initialize scope — root block is scope 0");

    for (const m of block.members) {
      this.visitMember(m);
    }

    this.emitDeferredWarnings();
    this.log.debug("Phase B: finished in-order traversal (current back at root scope0)");
  }

  private emitDeferredWarnings(): void {
    for (const sym of this.symbolsInOrder) {
      if (!sym.isUsed && !sym.isInitialized) {
        this.pushWarning(
          sym.declaredAt.line,
          sym.declaredAt.column,
          `Variable '${sym.name}' is declared but never used. Remove the declaration or reference it in an assignment, print, or expression.`
        );
      } else if (sym.isInitialized && !sym.isUsed) {
        this.pushHint(
          sym.declaredAt.line,
          sym.declaredAt.column,
          `Variable '${sym.name}' is assigned a value but that value is never read elsewhere. Remove dead assignments or use the value in a print or expression.`
        );
      }
    }
  }

  private visitMember(m: BlockMember): void {
    switch (m.kind) {
      case "Block":
        this.visitNestedBlock(m);
        break;
      case "VarDecl":
        this.visitVarDecl(m);
        break;
      case "Assign":
        this.visitAssign(m);
        break;
      case "Print":
        this.visitPrint(m);
        break;
      case "While":
        this.visitWhile(m);
        break;
      case "If":
        this.visitIf(m);
        break;
      default: {
        const _exhaustive: never = m;
        return _exhaustive;
      }
    }
  }

  private visitNestedBlock(block: BlockAst): void {
    const parent = this.current;
    const childId = parent.scopeId + 1;
    const child = new ScopeNode(parent, childId);
    this.current = child;
    this.log.debug(`Phase B: enter block — new scope ${childId}`);

    for (const inner of block.members) {
      this.visitMember(inner);
    }

    this.log.debug(`Phase B: exit block — leave scope ${childId}`);
    this.current = parent;
  }

  private visitVarDecl(m: VarDeclAst): void {
    const { name, namePosition, varType } = m;
    if (this.current.symbols.has(name)) {
      const prev = this.current.symbols.get(name)!;
      const msg =
        `Redeclaration of '${name}' in the same scope (scope ${this.current.scopeId}). ` +
        `This name is already declared at line ${prev.declaredAt.line}, column ${prev.declaredAt.column}. ` +
        `Use a different identifier in this block, or remove the duplicate declaration.`;
      this.pushError(namePosition.line, namePosition.column, msg);
      return;
    }

    const entry: SymbolEntry = {
      name,
      type: varType,
      isInitialized: false,
      isUsed: false,
      scopeId: this.current.scopeId,
      declaredAt: namePosition
    };
    this.current.symbols.set(name, entry);
    this.symbolsInOrder.push(entry);
    this.log.debug(
      `Phase B: add symbol ${name} | ${entry.type}, ${entry.isInitialized}, ${entry.isUsed} (scope ${entry.scopeId})`
    );
  }

  private visitAssign(m: AssignAst): void {
    const lhs = lookupInChain(this.current, m.target);
    if (lhs === undefined) {
      this.pushError(
        m.targetPosition.line,
        m.targetPosition.column,
        `Undeclared identifier '${m.target}'. Declare '${m.target}' with int, string, or boolean before assigning to it, or fix the spelling.`
      );
      this.exprType(m.value);
      return;
    }

    const rhsType = this.exprType(m.value);
    if (rhsType === null) {
      return;
    }

    if (lhs.type !== rhsType) {
      this.pushError(
        m.targetPosition.line,
        m.targetPosition.column,
        `Type mismatch: cannot assign a ${rhsType} value to '${m.target}', which has type ${lhs.type}. ` +
          `This language requires identical types with no implicit conversions. Change the expression or the declared type.`
      );
      return;
    }

    lhs.isInitialized = true;
    this.log.debug(`Phase B: assignment to '${m.target}' marks initialized`);
  }

  private visitPrint(m: PrintAst): void {
    this.exprType(m.argument);
  }

  private visitWhile(m: WhileAst): void {
    const t = this.exprType(m.condition);
    if (t !== null && t !== "boolean") {
      const pos = this.exprAnchor(m.condition);
      this.pushError(
        pos.line,
        pos.column,
        `While condition must have type boolean, but this expression has type ${t}. Use a comparison or boolean literal.`
      );
    }
    this.visitNestedBlock(m.body);
  }

  private visitIf(m: IfAst): void {
    const t = this.exprType(m.condition);
    if (t !== null && t !== "boolean") {
      const pos = this.exprAnchor(m.condition);
      this.pushError(
        pos.line,
        pos.column,
        `If condition must have type boolean, but this expression has type ${t}. Use a comparison or boolean literal.`
      );
    }
    this.visitNestedBlock(m.body);
  }

  private exprAnchor(e: ExprAst): { line: number; column: number } {
    switch (e.kind) {
      case "IntLiteral":
      case "StringLiteral":
      case "BoolLiteral":
      case "IntAdd":
      case "BooleanBinary":
      case "Id":
        return e.position;
      default: {
        const _never: never = e;
        return _never;
      }
    }
  }

  /**
   * Type-check expression, resolve identifiers (mark reads), return type or null after errors.
   */
  private exprType(e: ExprAst): LanguageType | null {
    switch (e.kind) {
      case "IntLiteral":
        return "int";
      case "StringLiteral":
        return "string";
      case "BoolLiteral":
        return "boolean";
      case "Id":
        return this.markIdRead(e);
      case "IntAdd": {
        const left = this.exprType(e.left);
        const right = this.exprType(e.right);
        if (left === null || right === null) {
          return null;
        }
        if (left !== "int" || right !== "int") {
          this.pushError(
            e.position.line,
            e.position.column,
            `Integer addition requires int operands on both sides; found ${left} and ${right}. ` +
              `Use only digits and '+' chains, or fix operand types.`
          );
          return null;
        }
        return "int";
      }
      case "BooleanBinary": {
        const left = this.exprType(e.left);
        const right = this.exprType(e.right);
        if (left === null || right === null) {
          return null;
        }
        if (left !== right) {
          this.pushError(
            e.position.line,
            e.position.column,
            `Equality and inequality require both operands to have the same type; found ${left} and ${right}. ` +
              `Compare values of one type only, or convert your design to match the grammar.`
          );
          return null;
        }
        return "boolean";
      }
      default: {
        const _never: never = e;
        return _never;
      }
    }
  }

  private markIdRead(id: IdExpr): LanguageType | null {
    const sym = lookupInChain(this.current, id.name);
    if (sym === undefined) {
      this.pushError(
        id.position.line,
        id.position.column,
        `Undeclared identifier '${id.name}'. Declare '${id.name}' before use or fix the spelling.`
      );
      return null;
    }

    if (!sym.isInitialized && !sym.warnedUninitRead) {
      sym.warnedUninitRead = true;
      this.pushWarning(
        id.position.line,
        id.position.column,
        `Variable '${id.name}' is used before it has been assigned a value. Assign to '${id.name}' before this use, or initialize it at declaration.`
      );
    }

    sym.isUsed = true;
    this.log.debug(
      `Phase B: lookup '${id.name}' -> ${sym.type} (scope ${sym.scopeId}); mark used`
    );
    return sym.type;
  }

  private pushError(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      line,
      column,
      message
    });
    this.log.errorLine(line, column, message);
  }

  private pushWarning(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      line,
      column,
      message
    });
    this.log.warnLine(line, column, message);
  }

  private pushHint(line: number, column: number, message: string): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Hint,
      line,
      column,
      message
    });
    this.log.hintLine(line, column, message);
  }
}
