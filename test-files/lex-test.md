# Lexer Test Notes

Automated lexer test suite plus extra source fixtures in `test-files/`.

## How To Run

```bash
npm test
```

This command rebuilds the project and runs `tests/run-lexer-tests.js`.

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

## Added Fixture Files

- `test-files/testStep9Valid.txt`
- `test-files/testStep9Errors.txt`
- `test-files/testStep9MissingEop.txt`
- `test-files/testStep9UnterminatedComment.txt`

These are intended as manual spot-check files in the same spirit as the earlier step files, but the redundant cases were trimmed so they now focus on scenarios not already covered as cleanly by the earlier milestone files.

## Result

Latest run:

```text
npm test

PASS lexes simple block delimiters
PASS ignores block comments
PASS covers keywords, booleans, parentheses, and operators
PASS lexes strings and per-digit integer tokens
PASS reports invalid characters as lexer errors
PASS warns when the final end-of-program marker is missing
PASS warns about unterminated comments
PASS reports unterminated strings
PASS rejects a standalone bang operator
PASS rejects multi-letter identifiers
PASS rejects slash and star outside valid grammar contexts
PASS supports quiet CLI mode without debug traces
PASS keeps verbose CLI mode as the default
Passed 13/13 lexer tests.
```

## Notes

- The earlier step files are still useful as small manual sanity checks.
- The Step 9 fixture files were reduced to keep only the less redundant regression-oriented manual cases.
- The automated suite focuses on lexer behavior only; it does not attempt parser validation.
