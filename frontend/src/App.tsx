import { useEffect, useMemo, useState } from "react";
import { MemoryGrid } from "./components/MemoryGrid";
import { runPipeline, type LogEntry, type ProgramResult } from "./pipeline/runPipeline";
import { CURATED_TESTS } from "./tests/catalog";

const STORAGE_KEY = "ts-compiler-frontend:source";
const TAB_LABELS = ["Console", "CST", "AST", "Symbol Table", "Memory Image"] as const;

type TabLabel = (typeof TAB_LABELS)[number];

function initialSource(): string {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved && saved.length > 0 ? saved : CURATED_TESTS[0].source;
}

export default function App() {
  const [source, setSource] = useState(initialSource);
  const [debug, setDebug] = useState(true);
  const [programs, setPrograms] = useState<ProgramResult[]>([]);

  const lineNumbers = useMemo(
    () => Array.from({ length: source.split("\n").length }, (_, i) => i + 1),
    [source]
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, source);
  }, [source]);

  const run = () => {
    setPrograms(runPipeline({ source, debug }).programs);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>GLaDOS Compile Chamber</h1>
          <span>Aperture Science lexical enrichment protocol</span>
        </div>
        <div className="actions">
          <button className="primary" onClick={run}>Begin Test</button>
          <fieldset className="mode-toggle" aria-label="Output verbosity">
            <label>
              <input type="radio" checked={debug} onChange={() => setDebug(true)} />
              Debug
            </label>
            <label>
              <input type="radio" checked={!debug} onChange={() => setDebug(false)} />
              Quiet
            </label>
          </fieldset>
          <button onClick={() => setPrograms([])}>Clear Chamber</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <h2>Test Chambers</h2>
          <div className="test-list">
            {CURATED_TESTS.map((test) => (
              <button className="test-card" key={test.id} onClick={() => setSource(test.source)}>
                <strong>{test.name}</strong>
                <span>{test.description}</span>
                <em>{test.expected}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-shell" aria-label="Source editor">
          <div className="editor">
            <div className="line-gutter" aria-hidden="true">
              {lineNumbers.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <textarea
              spellCheck={false}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              aria-label="Compiler source"
            />
          </div>
        </section>
      </main>

      <section className="output-panel" aria-label="Compiler output">
        {programs.length === 0 ? (
          <div className="empty-output">Select a test chamber or enter source, then begin the test.</div>
        ) : (
          programs.map((program) => <ProgramOutput program={program} key={program.programNumber} />)
        )}
      </section>
    </div>
  );
}

function ProgramOutput({ program }: { program: ProgramResult }) {
  const [activeTab, setActiveTab] = useState<TabLabel>("Console");

  return (
    <details className={`program-card ${program.status}`} open>
      <summary>
        Program {program.programNumber} Output Cycle - <span>{program.status}</span>
      </summary>
      <div className="tabs" role="tablist" aria-label={`Program ${program.programNumber} output tabs`}>
        {TAB_LABELS.map((tab) => (
          <button className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} key={tab}>
            {tab}
          </button>
        ))}
      </div>
      <div className="tab-body">
        {activeTab === "Console" && <ConsoleTab log={program.log} />}
        {activeTab === "CST" && (
          <PreTab lines={program.cstLines} placeholder="n/a (parse errors or lex errors)" />
        )}
        {activeTab === "AST" && (
          <PreTab lines={program.astLines} placeholder="n/a (semantic analysis did not produce an AST)" />
        )}
        {activeTab === "Symbol Table" && <SymbolTableTab program={program} />}
        {activeTab === "Memory Image" && (
          <MemoryGrid image={program.image} programNumber={program.programNumber} status={program.status} />
        )}
      </div>
    </details>
  );
}

function ConsoleTab({ log }: { log: LogEntry[] }) {
  return (
    <div className="console-tab">
      <div className="console-lines">
        {log.map((entry, index) => (
          <div className={`console-row ${entry.level.toLowerCase()}`} key={`${index}-${entry.text}`}>
            <span className="console-level">{entry.level}</span>
            <span className="console-phase">{entry.phase}</span>
            <span className="console-text">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreTab({ lines, placeholder }: { lines: string[] | null; placeholder: string }) {
  if (lines === null) {
    return <div className="status-banner">{placeholder}</div>;
  }

  return <pre className="tree-output">{lines.join("\n")}</pre>;
}

function SymbolTableTab({ program }: { program: ProgramResult }) {
  if (program.symbols === null) {
    return <div className="status-banner">n/a</div>;
  }

  const rows = program.symbols.map((symbol) => {
    const nameCol = symbol.name.padEnd(3, " ");
    const typeCol = symbol.type.padEnd(8, " ");
    const initCol = String(symbol.isInitialized).padEnd(9, " ");
    const usedCol = String(symbol.isUsed).padEnd(9, " ");
    return `[${nameCol} ${typeCol} ${initCol} ${usedCol} ${symbol.scopeId}]`;
  });
  const header = ` ${"NAME".padEnd(3, " ")} ${"TYPE".padEnd(8, " ")} ${"isINIT?".padEnd(9, " ")} ${"isUSED?".padEnd(9, " ")} SCOPE`;

  return (
    <pre className="tree-output">
      {[header, ...rows].join("\n")}
    </pre>
  );
}
