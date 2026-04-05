# TypeScript Compiler Lexer

Course project for CMPT 432 at Marist University.

This repository contains a DFA table-driven lexer for a small compiler language. The lexer reads source code, validates it against the language grammar, and prints token/debug information, warnings, and lexer errors.

## Commands

### `npm start`

Use `npm start` to lex and parse source programs (full front-end for each program segment ending with `$`).

```bash
npm start -- [--quiet | --debug] <filePath>
```

- A `filePath` is required.
- `--debug` keeps token tracing on. This is the default behavior that will run if --quiet or --debug is not specified.
- `--quiet` suppresses per-token `DEBUG` lines, but still shows `INFO`, warnings, and errors.

Examples:

```bash
npm start -- test/files/testStep6.txt
npm start -- --quiet test/files/testStep6.txt
npm start -- --debug test/files/testStep6.txt
```

### `npm test`

Use `npm test` to run the lexer and parser regression suites.

```bash
npm test
```

This:

1. Builds the TypeScript project into `dist/`
2. Runs `test/run-lexer-tests.js`
3. Runs `test/run-parser-tests.js`

So the difference is:

- `npm start` lexes and parses each program in the given file
- `npm test` checks lexer and parser behavior against the bundled tests

## Manual Test Files

The `test/files/` folder contains sample programs used for step-by-step development and manual testing.

- `testStep4.txt` through `testStep7.txt` and `test.txt` are milestone-oriented manual inputs
- `testStep9Valid.txt`, `testStep9Errors.txt`, `testStep9MissingEop.txt`, and `testStep9UnterminatedComment.txt` are broader regression-oriented samples

## Current Features

- Table-driven DFA lexer structure
- Multi-program input separated by `$`
- Verbose and quiet CLI modes
- Comments with unterminated-comment warnings
- Strings, digits, identifiers, keywords, operators, and delimiters
- Detailed lexer error reporting
- Recursive-descent parser with CST output (Step 2: programs and nested blocks; more statements in later steps)
- Automated lexer and parser regression tests