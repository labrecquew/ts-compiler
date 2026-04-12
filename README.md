# TypeScript Compiler (Lexer + Parser + Semantic Analysis)

Course project for CMPT 432 at Marist University.

This repository implements the **front end** of a small compiler: a table-driven **lexer**, a **recursive-descent parser**, and **semantic analysis** (AST from tokens, static scopes, symbol table, type checks, and diagnostics). Programs may appear several per file, separated by `$`. The language is defined in [`cursor-only/grammar.md`](cursor-only/grammar.md).

## Commands

### `npm start`

Lex, parse, and run semantic analysis on each program in the file (from the first significant character through the end-of-program marker `$`).

```bash
npm start -- [--quiet | --debug] <filePath>
```

- A `filePath` is required.
- Per-token traces are on by default. Use `--quiet` to hide `DEBUG Lexer` / `DEBUG Parser` / `DEBUG SemanticAnalysis` lines while keeping `INFO`, warnings, errors, and hints.

Examples:

```bash
npm start -- test/files/parser-valid-mixed.txt
npm start -- --quiet test/files/semantic-golden-input.txt
```

### `npm test`

Run the **lexer**, **parser**, and **semantic analysis** regression suites after compiling TypeScript into `dist/`.

```bash
npm test
```

- `npm start` is for interactive runs and inspecting CSTs, ASTs, and symbol tables on sample files.
- `npm test` is the full regression gate for all three phases.

More detail: [`test/lex-test.md`](test/lex-test.md) (lexer), [`test/parse-test.md`](test/parse-test.md) (parser), [`test/semantic-test.md`](test/semantic-test.md) (semantic analysis).

**Semantic tests only:** `npm run test:semantic` (same pattern as lexer/parser: one driver file [`test/run-semantic-tests.js`](test/run-semantic-tests.js)).

## Manual test files

Under [`test/files/`](test/files/):

- **`parser-*.txt`** — curated samples for the **current grammar** (valid programs, multi-program layouts, and a few intentional parse errors). See [`test/parse-test.md`](test/parse-test.md).
- **`semantic-*.txt`** — semantic regression inputs (e.g. [`semantic-golden-input.txt`](test/files/semantic-golden-input.txt) and [`semantic-golden-alt-nested.txt`](test/files/semantic-golden-alt-nested.txt) for nested blocks, plus redeclaration, shadowing, errors, multi-program). See [`test/semantic-test.md`](test/semantic-test.md).
- **`testStep4.txt`–`testStep7.txt`**, **`test.txt`** — milestone-style inputs from earlier development; not all lines match today’s grammar (use `parser-*.txt` for predictable parser outcomes).
- **`testStep9*.txt`** — lexer-focused regression-style samples (valid input, errors, missing `$`, unterminated comment).

## Current features

**Lexer**

- DFA-driven scanning (keywords, types, booleans, operators, parentheses, braces, strings, per-digit digits, single-letter identifiers)
- Block comments `/* … */` with unterminated-comment warnings
- Multi-program sources (each segment ends at `$`)
- Detailed errors and optional warnings (e.g. missing final `$`)
- Verbose and quiet CLI modes

**Parser**

- Recursive descent aligned with [`cursor-only/grammar.md`](cursor-only/grammar.md): programs, blocks, statement lists, `print`, declarations, assignments, `while` / `if` (with `BooleanExpr` conditions), and expressions (`IntExpr`, strings, parenthesized comparisons, identifiers)
- **CST** is built during parsing with the [`Tree`](src/parser/tree.ts) API (`addNode`, `endChildren`; `"branch"` vs `"leaf"`). Pretty-printing matches the prior hyphen-depth style (`printProgramCst`).
- CST output only when there are **no parse errors**
- Errors, warnings, and hints (see [`cursor-only/parseRequirements.md`](cursor-only/parseRequirements.md)); parse failures skip CST output for that program
- Skips parsing when the lexer reported errors for the same program segment
- Default verbose `DEBUG Parser` traces (toggle with CLI flags above)

**Semantic analysis**

- **Phase A:** rebuild an **AST** from the token stream (see [`cursor-only/semanticAnalysisExamples.txt`](cursor-only/semanticAnalysisExamples.txt) for shape).
- **Phase B:** one depth-first in-order traversal — static **scopes** (tree of hash tables), **name resolution**, **types** (assignment and `boolop` rules, `if`/`while` conditions), **warnings/hints** (unused, use-before-init, assigned-but-never-read).
- **Symbol table** printed when there are **no semantic errors**; suppressed when semantic errors occur (see [`cursor-only/semanticAnalysisRequirements.md`](cursor-only/semanticAnalysisRequirements.md)).
- Skipped when lexing or parsing failed for that program; state resets between `$`-separated programs.
- Verbose `DEBUG SemanticAnalysis` traces unless `--quiet` is set.

**Tests**

- Automated lexer, parser, and semantic regression tests via `npm test`
