const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const { buildAstFromTokens, formatAstLines } = require("../dist/semantic-analysis/index");
const { SemanticLogger } = require("../dist/semantic-analysis/semantic-logger");

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

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "files", name), "utf8");
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
  }
];

for (const t of tests) {
  t.run();
  console.log(`ok — ${t.name}`);
}

console.log(`\nsemantic AST tests passed: ${tests.length}`);
