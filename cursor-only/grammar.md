# Our Language Grammar

This document outlines the formal grammar for the language, including rules for programs, blocks, statements, and expressions.

---

## Grammar Rules

| Non-terminal | Production | Notes |
| --- | --- | --- |
| **Program** | `::== Block $` |  |
| **Block** | `::== { StatementList }` | *Curly braces denote scope.* |
| **StatementList** | `::== Statement StatementList` |  |
|  | `::== ε` |  |
| **Statement** | `::== PrintStatement` |  |
|  | `::== AssignmentStatement` |  |
|  | `::== VarDecl` |  |
|  | `::== WhileStatement` |  |
|  | `::== IfStatement` |  |
|  | `::== Block` |  |
| **PrintStatement** | `::== print ( Expr )` |  |
| **AssignmentStatement** | `::== Id = Expr` | *= is assignment.* |
| **VarDecl** | `::== type Id` |  |
| **WhileStatement** | `::== while BooleanExpr Block` |  |
| **IfStatement** | `::== if BooleanExpr Block` |  |
| **Expr** | `::== IntExpr` |  |
|  | `::== StringExpr` |  |
|  | `::== BooleanExpr` |  |
|  | `::== Id` |  |
| **IntExpr** | `::== digit intop Expr` |  |
|  | `::== digit` |  |
| **StringExpr** | `::== " CharList "` |  |
| **BooleanExpr** | `::== ( Expr boolop Expr )` |  |
|  | `::== boolval` |  |
| **Id** | `::== char` |  |
| **CharList** | `::== char CharList` |  |
|  | `::== space CharList` |  |
|  | `::== ε` |  |

---

## Terminals and Tokens

* **type** `::== int | string | boolean`
* **char** `::== a | b | c | d | e | f | g | h | i | j | k | l | m | n | o | p | q | r | s | t | u | v | w | x | y | z`
* **space** `::==  ` (the space character)
* **digit** `::== 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9`
* **boolop** `::== == | !=` (*== is test for equality.*)
* **boolval** `::== false | true`
* **intop** `::== +`

---

> **Note:** Comments are bounded by `/*` and `*/` and ignored by the lexer.
