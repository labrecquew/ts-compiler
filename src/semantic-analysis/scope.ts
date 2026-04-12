import type { LanguageType } from "./language-type";
import type { SourcePosition } from "../lexer/tokens";

/**
 * One row in the per-scope symbol map. `isInitialized` / `isUsed` are updated during
 * the Phase B traversal (assignment sites vs read contexts).
 */
export interface SymbolEntry {
  name: string;
  type: LanguageType;
  isInitialized: boolean;
  isUsed: boolean;
  /** Matches printed `SCOPE` column (outermost block = 0). */
  scopeId: number;
  declaredAt: SourcePosition;
}

/**
 * Tree of hash tables: each `{ ... }` gets a child scope; lookup walks parentward.
 * Invariant: `scopeId` increases by 1 for each nesting level from the program root.
 */
export class ScopeNode {
  constructor(
    readonly parent: ScopeNode | null,
    readonly scopeId: number,
    readonly symbols: Map<string, SymbolEntry> = new Map()
  ) {}
}
