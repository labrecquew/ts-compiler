export const OPCODES = {
  LDA_IMMEDIATE: "A9",
  LDA_MEMORY: "AD",
  STA_MEMORY: "8D",
  ADC_MEMORY: "6D",
  LDX_IMMEDIATE: "A2",
  LDX_MEMORY: "AE",
  LDY_IMMEDIATE: "A0",
  LDY_MEMORY: "AC",
  NOP: "EA",
  BRK: "00",
  CPX_MEMORY: "EC",
  BNE: "D0",
  INC_MEMORY: "EE",
  SYS: "FF"
} as const;

export type Opcode = (typeof OPCODES)[keyof typeof OPCODES];

export function byte(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}
