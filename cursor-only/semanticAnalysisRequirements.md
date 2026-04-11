# Semantic Analysis Notes and Requirements

- Build an Abstract Syntax Tree (AST) by a re-“parse” of the token stream, looking for key elements, building the AST as you go according to the AST subtree patterns. This is not a real parse, because you already know that everything is syntactically correct and where it’s supposed to be. It’s just another pass over the tokens to build the AST, which may be easier than traversing the CST. You will need to address the tokens out of order from time to time, but you know that everything you need will be where you expect it to be, because if that were not the case we would not have made it out of parse.
- Scope-check the AST according to the scope rules we discussed in class.
- While you are scope-checking, build a symbol table of IDs that includes their name, data type, scope, position in the source code, and anything else you think might be important.
- Type-check the source code using the AST and the symbol table, based on our grammar and the type rules we discussed in class.
  - Issue errors for undeclared identifiers, redeclared identifiers in the same scope, type mismatches, and anything else that might go wrong.
  - Issue hints and warnings about declared but unused identifiers, use of uninitialized variables, and the presence of initialized but unused variables.
- Default to verbose output functionality that traces the Semantic Analysis stages, including scope checking, the construction of the symbol table, and type checking actions.
- When you detect an error, report it in helpful detail including where it was found.
- Create and display a symbol table with type and scope information, unless…
- … if there are errors detected in Semantic Analysis then do not display symbol table with type and scope information and do not continue to Code Generation.

## Additional Details from Lecture Slides

### Scoping
- Use **static scoping** (not dynamic).

### Semantic Analysis Traversal
- Perform a **depth-first, in-order AST traversal** to:
  - Build the symbol table (a tree of hash tables)
  - Check scope
  - Check type

### Scope Operations During Traversal
- **add symbol** — add a newly declared identifier to the current scope
- **lookup symbol** — look up an identifier in the current scope; if not found, check parent scopes
- **initialize scope** — create a new child scope when entering a block
- **move current scope pointer** — move down to a child scope on block entry, move back up to parent on block exit

### Symbol Table Attributes
Each entry should track at minimum:
- `type`
- `isInitialized`
- `isUsed`

Example format: `a | string, true, true`

### Type Rules
- **Assignment:** The type of the right-hand side must be compatible with the declared type of the left-hand side.
- **Print:** `print` can accept any type — no type check is required for print statements.

### Warnings (in detail)
- Variables that are declared but never used
- Variables that are used without being initialized
- Variables that are declared and initialized but never used elsewhere