import { DiagnosticSeverity, type Diagnostic } from "../parser/diagnostics";
import type {
  AssignAst,
  AstRoot,
  BlockAst,
  BlockMember,
  BooleanBinaryExpr,
  BoolLiteralExpr,
  ExprAst,
  IdExpr,
  IfAst,
  IntAddExpr,
  IntLiteralExpr,
  PrintAst,
  StringLiteralExpr,
  VarDeclAst,
  WhileAst
} from "../semantic-analysis/ast-nodes";
import type { LanguageType } from "../semantic-analysis/language-type";
import type { ScopeAnalysisState } from "../semantic-analysis/scope-analysis";
import { CodeGenLogger } from "./codegen-logger";
import { codeGenError } from "./diagnostics";
import { MemoryImage } from "./image";
import { JumpTable } from "./jump-table";
import { byte, OPCODES } from "./opcodes";
import { StaticDataTable, type StaticDataRow } from "./static-data-table";
import type { CodeGeneratorOptions, CodeGeneratorResult } from "./types";

interface CodeGenScope {
  path: string;
  displayScope: number;
  parent: CodeGenScope | null;
  symbols: Map<string, StaticDataRow>;
  nextChildIndex: number;
}

interface GeneratedValue {
  type: LanguageType;
  mode: "constant" | "memory";
  value?: number;
  row?: StaticDataRow;
}

export class CodeGenerator {
  private readonly diagnostics: Diagnostic[] = [];
  private image!: MemoryImage;
  private staticData!: StaticDataTable;
  private jumps!: JumpTable;
  private log!: CodeGenLogger;
  private currentScope!: CodeGenScope;
  private rootScope!: CodeGenScope;
  private programNumber = 0;

  run(
    ast: AstRoot,
    _scopeState: ScopeAnalysisState,
    programNumber: number,
    options: CodeGeneratorOptions = {}
  ): CodeGeneratorResult {
    this.reset(programNumber, options);
    this.log.info(`Starting code generation for program ${programNumber}...`);

    this.emitBlock(ast, false);
    this.emitOpcode(OPCODES.BRK, "BRK");

    this.backpatchAndFinalize();

    const errorCount = this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error).length;
    if (errorCount === 0) {
      this.log.info(`Code generation completed with ${errorCount} errors`);
      this.printTables();
      this.log.info(`Printing memory image for program ${programNumber}...`);
      for (const line of this.image.rows(true)) {
        console.log(line);
      }
    } else {
      this.log.error(`Code generation failed with ${errorCount} error(s)`);
      for (const diagnostic of this.diagnostics) {
        this.log.error(`Error: ${diagnostic.message}`);
      }
    }

    return {
      diagnostics: this.diagnostics,
      errorCount,
      imageRows: errorCount === 0 ? this.image.rows(true) : [],
      stream: errorCount === 0 ? this.image.stream(this.image.codeAddress + this.staticData.size()) : ""
    };
  }

  private reset(programNumber: number, options: CodeGeneratorOptions): void {
    this.diagnostics.length = 0;
    this.image = new MemoryImage();
    this.staticData = new StaticDataTable();
    this.jumps = new JumpTable();
    this.log = new CodeGenLogger(!options.quiet);
    this.programNumber = programNumber;
    this.rootScope = {
      path: "0",
      displayScope: 0,
      parent: null,
      symbols: new Map(),
      nextChildIndex: 0
    };
    this.currentScope = this.rootScope;
  }

  private emitBlock(block: BlockAst, createsScope: boolean): void {
    const previous = this.currentScope;
    if (createsScope) {
      this.currentScope = this.enterChildScope(previous);
      this.log.debug(`Enter <Block> scope ${this.currentScope.displayScope}`);
    } else {
      this.log.debug("Enter <Block> scope 0");
    }

    for (const member of block.members) {
      this.emitMember(member);
    }

    this.log.debug(`Exit <Block> scope ${this.currentScope.displayScope}`);
    this.currentScope = previous;
  }

  private enterChildScope(parent: CodeGenScope): CodeGenScope {
    parent.nextChildIndex += 1;
    return {
      path: `${parent.path}.${parent.nextChildIndex}`,
      displayScope: parent.displayScope + 1,
      parent,
      symbols: new Map(),
      nextChildIndex: 0
    };
  }

  private emitMember(member: BlockMember): void {
    switch (member.kind) {
      case "Block":
        this.emitBlock(member, true);
        break;
      case "VarDecl":
        this.emitVarDecl(member);
        break;
      case "Assign":
        this.emitAssign(member);
        break;
      case "Print":
        this.emitPrint(member);
        break;
      case "If":
        this.emitIf(member);
        break;
      case "While":
        this.emitWhile(member);
        break;
      default: {
        const _never: never = member;
        this.pushInternalError("Unknown", `Malformed AST member ${JSON.stringify(_never)}`);
      }
    }
  }

  private emitVarDecl(decl: VarDeclAst): void {
    this.log.debug(`Enter <VarDecl> ${decl.name}@${this.currentScope.displayScope}`);
    const row = this.staticData.insert(
      decl.name,
      this.currentScope.path,
      this.currentScope.displayScope,
      decl.varType
    );
    this.currentScope.symbols.set(decl.name, row);
    this.log.debug(
      `Static Data Table insert: ${row.temp}XX | ${decl.name} | ${row.displayScope} | +${row.offset}`
    );
    this.emitLoadAccumulatorConstant(0, "initialize declared variable to 0");
    this.emitStore(row, `VarDecl ${decl.name}@${row.displayScope}`);
  }

  private emitAssign(assign: AssignAst): void {
    this.log.debug(`Enter <Assign> ${assign.target}`);
    const target = this.lookup(assign.target);
    if (target === undefined) {
      this.pushInternalError("Assign", `Unresolved target '${assign.target}' during code generation.`);
      return;
    }

    if (assign.value.kind === "StringLiteral") {
      const literal = this.allocateString(assign.value, "Assign");
      if (literal !== null) {
        this.emitLoadAccumulatorConstant(literal.startAddress, `string pointer for "${assign.value.value}"`);
        this.emitStore(target, `Assign string ${assign.target}`);
      }
      return;
    }

    const value = this.materializeToAccumulator(assign.value, "Assign");
    if (value !== null) {
      this.emitStore(target, `Assign ${assign.target}`);
    }
  }

  private emitPrint(print: PrintAst): void {
    this.log.debug("Enter <Print>");
    const value = this.evaluateExpr(print.argument, "Print");
    if (value === null) {
      return;
    }

    if (value.type === "string") {
      if (value.mode === "constant") {
        this.emitOpcode(OPCODES.LDY_IMMEDIATE, "LDY immediate string literal pointer");
        this.emitByte(value.value ?? 0, "heap address");
      } else if (value.row !== undefined) {
        // String variables store a one-byte heap pointer in static memory; SYS reads Y as that pointer.
        this.emitOpcode(OPCODES.LDY_MEMORY, "LDY memory string pointer");
        this.emitAddressPlaceholder(value.row, `Print string ${value.row.name}`);
      }
      this.emitLoadXConstant(2, "string print mode");
      this.emitOpcode(OPCODES.SYS, "SYS");
      return;
    }

    if (value.mode === "constant") {
      const temp = this.createInternalTemp("print", value.type);
      this.emitLoadAccumulatorConstant(value.value ?? 0, "print literal staging");
      this.emitStore(temp, "Print literal temp");
      this.emitOpcode(OPCODES.LDY_MEMORY, "LDY memory print literal");
      this.emitAddressPlaceholder(temp, "Print literal temp");
    } else if (value.row !== undefined) {
      this.emitOpcode(OPCODES.LDY_MEMORY, "LDY memory int/bool");
      this.emitAddressPlaceholder(value.row, `Print ${value.row.name}`);
    }
    this.emitLoadXConstant(1, "integer/boolean print mode");
    this.emitOpcode(OPCODES.SYS, "SYS");
  }

  private emitIf(ifAst: IfAst): void {
    this.log.debug("Enter <If>");
    if (ifAst.condition.kind === "BoolLiteral") {
      if (!ifAst.condition.value) {
        this.log.debug("If condition is false literal; body emits no code");
        return;
      }
      this.emitBlock(ifAst.body, true);
      return;
    }

    const branch = this.emitConditionBranch(ifAst.condition, "If", true);
    if (branch === null) {
      return;
    }
    this.emitBlock(ifAst.body, true);
    this.patchForwardJump(branch.temp, branch.placeholderAddress, this.image.codeAddress);
  }

  private emitWhile(whileAst: WhileAst): void {
    this.log.debug("Enter <While>");
    const loopTop = this.image.codeAddress;
    this.log.debug(`While top-of-loop byte address $${byte(loopTop)}`);

    if (whileAst.condition.kind === "BoolLiteral") {
      if (!whileAst.condition.value) {
        this.log.debug("While condition is false literal; body emits no code");
        return;
      }
      this.emitBlock(whileAst.body, true);
      this.emitBackJump(loopTop);
      return;
    }

    const exit = this.emitConditionBranch(whileAst.condition, "While", true);
    if (exit === null) {
      return;
    }
    this.emitBlock(whileAst.body, true);
    this.emitBackJump(loopTop);
    this.patchForwardJump(exit.temp, exit.placeholderAddress, this.image.codeAddress);
  }

  private emitConditionBranch(
    condition: ExprAst,
    construct: string,
    branchWhenFalse: boolean
  ): { temp: string; placeholderAddress: number } | null {
    if (condition.kind !== "BooleanBinary") {
      const value = this.evaluateExpr(condition, construct);
      if (value?.mode === "constant") {
        const shouldBranch = branchWhenFalse ? value.value === 0 : value.value !== 0;
        if (shouldBranch) {
          const jump = this.jumps.insert();
          this.log.debug(`Jump Table insert: ${jump.temp} | <pending>`);
          this.emitOpcode(OPCODES.BNE, `${construct} literal branch`);
          const addr = this.emitPlaceholder(jump.temp, "literal branch distance");
          return { temp: jump.temp, placeholderAddress: addr };
        }
      }
      this.pushInternalError(construct, "Unsupported non-binary boolean condition.");
      return null;
    }

    const left = this.materializeForMemory(condition.left, construct);
    const right = this.materializeForMemory(condition.right, construct);
    if (left === null || right === null) {
      return null;
    }

    this.emitOpcode(OPCODES.LDX_MEMORY, `${construct} compare load left`);
    this.emitAddressPlaceholder(left, "condition lhs");
    this.emitOpcode(OPCODES.CPX_MEMORY, `${construct} compare rhs`);
    this.emitAddressPlaceholder(right, "condition rhs");

    if ((condition.operator === "==" && branchWhenFalse) || (condition.operator === "!=" && !branchWhenFalse)) {
      const jump = this.jumps.insert();
      this.log.debug(`Jump Table insert: ${jump.temp} | <pending>`);
      this.emitOpcode(OPCODES.BNE, `${construct} BNE`);
      const addr = this.emitPlaceholder(jump.temp, "branch distance");
      return { temp: jump.temp, placeholderAddress: addr };
    }

    const skipBody = this.jumps.insert();
    this.log.debug(`Jump Table insert: ${skipBody.temp} | <pending>`);
    this.emitOpcode(OPCODES.BNE, `${construct} branch when not equal`);
    const skipBodyAddr = this.emitPlaceholder(skipBody.temp, "branch distance");
    const skipElse = this.emitAlwaysBranch();
    this.patchForwardJump(skipBody.temp, skipBodyAddr, this.image.codeAddress);
    return skipElse;
  }

  private emitAlwaysBranch(existingTemp?: string): { temp: string; placeholderAddress: number } {
    const jump = existingTemp === undefined ? this.jumps.insert() : { temp: existingTemp };
    if (existingTemp === undefined) {
      this.log.debug(`Jump Table insert: ${jump.temp} | <pending>`);
    }
    const left = this.createInternalTemp("branchTrue", "boolean");
    const right = this.createInternalTemp("branchFalse", "boolean");
    this.emitLoadAccumulatorConstant(1, "always branch left");
    this.emitStore(left, "always branch left");
    this.emitLoadAccumulatorConstant(0, "always branch right");
    this.emitStore(right, "always branch right");
    this.emitOpcode(OPCODES.LDX_MEMORY, "always branch load");
    this.emitAddressPlaceholder(left, "always branch left");
    this.emitOpcode(OPCODES.CPX_MEMORY, "always branch compare");
    this.emitAddressPlaceholder(right, "always branch right");
    this.emitOpcode(OPCODES.BNE, "always branch");
    const placeholderAddress = this.emitPlaceholder(jump.temp, "always branch distance");
    return { temp: jump.temp, placeholderAddress };
  }

  private emitBackJump(loopTop: number): void {
    const branch = this.emitAlwaysBranch();
    const addressAfterBne = branch.placeholderAddress + 1;
    const distance = (loopTop - addressAfterBne + 256) % 256;
    // Backward branches wrap in one byte: if addressAfterBne + distance crosses 0xFF, it wraps to 0x00.
    this.image.write(branch.placeholderAddress, byte(distance));
    this.jumps.resolve(branch.temp, distance);
    this.log.debug(
      `Backpatch ${branch.temp} -> $${byte(distance)} (wrap: $${byte(addressAfterBne)} + $${byte(distance)} lands at $${byte(loopTop)})`
    );
  }

  private patchForwardJump(temp: string, placeholderAddress: number, targetAddress: number): void {
    const distance = targetAddress - (placeholderAddress + 1);
    if (distance < 0 || distance > 0xff) {
      this.pushInternalError("Jump", `Branch distance ${distance} for ${temp} is outside one byte.`);
      return;
    }
    this.image.write(placeholderAddress, byte(distance));
    this.jumps.resolve(temp, distance);
    this.log.debug(`Backpatch ${temp} -> $${byte(distance)}`);
  }

  private materializeToAccumulator(expr: ExprAst, construct: string): GeneratedValue | null {
    const value = this.evaluateExpr(expr, construct);
    if (value === null) {
      return null;
    }
    if (value.mode === "constant") {
      this.emitLoadAccumulatorConstant(value.value ?? 0, `${construct} literal`);
    } else if (value.row !== undefined) {
      this.emitOpcode(OPCODES.LDA_MEMORY, `${construct} load ${value.row.name}`);
      this.emitAddressPlaceholder(value.row, `${construct} load`);
    }
    return value;
  }

  private materializeForMemory(expr: ExprAst, construct: string): StaticDataRow | null {
    const value = this.evaluateExpr(expr, construct);
    if (value === null) {
      return null;
    }
    if (value.mode === "memory" && value.row !== undefined) {
      return value.row;
    }
    const temp = this.createInternalTemp("cmp", value.type);
    this.emitLoadAccumulatorConstant(value.value ?? 0, `${construct} comparison literal`);
    this.emitStore(temp, `${construct} comparison literal`);
    return temp;
  }

  private evaluateExpr(expr: ExprAst, construct: string): GeneratedValue | null {
    switch (expr.kind) {
      case "IntLiteral":
        return this.evalIntLiteral(expr);
      case "BoolLiteral":
        return this.evalBoolLiteral(expr);
      case "StringLiteral": {
        const allocated = this.allocateString(expr, construct);
        return allocated === null ? null : { type: "string", mode: "constant", value: allocated.startAddress };
      }
      case "Id":
        return this.evalId(expr);
      case "IntAdd":
        return this.evalIntAdd(expr, construct);
      case "BooleanBinary":
        return this.evalBooleanBinary(expr, construct);
      default: {
        const _never: never = expr;
        this.pushInternalError(construct, `Malformed expression ${JSON.stringify(_never)}.`);
        return null;
      }
    }
  }

  private evalIntLiteral(expr: IntLiteralExpr): GeneratedValue {
    return { type: "int", mode: "constant", value: expr.value };
  }

  private evalBoolLiteral(expr: BoolLiteralExpr): GeneratedValue {
    return { type: "boolean", mode: "constant", value: expr.value ? 1 : 0 };
  }

  private evalId(expr: IdExpr): GeneratedValue | null {
    const row = this.lookup(expr.name);
    if (row === undefined) {
      this.pushInternalError("Id", `Unresolved identifier '${expr.name}' during code generation.`);
      return null;
    }
    return { type: row.type, mode: "memory", row };
  }

  private evalIntAdd(expr: IntAddExpr, construct: string): GeneratedValue | null {
    const left = this.evaluateExpr(expr.left, construct);
    const right = this.materializeForMemory(expr.right, construct);
    if (left === null || right === null) {
      return null;
    }
    this.emitLoadAccumulatorConstant(left.value ?? 0, "IntExpr left digit");
    this.emitOpcode(OPCODES.ADC_MEMORY, "ADC IntExpr right");
    this.emitAddressPlaceholder(right, "IntExpr right");
    const result = this.createInternalTemp("add", "int");
    this.emitStore(result, "IntExpr result");
    return { type: "int", mode: "memory", row: result };
  }

  private evalBooleanBinary(expr: BooleanBinaryExpr, construct: string): GeneratedValue | null {
    const result = this.createInternalTemp("bool", "boolean");
    const branch = this.emitConditionBranch(expr, construct, expr.operator === "==");
    if (branch === null) {
      return null;
    }
    this.emitLoadAccumulatorConstant(expr.operator === "==" ? 1 : 0, "boolean comparison true value");
    this.emitStore(result, "boolean comparison result");
    const skipFalse = this.emitAlwaysBranch();
    this.patchForwardJump(branch.temp, branch.placeholderAddress, this.image.codeAddress);
    this.emitLoadAccumulatorConstant(expr.operator === "==" ? 0 : 1, "boolean comparison false value");
    this.emitStore(result, "boolean comparison result");
    this.patchForwardJump(skipFalse.temp, skipFalse.placeholderAddress, this.image.codeAddress);
    return { type: "boolean", mode: "memory", row: result };
  }

  private allocateString(
    expr: StringLiteralExpr,
    construct: string
  ): { startAddress: number; bytes: string[] } | null {
    const allocated = this.image.allocateString(expr.value);
    if (allocated === null) {
      this.pushError(
        construct,
        `String literal "${expr.value}" is too long to fit in the remaining heap.`,
        "This violates the 256-byte image and heap/static separation rules.",
        "Shorten the string or reduce code/static data size."
      );
      return null;
    }
    this.log.debug(
      `Heap write "${expr.value}" -> $${byte(allocated.startAddress)} (${allocated.bytes.join(" ")})`
    );
    return allocated;
  }

  private createInternalTemp(name: string, type: LanguageType): StaticDataRow {
    const row = this.staticData.insert(
      `__${name}${this.staticData.size()}`,
      `internal.${this.staticData.size()}`,
      this.currentScope.displayScope,
      type
    );
    this.log.debug(`Static Data Table insert: ${row.temp}XX | ${row.name} | ${row.displayScope} | +${row.offset}`);
    return row;
  }

  private lookup(name: string): StaticDataRow | undefined {
    let scope: CodeGenScope | null = this.currentScope;
    while (scope !== null) {
      const hit = scope.symbols.get(name);
      if (hit !== undefined) {
        return hit;
      }
      scope = scope.parent;
    }
    return undefined;
  }

  private emitLoadAccumulatorConstant(value: number, context: string): void {
    this.emitOpcode(OPCODES.LDA_IMMEDIATE, `LDA #$${byte(value)} ${context}`);
    this.emitByte(value, "constant");
  }

  private emitLoadXConstant(value: number, context: string): void {
    this.emitOpcode(OPCODES.LDX_IMMEDIATE, `LDX #$${byte(value)} ${context}`);
    this.emitByte(value, "constant");
  }

  private emitStore(row: StaticDataRow, context: string): void {
    this.emitOpcode(OPCODES.STA_MEMORY, `STA ${row.temp}XX ${context}`);
    this.emitAddressPlaceholder(row, context);
  }

  private emitOpcode(opcode: string, mnemonic: string): void {
    const address = this.image.emit(opcode);
    this.log.debug(`Emit $${byte(address)}: ${opcode} ${mnemonic}`);
  }

  private emitByte(value: number, context: string): void {
    const address = this.image.emit(byte(value));
    this.log.debug(`Emit $${byte(address)}: ${byte(value)} ${context}`);
  }

  private emitPlaceholder(temp: string, context: string): number {
    const address = this.image.emit(temp);
    this.log.debug(`Emit $${byte(address)}: ${temp} ${context}`);
    return address;
  }

  private emitAddressPlaceholder(row: StaticDataRow, context: string): void {
    this.emitPlaceholder(row.temp, context);
    this.emitPlaceholder("XX", context);
  }

  private backpatchAndFinalize(): void {
    const staticBase = this.image.codeAddress;
    this.staticData.assignAddresses(staticBase);

    for (let addr = 0; addr < 256; addr += 1) {
      const cell = this.image.read(addr);
      if (cell === null) {
        continue;
      }
      const row = this.staticData.all().find((r) => r.temp === cell);
      if (row !== undefined) {
        const realAddress = row.address ?? 0;
        this.image.write(addr, byte(realAddress));
        this.image.write(addr + 1, "00");
        this.log.debug(`Backpatch ${row.temp}XX -> $${byte(realAddress)} 00`);
      }
    }

    for (const row of this.staticData.all()) {
      if (row.address === undefined || row.address > 0xff) {
        this.pushError(
          "Backpatch",
          `Unresolved or invalid static placeholder ${row.temp}XX.`,
          "Static data addresses must fit in the 256-byte image.",
          "Reduce program size or number of variables."
        );
      }
    }

    const staticEnd = staticBase + this.staticData.size();
    if (staticEnd - 1 >= this.image.heapStartAddress) {
      this.pushError(
        "Memory",
        `Static area ending at $${byte(staticEnd - 1)} collides with heap starting at $${byte(this.image.heapStartAddress)}.`,
        "Code, static data, and heap must fit in 256 bytes without overlap.",
        "Shorten code, strings, or declarations."
      );
    }

    if (this.image.codeAddress > 0xff || staticEnd > 0x100) {
      this.pushError(
        "Memory",
        "Program exceeds the 256-byte code + data image.",
        "The target memory model is limited to addresses $00 through $FF.",
        "Reduce the program size."
      );
    }

    for (const jump of this.jumps.all()) {
      if (jump.distance === undefined) {
        this.pushError(
          "Backpatch",
          `Unresolved jump placeholder ${jump.temp}.`,
          "Every BNE placeholder must be patched before final image output.",
          "Check if/while code generation for missing patch calls."
        );
      }
    }

    if (this.image.containsUnresolvedPlaceholders()) {
      this.pushError(
        "Backpatch",
        "Final image still contains unresolved placeholders.",
        "All TnXX and Jn values must be replaced before output.",
        "Inspect the DEBUG trace for the missing placeholder."
      );
    }

    this.image.zeroFill(staticBase, this.staticData.size());
  }

  private printTables(): void {
    this.log.info(`Static Data Table for program ${this.programNumber}...`);
    for (const row of this.staticData.all()) {
      this.log.info(
        `${row.temp}XX | ${row.name} | ${row.displayScope} | +${row.offset} | $${byte(row.address ?? 0)}`
      );
    }
    this.log.info(`Jump Table for program ${this.programNumber}...`);
    for (const jump of this.jumps.all()) {
      this.log.info(`${jump.temp} | ${jump.distance === undefined ? "<pending>" : `$${byte(jump.distance)}`}`);
    }
  }

  private pushInternalError(construct: string, what: string): void {
    this.pushError(
      construct,
      what,
      "Code generation received malformed or unresolved AST input after semantic analysis.",
      "Check the earlier compiler phase output and code generator dispatch."
    );
  }

  private pushError(construct: string, what: string, why: string, howToFix: string): void {
    this.diagnostics.push(
      codeGenError(
        {
          programNumber: this.programNumber,
          construct,
          byteOffset: this.image?.codeAddress ?? -1
        },
        what,
        why,
        howToFix
      )
    );
  }
}
