# TypeScript Compiler (Lexer + Parser)

Course project for CMPT 432 at Marist University.

This repository implements the **front end** of a small compiler: a table-driven **lexer** and a **recursive-descent parser** that consume source programs (several per file, separated by `$`), emit diagnostics, and print a **concrete syntax tree (CST)** when parsing succeeds. The language is defined in `[cursor-only/grammar.md` .

## Commands

### `npm start`

Lex and parse each program in the file (from the first significant character through the end-of-program marker `$`).

```bash
npm start -- [--quiet | --debug] <filePath>
```

- A `filePath` is required.
- Per-token traces are on by default. Use `--quiet` to hide `DEBUG Lexer` / `DEBUG Parser` lines while keeping `INFO`, warnings, errors, and hints.

Examples:

```bash
npm start -- test/files/parser-valid-mixed.txt
npm start -- --quiet test/files/parser-multi-program.txt
```

### `npm test`

Run the **lexer** suite (`test/run-lexer-tests.js`) and **parser** suite (`test/run-parser-tests.js`) after compiling TypeScript into `dist/`.

```bash
npm test
```

- `npm start` is for interactive runs and inspecting CSTs on sample files.
- `npm test` is the regression gate for both phases.

More detail: `[test/lex-test.md](test/lex-test.md)` (lexer), `[test/parse-test.md](test/parse-test.md)` (parser).

## Manual test files

Under `[test/files/](test/files/)`:

- `**parser-*.txt**` — curated samples for the **current grammar** (valid programs, multi-program layouts, and a few intentional parse errors). See the list in `[test/parse-test.md](test/parse-test.md)`.
- `**testStep4.txt`–`testStep7.txt`**, `**test.txt`** — milestone-style inputs from earlier development; not all lines match today’s grammar (use `parser-*.txt` for predictable parser outcomes).
- `**testStep9*.txt**` — lexer-focused regression-style samples (valid input, errors, missing `$`, unterminated comment).

## Current features

**Lexer**

- DFA-driven scanning (keywords, types, booleans, operators, parentheses, braces, strings, per-digit digits, single-letter identifiers)
- Block comments `/* … */` with unterminated-comment warnings
- Multi-program sources (each segment ends at `$`)
- Detailed errors and optional warnings (e.g. missing final `$`)
- Verbose and quiet CLI modes

**Parser**

- Recursive descent aligned with `[cursor-only/grammar.md](cursor-only/grammar.md)`: programs, blocks, statement lists, `print`, declarations, assignments, `while` / `if` (with `BooleanExpr` conditions), and expressions (`IntExpr`, strings, parenthesized comparisons, identifiers)
- **CST** is built during parsing with the `[Tree](src/parser/tree.ts)` API (`addNode`, `endChildren`; `"branch"` vs `"leaf"`). Pretty-printing matches the prior hyphen-depth style (`printProgramCst`).
- CST output only when there are **no parse errors**
- Errors, warnings, and hints (see `[cursor-only/parseRequirements.md](cursor-only/parseRequirements.md)`); parse failures skip CST output for that program
- Skips parsing when the lexer reported errors for the same program segment
- Default verbose `DEBUG Parser` traces (toggle with CLI flags above)

**Tests**

- Automated lexer and parser regression tests via `npm test`

