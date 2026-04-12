const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const {
  buildAstFromTokens,
  formatAstLines,
  analyzeScopes,
  lookupInChain
} = require("../dist/semantic-analysis/index");
const { SemanticAnalyzer } = require("../dist/semantic-analysis/semantic-analyzer");
const { SemanticLogger } = require("../dist/semantic-analysis/semantic-logger");
const { ScopeNode } = require("../dist/semantic-analysis/scope");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "files", name), "utf8");
}

/** Expected AST body from `cursor-only/semanticAnalysisExamples.txt` (lines 149–176). */
const GOLDEN_AST_LINES = [
  " <Block>",
  "-<VarDecl>",
  "--[int]",
  "--[a]",
  "-<Block>",
  "--<VarDecl>",
  "---[boolean]",
  "---[b]",
  "--<Block>",
  "---<VarDecl>",
  "----[string]",
  "----[c]",
  "---<Block>",
  "----<Assign>",
  "-----[a]",
  "-----[5]",
  "----<Assign>",
  "-----[b]",
  "-----[false]",
  "----<Assign>",
  "-----[c]",
  '-----["inta"]',
  "---<Print>",
  "----[c]",
  "--<Print>",
  "---[b]",
  "-<Print>",
  "--[a]"
];

function lexParseBuild(source) {
  const originalLog = console.log;
  console.log = () => {};
  let segment;
  try {
    const lexer = new Lexer(source, { debug: false });
    segment = lexer.lexNextProgram();
    assert.ok(segment !== null);
    assert.equal(segment.lexErrorCount, 0);
    const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
    parser.run();
    assert.equal(parser.parseErrorCount(), 0);
  } finally {
    console.log = originalLog;
  }
  const quietLog = new SemanticLogger(false);
  const ast = buildAstFromTokens(segment.tokens, quietLog);
  return { ast, segment };
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

function runMultiProgramPipeline(source) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.join(" "));
  };
  const results = [];
  try {
    const lexer = new Lexer(source, { debug: false });
    for (;;) {
      const segment = lexer.lexNextProgram();
      if (segment === null) {
        break;
      }
      assert.equal(segment.lexErrorCount, 0);
      const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
      parser.run();
      assert.equal(parser.parseErrorCount(), 0);
      const sem = new SemanticAnalyzer();
      results.push(sem.run(segment.tokens, segment.programNumber, { quiet: true }));
    }
    return { lines, results };
  } finally {
    console.log = originalLog;
  }
}

const tests = [
  {
    name: "Phase A AST shape matches semanticAnalysisExamples.txt (golden program)",
    run() {
      const source = readFixture("semantic-golden-input.txt");
      const originalLog = console.log;
      console.log = () => {};
      let segment;
      try {
        const lexer = new Lexer(source, { debug: false });
        segment = lexer.lexNextProgram();
        assert.ok(segment !== null);
        assert.equal(segment.lexErrorCount, 0);
        const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
        parser.run();
        assert.equal(parser.parseErrorCount(), 0, "golden input must parse");
      } finally {
        console.log = originalLog;
      }
      const quietLog = new SemanticLogger(false);
      const ast = buildAstFromTokens(segment.tokens, quietLog);
      const lines = formatAstLines(ast);
      assert.deepEqual(lines, GOLDEN_AST_LINES);
    }
  },
  {
    name: "golden program: declaration order and scope ids (a:0, b:1, c:2)",
    run() {
      const { ast } = lexParseBuild(readFixture("semantic-golden-input.txt"));
      const diagnostics = [];
      const { symbolsInOrder } = analyzeScopes(ast, new SemanticLogger(false), diagnostics);
      assert.equal(diagnostics.length, 0);
      assert.equal(symbolsInOrder.length, 3);
      assert.deepEqual(
        symbolsInOrder.map((s) => ({ name: s.name, scopeId: s.scopeId, type: s.type })),
        [
          { name: "a", scopeId: 0, type: "int" },
          { name: "b", scopeId: 1, type: "boolean" },
          { name: "c", scopeId: 2, type: "string" }
        ]
      );
      assert.equal(
        symbolsInOrder.every((s) => s.isInitialized === true && s.isUsed === true),
        true,
        "golden program assigns and reads all three variables"
      );
    }
  },
  {
    name: "redeclaration in the same scope is an error",
    run() {
      const { ast } = lexParseBuild(readFixture("semantic-redeclare-same-scope.txt"));
      const diagnostics = [];
      const originalLog = console.log;
      console.log = () => {};
      try {
        analyzeScopes(ast, new SemanticLogger(false), diagnostics);
      } finally {
        console.log = originalLog;
      }
      const errors = diagnostics.filter((d) => d.severity === "Error");
      assert.equal(errors.length, 1);
      assert.match(errors[0].message, /Redeclaration of 'a'/);
    }
  },
  {
    name: "same name in inner block is allowed (shadowing)",
    run() {
      const { ast } = lexParseBuild(readFixture("semantic-shadow-ok.txt"));
      const diagnostics = [];
      const { rootScope, symbolsInOrder } = analyzeScopes(ast, new SemanticLogger(false), diagnostics);
      assert.equal(diagnostics.length, 0);
      assert.equal(symbolsInOrder.length, 2);
      assert.deepEqual(
        symbolsInOrder.map((s) => [s.name, s.scopeId]),
        [
          ["a", 0],
          ["a", 1]
        ]
      );
      assert.equal(lookupInChain(rootScope, "a")?.scopeId, 0);
    }
  },
  {
    name: "lookupInChain resolves through parent scopes",
    run() {
      const outer = new ScopeNode(null, 0);
      outer.symbols.set("a", {
        name: "a",
        type: "int",
        isInitialized: false,
        isUsed: false,
        scopeId: 0,
        declaredAt: { line: 1, column: 1, index: 0 }
      });
      const inner = new ScopeNode(outer, 1);
      const hit = lookupInChain(inner, "a");
      assert.ok(hit);
      assert.equal(hit.scopeId, 0);
    }
  },
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
    name: "alternate nested golden-style program (x, y, z) completes with 0 errors and expected scopes",
    run() {
      const { result, lines } = runSemanticsQuiet(readFixture("semantic-golden-alt-nested.txt"));
      assert.equal(result.errorCount, 0);
      assert.ok(result.scopeState !== null);
      const syms = result.scopeState.symbolsInOrder;
      assert.equal(syms.length, 3);
      assert.deepEqual(
        syms.map((s) => ({ name: s.name, scopeId: s.scopeId, type: s.type })),
        [
          { name: "x", scopeId: 0, type: "int" },
          { name: "y", scopeId: 1, type: "boolean" },
          { name: "z", scopeId: 2, type: "string" }
        ]
      );
      assert.ok(lines.some((l) => l.includes("[x   int")));
      assert.ok(lines.some((l) => l.includes("[y   boolean")));
      assert.ok(lines.some((l) => l.includes("[z   string")));
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
  },
  {
    name: "two $-separated programs each run lex → parse → semantics with fresh state",
    run() {
      const { lines, results } = runMultiProgramPipeline(readFixture("semantic-multi-valid.txt"));
      assert.equal(results.length, 2);
      assert.equal(results[0].errorCount, 0);
      assert.equal(results[1].errorCount, 0);
      assert.ok(lines.some((l) => l.includes("Printing symbol table for program 1")));
      assert.ok(lines.some((l) => l.includes("Printing symbol table for program 2")));
      assert.ok(lines.some((l) => l.includes("[a   int")));
      assert.ok(lines.some((l) => l.includes("[b   int")));
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
  console.log(`Passed ${passed}/${tests.length} semantic tests.`);
}
