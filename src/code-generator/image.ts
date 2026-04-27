import { byte } from "./opcodes";

export type ImageCell = string | null;

export class MemoryImage {
  private readonly cells: ImageCell[] = Array.from({ length: 256 }, () => null);
  private nextCodeAddress = 0;
  private heapCursor = 0xff;

  get codeAddress(): number {
    return this.nextCodeAddress;
  }

  get heapStartAddress(): number {
    return this.heapCursor + 1;
  }

  emit(cell: string): number {
    const address = this.nextCodeAddress;
    this.write(address, cell);
    this.nextCodeAddress += 1;
    return address;
  }

  emitMany(cells: readonly string[]): number {
    const start = this.nextCodeAddress;
    for (const cell of cells) {
      this.emit(cell);
    }
    return start;
  }

  write(address: number, cell: string): void {
    this.assertAddress(address);
    this.cells[address] = cell.toUpperCase();
  }

  read(address: number): ImageCell {
    this.assertAddress(address);
    return this.cells[address];
  }

  allocateString(value: string): { startAddress: number; bytes: string[] } | null {
    const bytes = [...value].map((ch) => byte(ch.charCodeAt(0)));
    bytes.push("00");
    const startAddress = this.heapCursor - bytes.length + 1;
    if (startAddress < 0) {
      return null;
    }
    bytes.forEach((b, i) => this.write(startAddress + i, b));
    this.heapCursor = startAddress - 1;
    return { startAddress, bytes };
  }

  zeroFill(staticStart: number, staticSize: number): void {
    const staticEnd = staticStart + staticSize;
    for (let i = staticStart; i <= this.heapCursor; i += 1) {
      if (i >= staticEnd && this.cells[i] === null) {
        this.cells[i] = "00";
      }
    }
    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] === null) {
        this.cells[i] = "00";
      }
    }
  }

  containsUnresolvedPlaceholders(): boolean {
    return this.cells.some((cell) => cell !== null && !/^[0-9A-F]{2}$/.test(cell));
  }

  rows(finalized: boolean): string[] {
    const lines: string[] = [];
    for (let row = 0; row < 256; row += 8) {
      const rowCells = this.cells.slice(row, row + 8).map((cell) => cell ?? (finalized ? "00" : ".."));
      lines.push(rowCells.join(" "));
    }
    return lines;
  }

  stream(endExclusive: number): string {
    return this.cells
      .slice(0, endExclusive)
      .map((cell) => cell ?? "00")
      .join(" ");
  }

  private assertAddress(address: number): void {
    if (!Number.isInteger(address) || address < 0 || address > 0xff) {
      throw new Error(`Memory address out of range: ${address}`);
    }
  }
}
