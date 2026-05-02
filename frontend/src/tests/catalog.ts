export type CuratedTestExpected = "ok" | "lex-error" | "parse-error" | "semantic-error" | "codegen-error";

export interface CuratedTest {
  id: string;
  name: string;
  description: string;
  source: string;
  expected: CuratedTestExpected;
}

export const CURATED_TESTS: CuratedTest[] = [
  {
    id: "codegen-int-print",
    name: "Codegen Example 1 - int print",
    description: "Declare an int, assign it, and print it.",
    source: `{
  int i
  i = 5
  print(i)
}$`,
    expected: "ok"
  },
  {
    id: "codegen-string-print",
    name: "Codegen Example 2 - string print",
    description: "Declare a string variable, assign a heap literal, and print it.",
    source: `{
  string n
  n = "alan"
  print(n)
}$`,
    expected: "ok"
  },
  {
    id: "combined-shadow",
    name: "Combined nested-with-shadow",
    description: "Two valid programs, including nested scopes and shadowing.",
    source: `{
    int a
    a = 1
    {
        int a
        a = 2
        print(a)
    }
    string b
    b = "alan"
    if (a == 1) {
        print(b)
    }
}$

{
  int a
  {
    boolean b
    {
      string c
      {
        a = 5
        b = false
        c = "inta"
      }
      print(c)
    }
    print(b)
  }
  print(a)
}$`,
    expected: "ok"
  },
  {
    id: "semantic-golden-nested",
    name: "Semantic golden 3-deep nested",
    description: "Nested declarations and reads across parent scopes.",
    source: `{
  int a
  {
    boolean b
    {
      string c
      {
        a = 5
        b = false
        c = "inta"
      }
      print(c)
    }
    print(b)
  }
  print(a)
}$`,
    expected: "ok"
  },
  {
    id: "empty-block",
    name: "Empty block",
    description: "Smallest valid program.",
    source: `{}$`,
    expected: "ok"
  },
  {
    id: "boolean-print",
    name: "Boolean print",
    description: "Assign and print a boolean value.",
    source: `{
  boolean b
  b = true
  print(b)
}$`,
    expected: "ok"
  },
  {
    id: "assignment-chain",
    name: "Assignment chain",
    description: "Assign from one int variable into another before printing.",
    source: `{
  int a
  int b
  a = 3
  b = a
  print(b)
}$`,
    expected: "ok"
  },
  {
    id: "string-reassignment",
    name: "String reassignment",
    description: "Store two string literals in sequence, then print the latest pointer.",
    source: `{
  string s
  s = "hi"
  s = "bye"
  print(s)
}$`,
    expected: "ok"
  },
  {
    id: "direct-string-print",
    name: "Direct string-literal print",
    description: "Print a string literal without declaring a variable.",
    source: `{
  print("hi")
}$`,
    expected: "ok"
  },
  {
    id: "shadowed-variables",
    name: "Shadowed variables",
    description: "Nested declaration shadows an outer variable.",
    source: `{
  int a
  a = 1
  {
    int a
    a = 2
    print(a)
  }
  print(a)
}$`,
    expected: "ok"
  },
  {
    id: "if-equality",
    name: "If equality",
    description: "Generate a conditional branch from an equality comparison.",
    source: `{
  int a
  a = 3
  if (a == 3) {
    print(a)
  }
}$`,
    expected: "ok"
  },
  {
    id: "while-addition",
    name: "While + integer addition",
    description: "Loop with a comparison and integer addition assignment.",
    source: `{
  int a
  a = 1
  while (a != 3) {
    print(a)
    a = 1 + a
  }
}$`,
    expected: "ok"
  },
  {
    id: "multi-program-reset",
    name: "Multi-program reset",
    description: "Two independent valid programs in one source buffer.",
    source: `{
  int a
  a = 1
  print(a)
}$
{
  string s
  s = "reset"
  print(s)
}$`,
    expected: "ok"
  },
  {
    id: "heap-overflow",
    name: "Heap overflow",
    description: "A very long string literal should fail during code generation.",
    source: `{
  string s
  s = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  print(s)
}$`,
    expected: "codegen-error"
  },
  {
    id: "type-mismatch",
    name: "Type mismatch",
    description: "Assigning a string literal into an int fails semantic analysis.",
    source: `{
  int a
  a="not an int"
}$`,
    expected: "semantic-error"
  },
  {
    id: "lex-errors",
    name: "Lex errors",
    description: "Invalid slash and star tokens should fail lexing.",
    source: `{/}\${*}$`,
    expected: "lex-error"
  },
  {
    id: "parse-error",
    name: "Parse error",
    description: "Malformed print statement should fail parsing.",
    source: `{print 1}$`,
    expected: "parse-error"
  },
  {
    id: "free-form-starter",
    name: "Free-form starter",
    description: "A tiny starting point for typing your own program.",
    source: `/* type your program below */
{}$`,
    expected: "ok"
  }
];
