const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const {
  buildAstFromTokens,
  analyzeScopes,
  lookupInChain
} = require("../dist/semantic-analysis/index");
const { SemanticLogger } = require("../dist/semantic-analysis/semantic-logger");
const { ScopeNode } = require("../dist/semantic-analysis/scope");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "files", name), "utf8");
}

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

const tests = [
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
  }
];

for (const t of tests) {
  t.run();
  console.log(`ok — ${t.name}`);
}

console.log(`\nsemantic scope tests passed: ${tests.length}`);
