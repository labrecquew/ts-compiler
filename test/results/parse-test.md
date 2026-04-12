# Parser Test Notes

Automated parser regression tests in [`run-parser-tests.js`](run-parser-tests.js), using the same `npm test` entrypoint as the lexer (see [`lex-test.md`](lex-test.md)).

## How to run

```bash
npm test
```

This rebuilds the project, runs [`run-lexer-tests.js`](run-lexer-tests.js), [`run-parser-tests.js`](run-parser-tests.js), then the semantic suite [`run-semantic-tests.js`](run-semantic-tests.js).

## Requirements

Course expectations for the parser phase (CST, multi-program, error/hint/warning levels, verbose default, no CST on error) are in [`cursor-only/parseRequirements.md`](../cursor-only/parseRequirements.md). The CST is built with the [`Tree`](../src/parser/tree.ts) class (`addNode` / `endChildren`).

## Grammar reference

Productions and tokens are defined in [`cursor-only/grammar.md`](../cursor-only/grammar.md). Parser traces and CST shape examples (legacy `PARSER:` prefix in places) appear in [`cursor-only/parseExamples.txt`](../cursor-only/parseExamples.txt). Lexer log polish examples: [`cursor-only/output1.txt`](../cursor-only/output1.txt) through [`cursor-only/output4.txt`](../cursor-only/output4.txt).

## Coverage summary

The parser suite checks:

- Minimal `Program` / `Block` / `StatementList` (including nested empty blocks)
- Block comments before code
- Failure when `$` appears inside an unclosed block (no CST printed)
- Multiple programs separated by `$` in one source string
- **Statements:** nested `Block`, `print ( Expr )`, `type Id`, `Id = Expr`, `while BooleanExpr Block`, `if BooleanExpr Block`
- **Expressions:** `IntExpr` (per-lexer-digit, optional `+` and right-associated `Expr`), `StringExpr` with `CharList`, `BooleanExpr` as boolval or `( Expr boolop Expr )`, `Id`
- **Diagnostics:** detailed errors (illegal statement/Boolean starts, missing tokens), **hint** for empty string literal `""`, **warning** when `==` appears where assignment `=` was expected after an identifier
- Extraneous tokens after `EOP` when the parser is given an extended token list (guards misuse; the lexer stops each program at the first `$`)
- Skipping parse when the lexer reported errors for that program (same message family as [`src/lexer/cli.ts`](../src/lexer/cli.ts))
- `DEBUG Parser` traces for major productions when `debug` is enabled

## Manual samples

Use `npm start -- path\to\file.txt` (add `--quiet` to hide `DEBUG` traces).

**Parser-focused** (grammar-valid unless labeled invalid):

- [`files/parser-valid-mixed.txt`](files/parser-valid-mixed.txt) — declarations, assignments, `print`, strings, booleans, `if` / `while`
- [`files/parser-multi-program.txt`](files/parser-multi-program.txt) — two programs in one file (`$` separator)
- [`files/parser-empty-string.txt`](files/parser-empty-string.txt) — valid parse with a parser-level **hint**
- [`files/parser-invalid-while-id.txt`](files/parser-invalid-while-id.txt) — **parse error**: `while` with a bare identifier (not a `BooleanExpr`)
- [`files/parser-invalid-print-noparen.txt`](files/parser-invalid-print-noparen.txt) — **parse error**: `print` without `(` … `)`
- [`files/parser-warning-assign-eqeq.txt`](files/parser-warning-assign-eqeq.txt) — **warning + error**: `==` where `=` is required for assignment

**Older milestone files** ([`files/testStep4.txt`](files/testStep4.txt) … [`testStep7.txt`](files/testStep7.txt), [`files/test.txt`](files/test.txt)) are still fine for lexer and informal typing, but they mix styles (e.g. `print` without parentheses) that do not match the current grammar — use the `parser-*.txt` set when you want predictable parser outcomes.

Automated expectations remain in [`run-parser-tests.js`](run-parser-tests.js); manual files are for exploration and demos.

## Latest run

```text
npm test

...

Passed 19/19 parser tests.
```

## Notes

- Boolean conditions on `while` / `if` must be `true`/`false` or a parenthesized `Expr boolop Expr`, not a bare identifier (per grammar).
- Integer literals are one `digit` token per grammar arm; multi-digit sequences without `+` between arms are rejected in expression contexts.
- Warnings and hints do not fail the parse; the CST is still printed when there are zero **errors**.
