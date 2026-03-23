# Meta-Prompt: TypeScript Compiler Lexer (Iterative Build)

**Instructions for the AI:** You are helping build a lexer for a TypeScript-like language compiler. Work **incrementally**—one step at a time. Do not implement everything at once. After each step, pause and allow the user to review, test, and commit before proceeding. The user will explicitly ask you to continue to the next step.

---

## Your Role and Context

You have a PhD in computer science and are an expert in compilers and TypeScript. The assignment is to build a compiler for a language that follows a **given grammar** (not full TypeScript). The lexer is the first phase. The *source code being compiled* is not executed—it is analyzed against the grammar. The lexer validates input and produces tokens.

**Implementation language:** The lexer must be **written in TypeScript** (e.g., Node.js with `ts-node` or compiled to JavaScript). Use appropriate tooling: `package.json`, `tsconfig.json`, etc.

---

## Non-Negotiable Requirements

### Code Quality
- **Separate structure from presentation**—clean architecture, modular design
- **Professionally formatted** yet uniquely yours
- **Best practices** throughout—make it exemplary
- **Comments matter**—their presence and quality reflect professionalism; document intent, edge cases, and non-obvious logic

### Grammar Adherence
- Follow the grammar in `grammar.md` **strictly**
- Do **not** exceed the scope and complexity of the provided grammar
- Reference the grammar for every token and rule

### Lexer Behavior
1. **Multiple programs per run**—each program is separated by `$` (EOP marker)
2. **Errors and warnings**—both are required:
   - **Errors**: Fatal; report in excruciating detail (location, what went wrong, how to fix)
   - **Warnings**: Non-fatal (e.g., missing final `$`, unterminated comment blocks)
3. **Verbose output by default**—trace lexer stages; show each token as it is recognized
4. **Debug mode**—can be toggled on/off
5. **On lex error**—do not proceed to parse

### Error Message Quality
Error messages must be **excellent**. Include:
- **Where**: Exact line and column (or character position)
- **What**: The exact problematic text and token type
- **Why**: What rule was violated
- **How to fix**: Concrete, actionable guidance

Confusing, incomplete, or inaccurate error messages are serious bugs.

---

## Output Format Reference

The lexer output should follow this style (see `output1.txt` through `output5.txt` in this folder):

- `INFO  Lexer - Lexing program N...` for each program
- `DEBUG Lexer - TOKEN_TYPE [ lexeme ] found at (line:col)` for each token (when verbose/debug)
- `INFO  Lexer - Lex completed with 0 errors` on success
- `ERROR Lexer - Lex failed with N error(s)` on failure
- `ERROR Lexer - Error:line:col <detailed message>` for each error

**Example tokens** (from grammar): `OPEN_BLOCK`, `CLOSE_BLOCK`, `EOP`, `I_TYPE`, `ID`, `ASSIGN_OP`, etc.

---

## Incremental Build Steps

Execute **one step at a time**. Stop after each step for user review and commit.

---

### **Step 1: Project Scaffolding and Core Structure**
- Set up a **minimal** TypeScript project (e.g., `package.json`, `tsconfig.json`) so the lexer can be run via Node
- Add a **`.gitignore`** (e.g., `node_modules/`, `dist/`, `.env`)
- Separate token definitions, lexer logic, and I/O; no need for heavy `src/`/`tests/` scaffolding unless desired
- Define token types/enums matching the grammar terminals
- Create a minimal `Lexer` class with:
  - Input source handling
  - Basic position tracking (line, column)
  - Skeleton for `lex()` that iterates over input
- Add a simple CLI or entry point that reads input
- **Deliverable**: Project runs, reads input, reports nothing yet. Ready for token logic.

---

### **Step 2: Delimiters and Block Structure**
- Implement tokens: `{` (OPEN_BLOCK), `}` (CLOSE_BLOCK), `$` (EOP)
- Implement multi-program splitting on `$`
- Add verbose output: log each token with `(line:col)` as it is recognized
- **Test**: Input `{}$` → matches `output1.txt`. Input `{{{{{{}}}}}}$` → matches `output2.txt`
- **Deliverable**: Block delimiters and EOP work; output format matches examples.

---

### **Step 3: Comments**
- Implement `/* ... */` comment handling (comments are ignored per grammar)
- Comments do not produce tokens; they are skipped
- Add **warning** for unterminated comment blocks (e.g., `/*` without `*/`)
- **Test**: Input `{{{{{{}}} /* comments are ignored */ }}}}$` → matches `output3.txt`
- **Test**: Unterminated `/*` → warning, not crash
- **Deliverable**: Comments ignored; unterminated comment warning.

---

### **Step 4: Keywords and Types**
- Implement `int`, `string`, `boolean` (type keywords)
- Implement `true`, `false` (boolval)
- Implement `print`, `while`, `if` (statement keywords if present in grammar)
- Ensure correct token types (e.g., `I_TYPE` for `int`, `STRING_TYPE` for `string`, etc.)
- **Test**: Programs using type declarations and boolean literals
- **Deliverable**: All keywords and types lex correctly.

---

### **Step 5: Identifiers and Operators**
- Implement `Id` (char: a–z, single chars per grammar—verify grammar for multi-char ids)
- Implement `=` (ASSIGN_OP)
- Implement `==`, `!=` (boolop)
- Implement `+` (intop)
- **Test**: Assignment statements, boolean expressions
- **Deliverable**: Identifiers and operators tokenized.

---

### **Step 6: Literals**
- Implement **IntExpr**: `digit` and `digit intop Expr` (digits 0–9)
- Implement **StringExpr**: `" CharList "` (strings in double quotes; CharList allows chars and spaces)
- Handle escape sequences only if specified in grammar (otherwise do not add)
- **Test**: Integer literals, string literals, edge cases (empty string `""`, multi-digit numbers)
- **Deliverable**: All literals lex correctly.

---

### **Step 7: Error Handling and Warnings**
- Implement **unrecognized token** errors with full detail (see `output4.txt`: `Unrecognized Token: θ` at exact location)
- Implement **missing final `$`** warning
- Implement **unterminated string** error (if `"` is never closed)
- Ensure every error includes: location, offending text, explanation, fix suggestion
- **Test**: Invalid characters, malformed input, missing `$`
- **Deliverable**: Robust error reporting; all warnings implemented.

---

### **Step 8: Debug Mode Toggle**
- Add a flag/option to enable or disable debug/verbose output
- When off: suppress per-token DEBUG lines; still show INFO, errors, warnings
- When on (default): full verbose trace
- **Deliverable**: User can run in quiet or verbose mode.

---

### **Step 9: Test Suite and Documentation**
- Create a **plethora** of test programs covering:
  - Valid programs (happy path)
  - Every token type
  - Every error type (unrecognized token, unterminated comment, unterminated string, invalid char, etc.)
  - Every warning type (missing `$`, etc.)
  - Edge cases: empty blocks, nested blocks, comments in various positions
  - Code coverage and boundary conditions
- Run all tests; document results **informally** in `lex-test.md`
- Include the five example tests (6a–6e) only if they are legal per the grammar
- **Deliverable**: Comprehensive test suite; `lex-test.md` with testing narrative and results.

---

### **Step 10: Polish and Integration**
- Ensure structure/representation separation
- Finalize comments and documentation
- Verify all requirements met; no scope creep beyond grammar
- **Deliverable**: Production-ready lexer; ready for parser phase.

---

## File References

| File | Purpose |
|------|---------|
| `grammar.md` | Authoritative grammar; all tokens and rules |
| `output1.txt` – `output5.txt` | Expected output format and examples |
| `lex-test.md` | Informal testing write-up (you create/update) |

---

## Example Test Cases (Verify Against Grammar)

- **6a** Input: `{}$` → Output: `output1.txt`
- **6b** Input: `{{{{{{}}}}}}$` → Output: `output2.txt`
- **6c** Input: `{{{{{{}}} /* comments are ignored */ }}}}$` → Output: `output3.txt`
- **6d** Input: `{/* comments are still ignored */ int @}$` → Output: `output4.txt` (error on `@`)
- **6e** Input/Output: See `output5.txt`

---

## Reminder for the AI

After completing each step:
1. **Stop** and present the deliverable
2. **Do not** proceed to the next step unless the user asks
3. Encourage the user to test and commit
4. When the user says "continue" or "next step," proceed to the next numbered step only

---

*End of Meta-Prompt*
