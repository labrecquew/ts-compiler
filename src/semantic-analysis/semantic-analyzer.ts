import type { Token } from "../lexer/tokens";
import { DiagnosticSeverity, type Diagnostic } from "../parser/diagnostics";
import { buildAstFromTokens } from "./ast-builder";
import { formatAstLines } from "./ast-print";
import type { AstRoot } from "./ast-nodes";
import { analyzeScopes, type ScopeAnalysisState } from "./scope-analysis";
import { SemanticLogger } from "./semantic-logger";
import { printSymbolTable } from "./symbol-table-print";

export interface SemanticAnalyzerOptions {
  /** When true, suppress DEBUG lines (aligns with lexer/parser `--quiet`). */
  quiet?: boolean;
}

export interface SemanticRunResult {
  /** Present when Phase A completed without throwing (Phase B may add diagnostics later). */
  ast: AstRoot | null;
  /** Present after a successful Phase A run once Phase B scope walk has executed. */
  scopeState: ScopeAnalysisState | null;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  hintCount: number;
}

/**
 * Orchestrates Phase A (tokens → AST) and Phase B (single DF in-order AST pass for
 * scopes, symbols, and types). Type checks and full name resolution come in later steps.
 */
export class SemanticAnalyzer {
  run(
    tokens: readonly Token[],
    programNumber: number,
    options: SemanticAnalyzerOptions = {}
  ): SemanticRunResult {
    const debugEnabled = !options.quiet;
    const log = new SemanticLogger(debugEnabled);
    const diagnostics: Diagnostic[] = [];

    log.info(`Starting semantic analysis for program ${programNumber}...`);
    log.debug(`Phase A: building AST from ${tokens.length} token(s)`);

    let ast: AstRoot | null = null;
    let scopeState: ScopeAnalysisState | null = null;
    try {
      ast = buildAstFromTokens(tokens, log);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const pos = tokens[0]?.position ?? { line: 1, column: 1, index: 0 };
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        line: pos.line,
        column: pos.column,
        message: msg
      });
      log.errorLine(pos.line, pos.column, msg);
    }

    if (ast !== null) {
      log.info(`Printing AST for program ${programNumber}...`);
      for (const line of formatAstLines(ast)) {
        console.log(line);
      }

      log.debug("Phase B: depth-first in-order scope traversal");
      scopeState = analyzeScopes(ast, log, diagnostics);
    }

    const errorCount = countSeverity(diagnostics, DiagnosticSeverity.Error);
    const warningCount = countSeverity(diagnostics, DiagnosticSeverity.Warning);
    const hintCount = countSeverity(diagnostics, DiagnosticSeverity.Hint);

    if (errorCount === 0 && scopeState !== null) {
      printSymbolTable(programNumber, scopeState.symbolsInOrder, log);
    }

    if (errorCount === 0) {
      log.info(
        `Semantic analysis completed with ${errorCount} error(s), ${warningCount} warning(s), and ${hintCount} hint(s)`
      );
    } else {
      log.semanticFailed(errorCount);
    }

    return {
      ast,
      scopeState,
      diagnostics,
      errorCount,
      warningCount,
      hintCount
    };
  }
}

function countSeverity(diagnostics: readonly Diagnostic[], severity: DiagnosticSeverity): number {
  return diagnostics.filter((d) => d.severity === severity).length;
}
