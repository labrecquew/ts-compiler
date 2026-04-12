# Semantic Analysis Test Notes

Automated semantic regression tests in [`run-semantic-tests.js`](run-semantic-tests.js), using the same `npm test` entrypoint as the lexer and parser (see [`lex-test.md`](lex-test.md) and [`parse-test.md`](parse-test.md)).

## How to run

```bash
npm test
```

This rebuilds the project, runs [`run-lexer-tests.js`](run-lexer-tests.js), [`run-parser-tests.js`](run-parser-tests.js), then the semantic suite [`run-semantic-tests.js`](run-semantic-tests.js).

Semantic suite only (after a build):

```bash
npm run test:semantic
```

## Requirements

Course expectations for the semantic phase (static scopes, symbol table, types, errors vs warnings vs hints, symbol table suppression on semantic errors) are in [`cursor-only/semanticAnalysisRequirements.md`](../cursor-only/semanticAnalysisRequirements.md).

## Grammar reference

Productions and types follow [`cursor-only/grammar.md`](../cursor-only/grammar.md). Golden AST layout and symbol table examples appear in [`cursor-only/semanticAnalysisExamples.txt`](../cursor-only/semanticAnalysisExamples.txt). Parser/CST coverage and manual parser samples are in [`parse-test.md`](parse-test.md).

## Coverage summary

The semantic suite checks:

- **Phase A (AST)** — token-driven AST matches the strict pretty-print shape for the nested-block golden program ([`files/semantic-golden-input.txt`](files/semantic-golden-input.txt))
- **Scopes** — declaration order and scope ids (`a` / `b` / `c` at scopes 0 / 1 / 2); same-scope **redeclaration** error; **shadowing** across nested blocks; `lookupInChain` walking parent scopes
- **End-to-end** — [`SemanticAnalyzer`](../src/semantic-analysis/semantic-analyzer.ts): symbol table rows on success; **no** symbol table when semantic **errors** occur (undeclared identifier, assignment type mismatch, `boolop` operand types)
- **Alternate nested sample** — second nested program with different ids and literals ([`files/semantic-golden-alt-nested.txt`](files/semantic-golden-alt-nested.txt))
- **Multi-program** — two `$`-separated programs in one file ([`files/semantic-multi-valid.txt`](files/semantic-multi-valid.txt)); fresh analyzer per program

## Manual samples

Use `npm start -- path\to\file.txt` (add `--quiet` to hide `DEBUG` traces).

**Semantic-focused** (grammar-valid unless labeled invalid):

- [`files/semantic-golden-input.txt`](files/semantic-golden-input.txt) — nested blocks; golden AST/symbol table shape
- [`files/semantic-golden-alt-nested.txt`](files/semantic-golden-alt-nested.txt) — same structure as above, different names and literals
- [`files/semantic-multi-valid.txt`](files/semantic-multi-valid.txt) — two programs in one file (`$` separator)
- [`files/semantic-shadow-ok.txt`](files/semantic-shadow-ok.txt) — valid shadowing (inner `a` vs outer `a`)
- [`files/semantic-redeclare-same-scope.txt`](files/semantic-redeclare-same-scope.txt) — **semantic error**: duplicate name in one scope
- [`files/semantic-undeclared-use.txt`](files/semantic-undeclared-use.txt) — **semantic error**: undeclared id in `print`
- [`files/semantic-type-mismatch.txt`](files/semantic-type-mismatch.txt) — **semantic error**: assign bool to `int`
- [`files/semantic-boolop-mismatch.txt`](files/semantic-boolop-mismatch.txt) — **semantic error**: `==` with mismatched operand types

Parser-focused samples remain under `parser-*.txt`; see [`parse-test.md`](parse-test.md).

Automated expectations remain in [`run-semantic-tests.js`](run-semantic-tests.js); manual files are for exploration and demos.

## Latest run

```text
npm test

...

Passed 11/11 semantic tests.
```

## Notes

- For each program segment (source through `$`), the CLI runs **lex → parse → semantic analysis** only when earlier stages succeed. On lex or parse failure, semantic analysis is skipped and an `INFO  SemanticAnalysis - Skipping …` line is printed.
- Semantic **errors** suppress the type/scope symbol table; **warnings** and **hints** alone do not.
- Assignment requires **identical** LHS/RHS types (no implicit conversions). `boolop` comparisons require both operands to have the same type.
