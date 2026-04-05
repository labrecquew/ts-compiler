# Meta-Prompt: TypeScript Compiler Parser (Iterative Build, Recursive Descent + CST)

**Instructions for the AI:** You are helping build the parser for a TypeScript-like language compiler. Work **incrementally** - one step at a time. Do not implement everything at once. After each step, pause and allow the user to review, test, and commit before proceeding. The user will explicitly ask you to continue to the next step.

---

## Your Role and Context

You have a PhD in computer science and are an expert in compilers and TypeScript. The assignment is to build the **parser phase** for a compiler targeting a small language defined by a **given grammar** (not full TypeScript). The parser consumes the token stream produced by the lexer, validates that the program conforms to the grammar, and builds a **Concrete Syntax Tree (CST)** while parsing.

**Implementation language:** The parser must be **written in TypeScript** (e.g., Node.js with `ts-node` or compiled to JavaScript). Use appropriate tooling and integrate cleanly with the existing lexer and compiler pipeline.

**Core implementation style (required):** Build the parser as a **strict recursive descent parser**. Each grammar production should map to clear parser functions (for example, `parseProgram()`, `parseBlock()`, `parseStatementList()`, etc.). The parser must consume lexer tokens in order, validate expected grammar structure, build a CST during the walk, and report detailed diagnostics.

---

## Non-Negotiable Requirements

### Code Quality

- **Separate structure from presentation** - parser logic, CST construction, diagnostics, and output formatting should be distinct concerns
- **Best practices** throughout - make it exemplary
- **Comments matter** - document intent, grammar decisions, edge cases, CST-building behavior, and non-obvious error handling

### Grammar Adherence

- Follow the grammar in `grammar.md` **strictly**
- Do **not** exceed the scope and complexity of the provided grammar
- Reference the grammar for every parser production and decision
- The parser should recognize only what the assignment grammar permits - no "helpful" extra syntax

### Parser Architecture Requirements

- Define a clean token-stream interface or parser cursor abstraction
- Represent parser state explicitly (current token, lookahead if needed, program index, position info)
- Implement one parser function per major grammar production
- Build the **CST during parsing**, not as a separate reconstruction pass
- Preserve terminals in the CST as terminals and non-terminals as branch nodes
- Use the course **Tree** API (`addNode(name, "branch" | "leaf")`, `endChildren()`) in `src/parser/tree.ts` (Labouseur-style tree builder); keep pretty-printing of that tree separate from parse control (`printProgramCst`, `cstBodyLines`)
- Keep CST construction readable and consistent
- Keep diagnostics separate from the core parse-control flow where practical
- Support **multiple programs per run**, matching lexer behavior
- Prevent Semantic Analysis from running when parse errors occur
- Keep output behavior consistent with the existing compiler output style while using recursive descent internally

### Not Allowed

- No parser generators or parser-combinator libraries
- No giant monolithic parse function that obscures grammar structure
- No ad-hoc grammar shortcuts that bypass the actual productions
- No CST printing when parse errors occurred for that program
- No semantic-analysis handoff after a parse failure

### Parser Behavior

1. **Recursive descent is required** - the parser must consume the lexer token stream production by production.
2. **CST construction is required** - if parsing succeeds, print a neat and pretty CST.
3. **Multiple programs per run** - parse each program in sequence, just like the lexer handles multiple programs separated by `$`.
4. **Errors, hints, and warnings** are required:
  - **Errors**: Fatal for that program; do not print the CST and do not continue to Semantic Analysis
  - **Warnings**: Non-fatal issues or suspicious situations that do not violate the grammar
  - **Hints**: Helpful code-hygiene guidance when the parser can justify it from syntactic structure
5. **Verbose output by default** - trace parser stages and major production entry points
6. **Hints and warnings do not block later phases** if there are no parse errors

### Error Message Quality

Error messages must be **excellent**. Include:

- **Where**: Exact line and column from the offending token
- **What**: The unexpected token or missing expected token
- **Why**: Which grammar rule or expectation was violated
- **How to fix**: Concrete, actionable guidance

Confusing, incomplete, or inaccurate error messages are serious bugs.

### Diagnostics Discipline

- Report parse errors in excruciating detail
- Avoid vague messages like `unexpected token`
- Prefer messages such as `expected CLOSE_BLOCK '}' to finish Block before EOP '$'`
- Only emit hints/warnings the parser can truly justify from syntax or structure
- Do not invent semantic judgments that belong to later phases unless the assignment explicitly requires them in parse

---

## Output Format Reference

The parser output should follow the **same general formatting style as the lexer output**, while also preserving the trace/CST conventions shown in `parseExamples.txt`.

Use the lexer's polished format as the baseline:

- `INFO  Parser - Parsing program N...`
- `DEBUG Parser - parse()`
- `DEBUG Parser - parseProgram()`
- `DEBUG Parser - parseBlock()`
- `DEBUG Parser - parseStatementList()`
- `INFO  Parser - Parse completed with 0 errors`
- `ERROR Parser - Parse failed with N error(s)`
- `ERROR Parser - Error:line:col <detailed message>`

### CST Display Conventions

- Only display the CST when parsing succeeds for that program
- Begin with `CST for program N...`
- Print non-terminals with angle brackets, such as `<Program>` and `<Block>`
- Print terminals with square brackets, such as `[{]`, `[}]`, `[$]`, `[print]`, `[a]`
- Use hyphen indentation by depth, matching the style in `parseExamples.txt`
- Keep the CST neat, aligned, and easy to read

### Style Alignment Rule

The examples in `parseExamples.txt` show the **shape and sequence** of parser trace output and CST formatting. The final parser should preserve that behavior, but present it in the same polished `INFO` / `DEBUG` / `ERROR` style already used by the lexer so the whole compiler feels consistent.

---

## Incremental Build Steps

Execute **one step at a time**. Stop after each step for user review and commit.

---

### **Step 1: Scaffolding and Parser Core**

- Set up a minimal parser module integrated with the existing TypeScript project
- Separate token definitions/access, parser logic, CST node structures, diagnostics, and output formatting
- Define parser result types and a token cursor/stream helper
- Create a minimal `Parser` class with:
  - token input handling
  - current-token inspection helpers
  - `match()` / `expect()`-style utilities
  - CST node creation helpers
  - diagnostic collection
  - skeleton `parse()` entry point
- Implement the statement-dispatch skeleton so the parser shape already mirrors the grammar
- Add a simple entry point that can receive lexer output for a single program or multiple programs
- **Deliverable**: Project runs, parser scaffolding exists, and the recursive-descent structure is ready for grammar production logic.

---

### **Step 2: Program, Blocks, and CST Foundation**

- Implement `parse()`
- Implement `parseProgram()`
- Implement `parseBlock()`
- Implement `parseStatementList()`
- Implement `parseStatement()`
- Parse the minimal block structure and end-of-program marker
- Ensure `parseStatementList()` correctly handles epsilon/empty cases
- Start building the CST with `<Program>`, `<Block>`, `<Statement List>`, and terminal leaves
- Add verbose parser tracing for each production entered
- **Test**: Input corresponding to `{}$` should produce the same structural parse shape shown in `parseExamples.txt`
- **Test**: Nested block input corresponding to `output2.txt` should recurse cleanly and produce the expected CST shape
- **Deliverable**: Minimal valid programs parse successfully, recurse correctly, and print a correctly formatted CST.

---

### **Step 3: Core Statements and Expressions**

- Implement grammar productions for variable declarations
- Implement assignment statements
- Implement print statements
- Implement expression parsing according to the grammar:
  - integer expressions
  - string expressions
  - boolean expressions
  - identifiers where allowed as expressions
- Add the appropriate CST nodes and terminal leaves for each production
- Verify tokens are consumed in the exact expected order
- Keep the parser faithful to the grammar's precedence/structure rather than inventing a richer expression parser
- Ensure the CST preserves concrete grammar structure, not a simplified AST
- **Test**: Small programs with declarations, assignments, prints, and representative expressions should parse and generate a complete CST
- **Deliverable**: Core statement and expression forms in the grammar parse correctly.

---

### **Step 4: Control Flow and Full Grammar Coverage**

- Implement `if` statements if present in the grammar
- Implement `while` statements if present in the grammar
- Validate the required block/expression structure for each
- Extend the CST output so control-flow constructs remain easy to inspect
- Confirm statement dispatch now covers the full grammar
- **Test**: Small control-flow examples with nested blocks and expressions
- **Deliverable**: Full statement grammar is covered.

---

### **Step 5: Diagnostics, Multi-Program Integration, and Output Consistency**

- Implement detailed parse errors for:
  - unexpected tokens
  - missing required tokens
  - premature end of input
  - mismatched block structure
- Include exact token position, expectation, explanation, and fix guidance
- Add parser-level hints/warnings only where they are justified by syntax or structure
- Ensure parse failure suppresses CST output and semantic-analysis handoff for that program
- Ensure hints/warnings do **not** block later phases when there are no parse errors
- Parse multiple lexer-produced programs in sequence
- Reset parser/CST/diagnostic state cleanly between programs
- Make parser logs visually consistent with lexer logs
- Normalize parser output into the same polished message family used by the lexer (`INFO`, `DEBUG`, `ERROR`, plus warnings/hints if used)
- If lex failed for a program, skip parse for that program with a clear message
- **Test**: Inputs modeled after the failing parse examples in `parseExamples.txt`
- **Deliverable**: Robust parser diagnostics and clean multi-program pipeline behavior.

---

### **Step 6: Tests, Documentation, and Final Polish**

- Create a **plethora** of parser test programs covering:
  - valid programs
  - each grammar production
  - nested blocks
  - declarations, assignments, prints
  - expressions of every supported form
  - control-flow constructs
  - every major parser error case
  - warnings/hints that genuinely belong in parse
- Include the examples derived from `output1.txt` through `output4.txt` and `parseExamples.txt`
- Run tests and document results **informally** in `parse-test.md`
- Review parser structure for clarity and maintainability
- Finalize comments and documentation
- Verify the parser follows the grammar exactly and does not scope-creep
- Confirm CST formatting is neat and stable
- Confirm parse success is the gate to Semantic Analysis
- **Deliverable**: Production-ready parser phase with testing coverage and clean documentation.

---

## File References


| File                          | Purpose                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `grammar.md`                  | Authoritative grammar; parser productions must match it exactly  |
| `cursor-only/parseRequirements.md` | Parser assignment requirements and diagnostic expectations  |
| `src/parser/tree.ts`          | `Tree` class: CST branches/leaves via `addNode` / `endChildren`; output lines |
| `parseExamples.txt`           | Example parser traces, failure cases, and CST formatting style   |
| `output1.txt` - `output4.txt` | Existing lexer output style reference for formatting consistency |
| `parse-test.md`               | Informal testing write-up (you create/update)                    |


---

## Example Test Cases (Verify Against Grammar)

- **P1** Input: `{}$` -> Parser should enter `parse()`, `parseProgram()`, `parseBlock()`, `parseStatementList()`, then print a minimal CST
- **P2** Input: `{{{{{{}}}}}}$` -> Parser should recurse through nested blocks and print a deeply nested CST
- **P3** Input matching the commented nested-block example in `parseExamples.txt` -> Parser should either succeed with the expected CST shape or fail exactly where the grammar demands
- **P4** Input where lex already failed, such as the invalid-token example tied to `output4.txt` -> Parser should be skipped cleanly
- **P5** Add grammar-valid programs that cover declarations, assignments, print statements, expressions, `if`, and `while` if those productions exist

---

## Reminder for the AI

After completing each step:

1. **Stop** and present the deliverable
2. **Do not** proceed to the next step unless the user asks
3. Encourage the user to test and commit
4. When the user says `continue` or `next step`, proceed to the next numbered step only

---

*End of Meta-Prompt*