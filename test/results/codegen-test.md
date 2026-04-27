# Code Generation Test Notes

Automated code-generation regression tests live in [`run-codegen-tests.js`](../run-codegen-tests.js), using the same `npm test` entrypoint as lexer, parser, and semantic analysis.

## How to run

```bash
npm test
```

Codegen suite only:

```bash
npm run test:codegen
```

## Requirements

Course expectations for code generation are in [`cursor-only/codeGenRequirements.txt`](../../cursor-only/codeGenRequirements.txt). The opcode set and worked loop/string examples are in [`cursor-only/6502a-instruction-set.md`](../../cursor-only/6502a-instruction-set.md), with byte-by-byte traces in [`cursor-only/codeGenExamples.txt`](../../cursor-only/codeGenExamples.txt).

## Coverage summary

The codegen suite checks:

- Empty block emits a `BRK` and a zero-filled 256-byte image.
- `{ int i i = 5 print(i) }$` matches the Example 1 byte layout and static backpatching.
- `Id = Id` assignment chains load from the source static address and store to the destination.
- Boolean assignment stores `true` / `false` as `01` / `00` and prints through integer/boolean mode.
- String assignment writes null-terminated heap bytes, stores a static pointer, and `print(s)` loads Y through that pointer slot.
- String reassignment leaves old heap bytes in place while updating the static pointer to the latest string.
- Direct string literal print uses an immediate heap address in Y.
- Shadowed variables receive distinct static data rows.
- `if ==` and `if !=` emit and patch branch distances.
- `while` emits a backward `BNE` with one-byte wraparound.
- Multiple `$`-separated programs reset codegen state.
- Oversized string/heap data reports a codegen error and suppresses the image dump.
- Semantic errors skip code generation in the CLI-style pipeline.

## Manual samples

Use `npm start -- test\files\codegen-int-print.txt` or add `--quiet` to suppress `DEBUG` traces. Fixture files are named `codegen-*.txt` under [`test/files`](../files).

## Notes

- Code generation only runs when lexing, parsing, and semantic analysis all report zero errors for that program segment.
- The final image prints 32 rows of 8 bytes with no row-address prefix. In-progress debug traces may show placeholders such as `T0 XX` or `J0`; final images must not.
