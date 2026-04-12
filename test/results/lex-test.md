# Lexer Test Notes

Automated lexer test suite plus shared input files in [`files/`](files/).

## How To Run

```bash
npm test
```

This command rebuilds the project, runs [`run-lexer-tests.js`](run-lexer-tests.js), [`run-parser-tests.js`](run-parser-tests.js), and [`run-semantic-tests.js`](run-semantic-tests.js). Parser-focused notes live in [`parse-test.md`](parse-test.md); semantic notes in [`semantic-test.md`](semantic-test.md).

## Coverage Summary

The suite currently checks:

- Valid delimiter programs, including nested blocks
- Block comments being ignored
- All keyword-style tokens currently implemented: `print`, `if`, `while`, `true`, `false`
- All declaration types mapping to `I_TYPE`: `int`, `string`, `boolean`
- Parentheses tokens: `OPEN_PAREN`, `CLOSE_PAREN`
- Operators: `=`, `==`, `!=`, `+`
- Identifiers, per-digit integer lexing, quoted strings, chars, and string spaces
- Error cases: invalid character, invalid standalone `!`, invalid multi-letter identifier, invalid `/`, invalid `*`, unterminated string
- Warning cases: missing final `$`, unterminated comment
- CLI verbosity behavior for default debug mode and `--quiet`

## Input files

- [`files/testStep9Valid.txt`](files/testStep9Valid.txt)
- [`files/testStep9Errors.txt`](files/testStep9Errors.txt)
- [`files/testStep9MissingEop.txt`](files/testStep9MissingEop.txt)
- [`files/testStep9UnterminatedComment.txt`](files/testStep9UnterminatedComment.txt)

Additional milestone-style samples: [`files/test.txt`](files/test.txt), `testStep4.txt` … `testStep7.txt`. **`test.txt`** mirrors [parseExamples.txt](../../cursor-only/parseExamples.txt): program 2 is seven nested empty blocks; program 3 has **one extra `}`** before `$` so the parser reports failure (no CST) like program 3 in the examples.

These are intended as manual spot-check files in the same spirit as the earlier step files, but the redundant cases were trimmed so they now focus on scenarios not already covered as cleanly by the earlier milestone files.

## Result

Latest run:

```text
npm test

...

Passed 13/13 lexer tests.
```

## Notes

- The earlier step files are still useful as small manual sanity checks.
- The Step 9 files under `files/` were reduced to keep only the less redundant regression-oriented manual cases.
- Parser regression tests live in [`run-parser-tests.js`](run-parser-tests.js); see [`parse-test.md`](parse-test.md) for full grammar-aligned coverage (statements, expressions, control flow, diagnostics, multi-program behavior).
