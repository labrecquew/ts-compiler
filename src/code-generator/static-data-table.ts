import type { LanguageType } from "../semantic-analysis/language-type";

export interface StaticDataRow {
  temp: string;
  name: string;
  scopePath: string;
  displayScope: number;
  type: LanguageType;
  offset: number;
  address?: number;
}

export class StaticDataTable {
  private readonly rows: StaticDataRow[] = [];
  private readonly byKey = new Map<string, StaticDataRow>();

  insert(name: string, scopePath: string, displayScope: number, type: LanguageType): StaticDataRow {
    const key = this.key(name, scopePath);
    const existing = this.byKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const row: StaticDataRow = {
      temp: `T${this.rows.length}`,
      name,
      scopePath,
      displayScope,
      type,
      offset: this.rows.length
    };
    this.rows.push(row);
    this.byKey.set(key, row);
    return row;
  }

  lookup(name: string, scopePath: string): StaticDataRow | undefined {
    return this.byKey.get(this.key(name, scopePath));
  }

  all(): readonly StaticDataRow[] {
    return this.rows;
  }

  size(): number {
    return this.rows.length;
  }

  assignAddresses(staticBase: number): void {
    for (const row of this.rows) {
      row.address = staticBase + row.offset;
    }
  }

  private key(name: string, scopePath: string): string {
    return `${name}@${scopePath}`;
  }
}
