const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const { SemanticAnalyzer } = require("../dist/semantic-analysis/semantic-analyzer");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "files", name), "utf8");
}

function runSemanticsQuiet(source) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.join(" "));
  };
  let segment;
  try {
    const lexer = new Lexer(source, { debug: false });
    segment = lexer.lexNextProgram();
    assert.ok(segment !== null);
    assert.equal(segment.lexErrorCount, 0);
    const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
    parser.run();
    assert.equal(parser.parseErrorCount(), 0);
    const sem = new SemanticAnalyzer();
    const result = sem.run(segment.tokens, segment.programNumber, { quiet: true });
    return { result, lines };
  } finally {
    console.log = originalLog;
  }
}

const tests = [
  {
    name: "golden program prints symbol table rows and has 0 semantic errors",
    run() {
      const { result, lines } = runSemanticsQuiet(readFixture("semantic-golden-input.txt"));
      assert.equal(result.errorCount, 0);
      assert.ok(lines.some((l) => l.includes("Printing symbol table for program 1")));
      assert.ok(lines.some((l) => l.includes("[a   int")));
      assert.ok(lines.some((l) => l.includes("[b   boolean")));
      assert.ok(lines.some((l) => l.includes("[c   string")));
    }
  },
  {
    name: "undeclared identifier in print is a semantic error and skips symbol table",
    run() {
      const { result, lines } = runSemanticsQuiet(readFixture("semantic-undeclared-use.txt"));
      assert.ok(result.errorCount >= 1);
      assert.ok(result.diagnostics.some((d) => d.message.includes("Undeclared identifier 'x'")));
      assert.ok(!lines.some((l) => l.includes("Printing symbol table")));
    }
  },
  {
    name: "assignment type mismatch is an error",
    run() {
      const { result } = runSemanticsQuiet(readFixture("semantic-type-mismatch.txt"));
      assert.ok(result.errorCount >= 1);
      assert.ok(result.diagnostics.some((d) => d.message.includes("Type mismatch")));
    }
  },
  {
    name: "boolop operands of different types is an error",
    run() {
      const { result } = runSemanticsQuiet(readFixture("semantic-boolop-mismatch.txt"));
      assert.ok(result.errorCount >= 1);
      assert.ok(result.diagnostics.some((d) => d.message.includes("same type")));
    }
  }
];

for (const t of tests) {
  t.run();
  console.log(`ok — ${t.name}`);
}

console.log(`\nsemantic full tests passed: ${tests.length}`);
