import { useRef, useState } from "react";
import { importCsv } from "../lib/api";
import { parseCsv } from "../lib/csv";

type Props = {
  onImported: () => void;
  onToast: (message: string) => void;
};

export default function ImportPanel({ onImported, onToast }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        onToast("No valid rows in CSV");
        return;
      }
      const result = await importCsv(rows);
      onToast(
        `Imported ${result.imported} of ${result.total}. ${result.skipped} skipped`
      );
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      onToast(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="card import-card">
      <div className="import-header">
        <h2>Leads</h2>
        <p>Upload your outreach CSV.</p>
      </div>
      <button
        type="button"
        className="primary-btn full"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Importing" : "Import CSV"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </section>
  );
}
