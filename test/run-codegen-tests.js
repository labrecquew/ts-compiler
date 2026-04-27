const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { CodeGenerator } = require("../dist/code-generator");
const { Lexer } = require("../dist/lexer/lexer");
const { Parser } = require("../dist/parser/parser");
const { SemanticAnalyzer } = require("../dist/semantic-analysis/semantic-analyzer");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "files", name), "utf8");
}

function compilePrograms(source) {
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
      const semantics = new SemanticAnalyzer();
      const semanticResult = semantics.run(segment.tokens, segment.programNumber, { quiet: true });
      assert.equal(semanticResult.errorCount, 0);
      assert.ok(semanticResult.ast !== null);
      assert.ok(semanticResult.scopeState !== null);
      const codegen = new CodeGenerator();
      results.push(
        codegen.run(semanticResult.ast, semanticResult.scopeState, segment.programNumber, { quiet: true })
      );
    }
    return { results, lines };
  } finally {
    console.log = originalLog;
  }
}

function compileOneFixture(name) {
  const { results, lines } = compilePrograms(readFixture(name));
  assert.equal(results.length, 1);
  return { result: results[0], lines };
}

function runCliLikePipeline(source) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.join(" "));
  };
  try {
    const lexer = new Lexer(source, { debug: false });
    for (;;) {
      const segment = lexer.lexNextProgram();
      if (segment === null) {
        break;
      }
      if (segment.lexErrorCount > 0) {
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because lexing reported error(s).`
        );
        continue;
      }
      const parser = new Parser(segment.tokens, segment.programNumber, { debug: false });
      parser.run();
      if (parser.parseErrorCount() !== 0) {
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because parsing reported error(s).`
        );
        continue;
      }
      const semantics = new SemanticAnalyzer();
      const semanticResult = semantics.run(segment.tokens, segment.programNumber, { quiet: true });
      if (semanticResult.errorCount !== 0 || semanticResult.ast === null || semanticResult.scopeState === null) {
        console.log(
          `INFO  CodeGen - Skipping code generation for program ${segment.programNumber} because semantic analysis reported error(s).`
        );
        continue;
      }
      const codegen = new CodeGenerator();
      codegen.run(semanticResult.ast, semanticResult.scopeState, segment.programNumber, { quiet: true });
    }
    return lines;
  } finally {
    console.log = originalLog;
  }
}

const tests = [
  {
    name: "empty block emits BRK and zero-filled 256-byte image",
    run() {
      const { result } = compileOneFixture("codegen-empty.txt");
      assert.equal(result.errorCount, 0);
      assert.equal(result.imageRows.length, 32);
      assert.equal(result.imageRows[0], "00 00 00 00 00 00 00 00");
      assert.equal(result.imageRows[31], "00 00 00 00 00 00 00 00");
    }
  },
  {
    name: "int declaration, assignment, and print match Example 1 bytes",
    run() {
      const { result } = compileOneFixture("codegen-int-print.txt");
      assert.equal(result.errorCount, 0);
      assert.equal(
        result.stream,
        "A9 00 8D 11 00 A9 05 8D 11 00 AC 11 00 A2 01 FF 00 00"
      );
      assert.equal(result.imageRows[0], "A9 00 8D 11 00 A9 05 8D");
      assert.equal(result.imageRows[1], "11 00 AC 11 00 A2 01 FF");
      assert.equal(result.imageRows[2], "00 00 00 00 00 00 00 00");
    }
  },
  {
    name: "string variable print loads Y from the static pointer slot",
    run() {
      const { result } = compileOneFixture("codegen-string-print.txt");
      assert.equal(result.errorCount, 0);
      assert.match(result.stream, /AC [0-9A-F]{2} 00 A2 02 FF/);
      assert.ok(result.imageRows.some((row) => row.includes("68 69 00")), "heap contains hi\\0");
    }
  },
  {
    name: "Id = Id assignment chain loads from source and stores to destination",
    run() {
      const { result, lines } = compileOneFixture("codegen-assignment-chain.txt");
      assert.equal(result.errorCount, 0);
      assert.ok(lines.some((l) => l.includes("T0XX | a | 0 | +0")));
      assert.ok(lines.some((l) => l.includes("T1XX | b | 0 | +1")));
      assert.match(result.stream, /AD [0-9A-F]{2} 00 8D [0-9A-F]{2} 00/);
    }
  },
  {
    name: "boolean assignment and print use byte values with integer print mode",
    run() {
      const { result } = compileOneFixture("codegen-boolean-print.txt");
      assert.equal(result.errorCount, 0);
      assert.match(result.stream, /A9 01 8D [0-9A-F]{2} 00/);
      assert.match(result.stream, /AC [0-9A-F]{2} 00 A2 01 FF/);
    }
  },
  {
    name: "string reassignment keeps old heap bytes and updates static pointer",
    run() {
      const { result } = compileOneFixture("codegen-string-reassign.txt");
      assert.equal(result.errorCount, 0);
      assert.ok(result.imageRows.some((row) => row.includes("68 69 00")), "heap contains old hi\\0");
      assert.ok(result.imageRows.some((row) => row.includes("62 79 65 00")), "heap contains new bye\\0");
      assert.match(result.stream, /A9 [0-9A-F]{2} 8D [0-9A-F]{2} 00 A9 [0-9A-F]{2} 8D [0-9A-F]{2} 00/);
    }
  },
  {
    name: "direct string literal print uses immediate Y heap address",
    run() {
      const { result } = compileOneFixture("codegen-string-literal-print.txt");
      assert.equal(result.errorCount, 0);
      assert.match(result.stream, /A0 [0-9A-F]{2} A2 02 FF/);
      assert.ok(result.imageRows.some((row) => row.includes("68 69 00")), "heap contains hi\\0");
    }
  },
  {
    name: "shadowed variables get distinct static slots",
    run() {
      const { result, lines } = compileOneFixture("codegen-shadow.txt");
      assert.equal(result.errorCount, 0);
      assert.ok(lines.some((l) => l.includes("T0XX | a | 0 | +0")));
      assert.ok(lines.some((l) => l.includes("T1XX | a | 1 | +1")));
    }
  },
  {
    name: "if equality and inequality forms compile with patched jumps",
    run() {
      for (const fixture of ["codegen-if-eq.txt", "codegen-if-neq.txt"]) {
        const { result } = compileOneFixture(fixture);
        assert.equal(result.errorCount, 0);
        assert.ok(!result.stream.includes("J"));
        assert.match(result.stream, /D0 [0-9A-F]{2}/);
      }
    }
  },
  {
    name: "while loop compiles with a wrapped backward BNE",
    run() {
      const { result } = compileOneFixture("codegen-while.txt");
      assert.equal(result.errorCount, 0);
      assert.match(result.stream, /D0 [8-9A-F][0-9A-F]/);
    }
  },
  {
    name: "multi-program sources run codegen with fresh state",
    run() {
      const { results } = compilePrograms(readFixture("codegen-multi.txt"));
      assert.equal(results.length, 2);
      assert.equal(results[0].errorCount, 0);
      assert.equal(results[1].errorCount, 0);
      assert.ok(results[0].stream.includes("A9 01"));
      assert.ok(results[1].stream.includes("A9 02"));
    }
  },
  {
    name: "oversized heap data reports an error and suppresses image rows",
    run() {
      const { result } = compileOneFixture("codegen-overflow.txt");
      assert.ok(result.errorCount >= 1);
      assert.equal(result.imageRows.length, 0);
      assert.ok(result.diagnostics.some((d) => d.message.includes("too long") || d.message.includes("collides")));
    }
  },
  {
    name: "semantic errors skip code generation in the CLI-style pipeline",
    run() {
      const lines = runCliLikePipeline(readFixture("semantic-type-mismatch.txt"));
      assert.ok(lines.some((l) => l.includes("INFO  CodeGen - Skipping code generation")));
      assert.ok(!lines.some((l) => l.includes("Starting code generation")));
      assert.ok(!lines.some((l) => l.includes("Printing memory image")));
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
  console.log(`Passed ${passed}/${tests.length} code generation tests.`);
}
