# 6502alan Machine Language Instruction Set

> Based on the operation codes of the classic 6502 microprocessor — the heart of the Commodore PET, Apple //, Atari 800, and many other ground-breaking computers.
>
> There are only three registers: **X**, **Y**, and the **Accumulator**.

---

## Instruction Set Reference

| Description | Op Code | Mnemonic | Example Assembly | Example Disassembly |
|---|---|---|---|---|
| Load the accumulator with a constant | `A9` | `LDA` | `LDA #$07` | `A9 07` |
| Load the accumulator from memory | `AD` | `LDA` | `LDA $0010` | `AD 10 00` |
| Store the accumulator in memory | `8D` | `STA` | `STA $0010` | `8D 10 00` |
| Add with carry *(adds contents of an address to the accumulator and keeps result in accumulator)* | `6D` | `ADC` | `ADC $0010` | `6D 10 00` |
| Load the X register with a constant | `A2` | `LDX` | `LDX #$01` | `A2 01` |
| Load the X register from memory | `AE` | `LDX` | `LDX $0010` | `AE 10 00` |
| Load the Y register with a constant | `A0` | `LDY` | `LDY #$04` | `A0 04` |
| Load the Y register from memory | `AC` | `LDY` | `LDY $0010` | `AC 10 00` |
| No Operation | `EA` | `NOP` | `EA` | `EA` |
| Break *(system call)* | `00` | `BRK` | `00` | `00` |
| Compare a byte in memory to the X register *(sets the Z flag if equal)* | `EC` | `CPX` | `EC $0010` | `EC 10 00` |
| Branch *n* bytes if Z flag = 0 | `D0` | `BNE` | `D0 $EF` | `D0 EF` |
| Increment the value of a byte | `EE` | `INC` | `EE $0021` | `EE 21 00` |
| System Call | `FF` | `SYS` | | `FF` |

### System Call (`SYS`) Modes
- `#$01` in X reg → print the **integer** stored in the Y register
- `#$02` in X reg → print the **00-terminated string** stored at the address in the Y register

> **Note:** `SYS` generates op code `FF` in the OS simulations. When testing at the e-tradition.net emulator, substitute `EA` (NOP) in place of `SYS`, as the real 6502 did not have this instruction.

---

## Example One — Add 3 + 4 and Print Result

```asm
lda #$03     ; Load accumulator with constant 3
sta $0018    ; Store A in location $0018
lda #$04     ; Load accumulator with constant 4
adc $0018    ; Add value at $0018 to A; keep result in A
sta $0019    ; Store result in $0019
ldx #$01     ; Load X with 1 (syscall: print integer)
ldy $0019    ; Load Y with our result
sys          ; System call
brk          ; Normal termination
```

**Object code:**
```
A9 03 8D 18 00 A9 04 6D
18 00 8D 19 00 A2 01 AC
19 00 EA 00
```

---

## Example Two — Loop, Print 1 & 2, Then Print "DONE"

```asm
lda #$3
sta $0041
lda #$1
sta $0040
loop:
  ldy $0040
  ldx #$01
  sys
  inc $0040
  ldx $0040
  cpx $0041
  bne loop
lda #$44     ; 'D'
sta $0042
lda #$4F     ; 'O'
sta $0043
lda #$4E     ; 'N'
sta $0044
lda #$45     ; 'E'
sta $0045
lda #$00     ; null terminator
sta $0046
ldx #$02
ldy #$42     ; address of string
sys
brk
```

**Assembled with addresses:**

| Address | Instruction | Op Code |
|---|---|---|
| `0000` | `LDA #$03` | `A9 03` |
| `0002` | `STA $0041` | `8D 41 00` |
| `0005` | `LDA #$01` | `A9 01` |
| `0007` | `STA $0040` | `8D 40 00` |
| `000A` | `LDY $0040` | `AC 40 00` |
| `000D` | `LDX #$01` | `A2 01` |
| `000F` | `SYS` | `FF` |
| `0010` | `INC $0040` | `EE 40 00` |
| `0013` | `LDX $0040` | `AE 40 00` |
| `0016` | `CPX $0041` | `EC 41 00` |
| `0019` | `BNE LOOP` | `D0 EF` |
| `001B` | `LDA #$44` | `A9 44` |
| `001D` | `STA $0042` | `8D 42 00` |
| `0020` | `LDA #$4F` | `A9 4F` |
| `0022` | `STA $0043` | `8D 43 00` |
| `0025` | `LDA #$4E` | `A9 4E` |
| `0027` | `STA $0044` | `8D 44 00` |
| `002A` | `LDA #$45` | `A9 45` |
| `002C` | `STA $0045` | `8D 45 00` |
| `002F` | `LDA #$00` | `A9 00` |
| `0031` | `STA $0046` | `8D 46 00` |
| `0034` | `LDX #$02` | `A2 02` |
| `0036` | `LDY #$42` | `A0 42` |
| `0038` | `SYS` | `FF` |
| `0039` | `BRK` | `00` |

**Object code:**
```
A9 03 8D 41 00 A9 01 8D 40 00 AC 40 00 A2 01 EA EE 40 00 AE 40 00 EC 41 00 D0
EF A9 44 8D 42 00 A9 4F 8D 43 00 A9 4E 8D 44 00 A9 45 8D 45 00 A9 00 8D 46 00
A2 02 A0 42 EA 00
```

---

## Key Notes

- **Little-endian addressing:** Low-order bytes come first, e.g. address `$0001` is stored as `01 00`
- **Memory safety:** Store data variables at locations well beyond your code (e.g. `$0040`+) to avoid overwriting instructions
- **SYS vs NOP:** Use `FF` for `SYS` in the OS simulator; substitute `EA` (NOP) only when testing at [e-tradition.net/bytes/6502](http://e-tradition.net/bytes/6502)