# Parser Notes and Requirements

## 1. Recursive Descent Parser
Add a recursive descent parser to your compiler that takes the tokens from your Lexer.

## 2. Concrete Syntax Tree (CST)
While parsing, create a Concrete Syntax Tree (CST). If parsing is successful (i.e., no errors were found), display the CST. Make it neat and pretty.

## 3. Multiple Program Support
Your parser must compile multiple programs in sequence, just like your Lexer.

## 4. Errors, Hints, and Warnings
Provide three levels of diagnostic output:

| Type | Description |
|------|-------------|
| **Error** | Actual grammar violations that halt further processing. |
| **Hint** | Messages about code hygiene issues and opportunities for improvement. |
| **Warning** | Non-fatal mistakes or omissions that don't violate the grammar but indicate potential issues (e.g., uninitialized variables). |

## 5. Detailed Error Reporting
When an error is detected, report it in excruciating detail with helpful text and messages, including:

- **Where** it was found
- **What** exactly went wrong
- **How** the programmer might fix it

> ⚠️ **Note:** Confusing, incomplete, or inaccurate error messages are serious — and intolerable — bugs.

## 6. Verbose Output
Include verbose output functionality that traces the stages of your Parser. Keep this the **default** behavior.

## 7. Error Handling Flow
When errors are detected during Parse:

- ❌ Do **not** display the CST.
- ❌ Do **not** continue to Semantic Analysis.

> Hints and warnings alone should **not** prevent progression to the next phase.