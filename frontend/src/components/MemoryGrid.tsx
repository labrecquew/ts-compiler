import { useState } from "react";

interface MemoryGridProps {
  image: { rows: string[]; codeEnd: number; heapStart: number; stream: string } | null;
  status: string;
}

function hexAddress(addr: number): string {
  return `0x${addr.toString(16).toUpperCase().padStart(2, "0")}`;
}

export function MemoryGrid({ image, status }: MemoryGridProps) {
  const [copyLabel, setCopyLabel] = useState("Copy op codes");

  if (image === null) {
    return <div className="status-banner">Memory image unavailable: {status}</div>;
  }

  const bytes = image.rows.flatMap((row) => row.trim().split(/\s+/));
  const fullMemoryImage = image.rows.join("\n");
  const copyFullMemoryImage = async () => {
    await navigator.clipboard.writeText(fullMemoryImage);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy op codes"), 1200);
  };

  return (
    <div className="memory-panel">
      <div className="memory-grid" role="grid" aria-label="6502a memory image">
        {Array.from({ length: 32 }, (_, row) => (
          <div className="memory-row" role="row" key={row}>
            <span className="memory-address">{hexAddress(row * 8)}</span>
            {Array.from({ length: 8 }, (_, col) => {
              const addr = row * 8 + col;
              const region = addr < image.codeEnd ? "code" : addr < image.heapStart ? "static" : "heap";
              return (
                <span className={`memory-cell ${region}`} title={hexAddress(addr)} role="gridcell" key={addr}>
                  {bytes[addr] ?? "00"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="stream-block">
        <div className="stream-header">
          <span>Full memory image op codes</span>
          <button onClick={copyFullMemoryImage}>{copyLabel}</button>
        </div>
        <textarea className="stream-output" readOnly value={fullMemoryImage} aria-label="Full memory image op codes" />
      </div>
      <div className="memory-legend" aria-label="Memory region legend">
        <span><i className="legend-swatch code" /> code</span>
        <span><i className="legend-swatch static" /> static</span>
        <span><i className="legend-swatch heap" /> heap</span>
      </div>
    </div>
  );
}
