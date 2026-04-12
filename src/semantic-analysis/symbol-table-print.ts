import type { SymbolEntry } from "./scope";
import type { SemanticLogger } from "./semantic-logger";

/**
 * Human-readable symbol table (course layout). Only call when semantic **error** count is 0.
 */
export function printSymbolTable(
  programNumber: number,
  entries: readonly SymbolEntry[],
  log: SemanticLogger
): void {
  log.info(`Printing symbol table for program ${programNumber}...`);
  console.log("NAME TYPE       isINIT?   isUSED?   SCOPE");
  for (const s of entries) {
    const nameCol = s.name.padEnd(3, " ");
    const typeCol = s.type.padEnd(8, " ");
    const initCol = String(s.isInitialized).padEnd(9, " ");
    const usedCol = String(s.isUsed).padEnd(9, " ");
    console.log(`[${nameCol} ${typeCol} ${initCol} ${usedCol} ${s.scopeId}]`);
  }
}
