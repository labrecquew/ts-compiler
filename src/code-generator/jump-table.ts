export interface JumpRow {
  temp: string;
  distance?: number;
}

export class JumpTable {
  private readonly rows: JumpRow[] = [];

  insert(): JumpRow {
    const row: JumpRow = { temp: `J${this.rows.length}` };
    this.rows.push(row);
    return row;
  }

  all(): readonly JumpRow[] {
    return this.rows;
  }

  resolve(temp: string, distance: number): void {
    const row = this.rows.find((r) => r.temp === temp);
    if (row !== undefined) {
      row.distance = distance;
    }
  }
}
