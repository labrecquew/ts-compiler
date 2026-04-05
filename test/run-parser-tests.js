const assert = require("node:assert/strict");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const { TokenType } = require("../dist/lexer/tokens");

function token(type, lexeme, line = 1, column = 1) {
  return { type, lexeme, position: { line, column, index: 0 } };
}

/** Run parser on first program of `source`; collects every `console.log` line. */
function runParserOnSource(source, options = {}) {
  const output = [];
  const originalLog = console.log;
  console.log = (...args) => {
    output.push(args.join(" "));
  };

  try {
    const lexer = new Lexer(source, { debug: options.debug ?? false });
    const segment = lexer.lexNextProgram();
    assert.ok(segment !== null, "expected at least one program");
    const parser = new Parser(segment.tokens, segment.programNumber, { debug: options.debug ?? false });
    parser.run();
    return { output, segment };
  } finally {
    console.log = originalLog;
  }
}

function assertOutputMatches(output, pattern) {
  assert.ok(
    output.some((line) => pattern.test(line)),
    `Expected a line matching ${pattern}, got:\n${output.join("\n")}`
  );
}

const tests = [
  {
    name: "parses minimal program {}$ and prints CST without parser DEBUG lines when quiet",
    run() {
      const { output } = runParserOnSource("{}$", { debug: false });
      assertOutputMatches(output, /INFO\s+Parser - Parse completed with 0 errors/);
      assertOutputMatches(output, /CST for program 1/);
      assertOutputMatches(output, /<Program>/);
      assertOutputMatches(output, /<Statement List>/);
      assertOutputMatches(output, /--\[\{\]/);
      assert.ok(!output.some((l) => l.includes("DEBUG Parser")), "parser debug should be off in this run");
    }
  },
  {
    name: "emits DEBUG Parser traces for each production when debug is on",
    run() {
      const { output } = runParserOnSource("{}$", { debug: true });
      assertOutputMatches(output, /DEBUG Parser - parse\(\)/);
      assertOutputMatches(output, /DEBUG Parser - parseProgram\(\)/);
      assertOutputMatches(output, /DEBUG Parser - parseBlock\(\)/);
      assertOutputMatches(output, /DEBUG Parser - parseStatementList\(\)/);
    }
  },
  {
    name: "parses seven nested empty blocks like parseExamples program 2",
    run() {
      const source = "{".repeat(7) + "}".repeat(7) + "$";
      const { output } = runParserOnSource(source, { debug: true });
      assertOutputMatches(output, /Parse completed with 0 errors/);
      const debugStmt = output.filter((l) => l.includes("DEBUG Parser - parseStatement()"));
      assert.strictEqual(debugStmt.length, 6, "six inner Statement nodes before innermost empty block");
    }
  },
  {
    name: "emits recursive parseStatementList trace when unwinding nested blocks",
    run() {
      const source = "{".repeat(7) + "}".repeat(7) + "$";
      const { output } = runParserOnSource(source, { debug: true });
      const lists = output.filter((l) => l.includes("DEBUG Parser - parseStatementList()"));
      assert.ok(lists.length >= 13, `expected many StatementList traces, got ${lists.length}`);
    }
  },
  {
    name: "parses block with only a block comment before nested braces",
    run() {
      const source = "{/* comments are ignored */" + "{".repeat(6) + "}".repeat(6) + "}" + "$";
      const { output } = runParserOnSource(source);
      assertOutputMatches(output, /Parse completed with 0 errors/);
    }
  },
  {
    name: "fails parse with no CST when $ ends the program inside an open block",
    run() {
      const { output } = runParserOnSource("{$", { debug: false });
      assertOutputMatches(output, /Parse failed with/);
      assert.ok(
        !output.some((l) => /^CST for program \d+\.\.\./.test(l)),
        "no successful CST header on parse failure"
      );
      assertOutputMatches(output, /Skipped due to PARSER error/);
    }
  },
  {
    name: "parses two programs in one lexer stream",
    run() {
      const output = [];
      const originalLog = console.log;
      console.log = (...args) => output.push(args.join(" "));
      try {
        const lexer = new Lexer("{}${}$", { debug: false });
        for (;;) {
          const segment = lexer.lexNextProgram();
          if (segment === null) {
            break;
          }
          assert.strictEqual(segment.lexErrorCount, 0);
          const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
          parser.run();
        }
      } finally {
        console.log = originalLog;
      }
      const ok = output.filter((l) => l.includes("Parse completed with 0 errors"));
      assert.strictEqual(ok.length, 2);
    }
  },
  {
    name: "parses var decl, assignment, and print(identifier)",
    run() {
      const { output } = runParserOnSource("{int a a = 1 print(a)}$", { debug: false });
      assertOutputMatches(output, /Parse completed with 0 errors/);
      assertOutputMatches(output, /<Var Decl>/);
      assertOutputMatches(output, /<Assignment Statement>/);
      assertOutputMatches(output, /<Print Statement>/);
      assertOutputMatches(output, /\[\(\]/);
      assertOutputMatches(output, /\[\)\]/);
    }
  },
  {
    name: "parses print with string, digit, boolval, and intop Expr",
    run() {
      const { output } = runParserOnSource('{print("hi") print(1) print(true) print(1+2)}$', { debug: false });
      assertOutputMatches(output, /Parse completed with 0 errors/);
      assertOutputMatches(output, /<String Expr>/);
      assertOutputMatches(output, /\[h\]/);
      assertOutputMatches(output, /\[i\]/);
      assertOutputMatches(output, /<Int Expr>/);
      assertOutputMatches(output, /\[\+]/);
    }
  },
  {
    name: "parses parenthesized boolean as Expr and in while/if",
    run() {
      const { output } = runParserOnSource("{print((1==1)) if (1!=2) {print(0)} while true {}}$", { debug: false });
      assertOutputMatches(output, /Parse completed with 0 errors/);
      assertOutputMatches(output, /<Boolean Expr>/);
      assertOutputMatches(output, /<While Statement>/);
      assertOutputMatches(output, /<If Statement>/);
    }
  },
  {
    name: "parses nested blocks containing statements",
    run() {
      const { output } = runParserOnSource("{{int x x = 2 print(x)}}$", { debug: false });
      assertOutputMatches(output, /Parse completed with 0 errors/);
    }
  },
  {
    name: "emits hint for empty string literal but still succeeds",
    run() {
      const { output } = runParserOnSource('{print("")}$', { debug: false });
      assertOutputMatches(output, /HINT\s+Parser/);
      assertOutputMatches(output, /Parse completed with 0 errors/);
      assertOutputMatches(output, /<Char List>/);
    }
  },
  {
    name: "warns when == appears where assignment = was expected",
    run() {
      const { output } = runParserOnSource("{int b b == 1}$", { debug: false });
      assertOutputMatches(output, /WARN\s+Parser/);
      assertOutputMatches(output, /Parse failed/);
    }
  },
  {
    name: "rejects bare identifier as while condition (BooleanExpr)",
    run() {
      const { output } = runParserOnSource("{while a {}}$", { debug: false });
      assertOutputMatches(output, /Parse failed/);
      assertOutputMatches(output, /Illegal start of BooleanExpr/);
    }
  },
  {
    name: "rejects second digit without + inside print (grammar: one digit per IntExpr leaf)",
    run() {
      const { output } = runParserOnSource("{print(12)}$", { debug: false });
      assertOutputMatches(output, /Parse failed/);
    }
  },
  {
    name: "rejects illegal statement starting with digit",
    run() {
      const { output } = runParserOnSource("{1}$", { debug: false });
      assertOutputMatches(output, /Illegal start of Statement/);
      assertOutputMatches(output, /Parse failed/);
    }
  },
  {
    name: "rejects extraneous tokens after EOP in the same token list (lexer never emits this; guards API misuse)",
    run() {
      const output = [];
      const originalLog = console.log;
      console.log = (...args) => output.push(args.join(" "));
      try {
        const tokens = [
          token(TokenType.OPEN_BLOCK, "{"),
          token(TokenType.CLOSE_BLOCK, "}"),
          token(TokenType.EOP, "$"),
          token(TokenType.ID, "a", 1, 4)
        ];
        new Parser(tokens, 1, { debug: false }).run();
      } finally {
        console.log = originalLog;
      }
      assertOutputMatches(output, /Extraneous input after complete Program/);
      assertOutputMatches(output, /Parse failed/);
    }
  },
  {
    name: "parses debug traces for expression productions",
    run() {
      const { output } = runParserOnSource("{print(1+2)}$", { debug: true });
      assertOutputMatches(output, /DEBUG Parser - parseExpr\(\)/);
      assertOutputMatches(output, /DEBUG Parser - parseIntExpr\(\)/);
    }
  },
  {
    name: "skips parse when lexer reported errors (independent program)",
    run() {
      const output = [];
      const originalLog = console.log;
      console.log = (...args) => output.push(args.join(" "));
      try {
        const lexer = new Lexer("{}${@}$", { debug: false });
        for (;;) {
          const segment = lexer.lexNextProgram();
          if (segment === null) {
            break;
          }
          if (segment.lexErrorCount > 0) {
            console.log(
              `INFO  Parser - Skipping parse for program ${segment.programNumber} because lexing reported ${segment.lexErrorCount} error(s).`
            );
            continue;
          }
          new Parser(segment.tokens, segment.programNumber, { debug: false }).run();
        }
      } finally {
        console.log = originalLog;
      }
      assert.ok(output.some((l) => l.includes("Skipping parse")), "expected skip message");
      const ok = output.filter((l) => l.includes("Parse completed with 0 errors"));
      assert.strictEqual(ok.length, 1, "only the clean program parses");
    }
  }
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}

if (process.exitCode === undefined) {
  console.log(`Passed ${passed}/${tests.length} parser tests.`);
}
