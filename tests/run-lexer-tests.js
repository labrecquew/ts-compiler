const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { Lexer } = require("../dist/lexer");
const { TokenType } = require("../dist/tokens");

const repoRoot = path.resolve(__dirname, "..");

function readFixture(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function runLexer(source, options = {}) {
  const output = [];
  const originalLog = console.log;

  console.log = (...args) => {
    output.push(args.join(" "));
  };

  try {
    const lexer = new Lexer(source, options);
    const tokens = lexer.lex();
    return { tokens, output };
  } finally {
    console.log = originalLog;
  }
}

function runCli(args) {
  return execFileSync("node", [path.join(repoRoot, "dist", "cli.js"), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function tokenTypes(tokens) {
  return tokens.map((token) => token.type);
}

function countToken(tokens, tokenType) {
  return tokens.filter((token) => token.type === tokenType).length;
}

function assertOutputContains(output, fragment) {
  assert.ok(
    output.some((line) => line.includes(fragment)),
    `Expected output to contain "${fragment}", but got:\n${output.join("\n")}`
  );
}

function assertOutputExcludes(output, fragment) {
  assert.ok(
    output.every((line) => !line.includes(fragment)),
    `Expected output not to contain "${fragment}", but got:\n${output.join("\n")}`
  );
}

const tests = [
  {
    name: "lexes simple block delimiters",
    run() {
      const { tokens, output } = runLexer("{}$");

      assert.deepStrictEqual(tokenTypes(tokens), [
        TokenType.OPEN_BLOCK,
        TokenType.CLOSE_BLOCK,
        TokenType.EOP
      ]);
      assertOutputContains(output, "Lex completed with 0 errors");
    }
  },
  {
    name: "ignores block comments",
    run() {
      const { tokens, output } = runLexer("{{/* comments are ignored */}}$");
      const types = tokenTypes(tokens);

      assert.strictEqual(countToken(tokens, TokenType.OPEN_BLOCK), 2);
      assert.strictEqual(countToken(tokens, TokenType.CLOSE_BLOCK), 2);
      assert.strictEqual(types[types.length - 1], TokenType.EOP);
      assert.ok(
        types.every(
          (type) =>
            type === TokenType.OPEN_BLOCK || type === TokenType.CLOSE_BLOCK || type === TokenType.EOP
        ),
        "comments should not emit their own tokens"
      );
      assertOutputContains(output, "Lex completed with 0 errors");
    }
  },
  {
    name: "covers keywords, booleans, parentheses, and operators",
    run() {
      const source = "{print(a) if (a==b) {} if (a!=b) {} while true {} while false {} int a string b boolean c}$";
      const { tokens, output } = runLexer(source);
      const types = tokenTypes(tokens);

      assert.ok(types.includes(TokenType.PRINT));
      assert.ok(types.includes(TokenType.IF));
      assert.ok(types.includes(TokenType.WHILE));
      assert.ok(types.includes(TokenType.BOOL_TRUE));
      assert.ok(types.includes(TokenType.BOOL_FALSE));
      assert.ok(types.includes(TokenType.OPEN_PAREN));
      assert.ok(types.includes(TokenType.CLOSE_PAREN));
      assert.ok(types.includes(TokenType.EQUALITY_OP));
      assert.ok(types.includes(TokenType.INEQUALITY_OP));
      assert.strictEqual(countToken(tokens, TokenType.I_TYPE), 3);
      assertOutputContains(output, "Lex completed with 0 errors");
    }
  },
  {
    name: "lexes strings and per-digit integer tokens",
    run() {
      const { tokens, output } = runLexer('{a = 123 print("ab c")}$');

      assert.strictEqual(countToken(tokens, TokenType.DIGIT), 3);
      assert.strictEqual(countToken(tokens, TokenType.QUOTE), 2);
      assert.strictEqual(countToken(tokens, TokenType.CHAR), 3);
      assert.strictEqual(countToken(tokens, TokenType.SPACE), 1);
      assertOutputContains(output, "Lex completed with 0 errors");
    }
  },
  {
    name: "reports invalid characters as lexer errors",
    run() {
      const source = '{/* comments are still ignored */ int @}$';
      const { output } = runLexer(source);

      assertOutputContains(output, "Unrecognized Token: @");
      assertOutputContains(output, "Lex failed with 1 error(s)");
    }
  },
  {
    name: "warns when the final end-of-program marker is missing",
    run() {
      const source = readFixture("test-files/testStep9MissingEop.txt");
      const { tokens, output } = runLexer(source);

      assert.strictEqual(tokens[tokens.length - 1].type, TokenType.EOP);
      assert.strictEqual(tokens[tokens.length - 1].lexeme, "$");
      assertOutputContains(output, "Missing end-of-program marker '$'");
      assertOutputContains(output, "Lex completed with 0 errors");
    }
  },
  {
    name: "warns about unterminated comments",
    run() {
      const source = readFixture("test-files/testStep9UnterminatedComment.txt");
      const { output } = runLexer(source);

      assertOutputContains(output, "Unterminated comment block");
      assertOutputContains(output, "Missing end-of-program marker '$'");
    }
  },
  {
    name: "reports unterminated strings",
    run() {
      const { output } = runLexer('{a = "abc}$');

      assertOutputContains(output, "Unterminated string beginning");
      assertOutputContains(output, "Lex failed with 1 error(s)");
    }
  },
  {
    name: "rejects a standalone bang operator",
    run() {
      const { output } = runLexer("{a ! b}$");

      assertOutputContains(output, "Unrecognized Token: !");
      assertOutputContains(output, "must be written as '!='");
    }
  },
  {
    name: "rejects multi-letter identifiers",
    run() {
      const { output } = runLexer("{ab = 1}$");

      assertOutputContains(output, "Unrecognized Token: ab");
      assertOutputContains(output, "identifiers must be a single lowercase letter");
    }
  },
  {
    name: "rejects slash and star outside valid grammar contexts",
    run() {
      const errorLines = readFixture("test-files/testStep9Errors.txt").split(/\r?\n/);
      const slashRun = runLexer(errorLines[0]);
      const starRun = runLexer(errorLines[1]);

      assertOutputContains(slashRun.output, "Unrecognized Token: /");
      assertOutputContains(starRun.output, "Unrecognized Token: *");
    }
  },
  {
    name: "supports quiet CLI mode without debug traces",
    run() {
      const quietOutput = runCli(["--quiet", "test-files/testStep9Valid.txt"]);

      assert.match(quietOutput, /INFO  Lexer - Lexing program 1/);
      assert.doesNotMatch(quietOutput, /DEBUG Lexer -/);
    }
  },
  {
    name: "keeps verbose CLI mode as the default",
    run() {
      const verboseOutput = runCli(["test-files/testStep9Valid.txt"]);

      assert.match(verboseOutput, /DEBUG Lexer -/);
      assert.match(verboseOutput, /OPEN_PAREN/);
      assert.match(verboseOutput, /CLOSE_PAREN/);
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
  console.log(`Passed ${passed}/${tests.length} lexer tests.`);
}
