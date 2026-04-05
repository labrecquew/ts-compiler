const assert = require("node:assert/strict");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");

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
