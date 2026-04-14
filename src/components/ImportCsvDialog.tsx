import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  type ColumnMapping,
  TARGET_FIELDS,
  TARGET_FIELD_LABELS,
  REQUIRED_FIELDS,
  autoMapColumns,
  buildProcessFileFromCsv,
  type ImportResult,
} from '../utils/csvImport';
import { parseCsvWithHeaders } from '../utils/csv';
import './ImportCsvDialog.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}

export function ImportCsvDialog({ isOpen, onClose, onImport }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset internal state whenever the dialog closes — otherwise reopening
  // would carry over stale parsed data from the previous attempt.
  useEffect(() => {
    if (!isOpen) {
      setFileName(null);
      setHeaders([]);
      setRows([]);
      setMapping({});
      setError(null);
    }
  }, [isOpen]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    try {
      const text = await selected.text();
      const parsed = parseCsvWithHeaders(text);
      if (parsed.headers.length === 0) {
        setError('CSV is empty or has no header row.');
        return;
      }
      setFileName(selected.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read file.");
    }
  };

  const missingRequired = useMemo(
    () => REQUIRED_FIELDS.filter((f) => mapping[f] === undefined),
    [mapping],
  );

  const handleImport = () => {
    if (missingRequired.length > 0 || headers.length === 0) return;
    const result = buildProcessFileFromCsv(headers, rows, mapping, {
      title: fileName?.replace(/\.csv$/i, '') ?? 'Imported Process',
    });
    onImport(result);
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-csv-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <h2 id="import-csv-title">Import CSV</h2>
          <button
            type="button"
            onClick={onClose}
            className="dialog-close"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="dialog-body">
          {!fileName ? (
            <div className="dialog-intro">
              <p>
                Pick a CSV file exported from your process database. The
                first row must contain column headers. You'll confirm the
                column mapping before the data is imported.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="dialog-primary"
              >
                Choose CSV file…
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="text/csv,.csv"
                hidden
                onChange={handleFileChange}
              />
              {error && <p className="dialog-error">{error}</p>}
            </div>
          ) : (
            <>
              <p className="dialog-summary">
                <strong>{fileName}</strong> · {headers.length} column
                {headers.length === 1 ? '' : 's'} · {rows.length} data row
                {rows.length === 1 ? '' : 's'}
              </p>
              <p className="dialog-hint">
                Map each app field to a column from your CSV. Fields marked
                <span className="dialog-required"> *</span> are required.
              </p>
              <table className="dialog-mapping">
                <thead>
                  <tr>
                    <th>App field</th>
                    <th>Source column</th>
                  </tr>
                </thead>
                <tbody>
                  {TARGET_FIELDS.map((field) => {
                    const required = REQUIRED_FIELDS.includes(field);
                    const currentIdx = mapping[field];
                    return (
                      <tr key={field}>
                        <td>
                          {TARGET_FIELD_LABELS[field]}
                          {required && (
                            <span className="dialog-required"> *</span>
                          )}
                        </td>
                        <td>
                          <select
                            value={currentIdx ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMapping((prev) => {
                                const next = { ...prev };
                                if (v === '') {
                                  delete next[field];
                                } else {
                                  next[field] = Number(v);
                                }
                                return next;
                              });
                            }}
                          >
                            <option value="">— Ignore —</option>
                            {headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h || `(column ${i + 1})`}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {missingRequired.length > 0 && (
                <p className="dialog-error">
                  Missing mapping for:{' '}
                  {missingRequired
                    .map((f) => TARGET_FIELD_LABELS[f])
                    .join(', ')}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="dialog-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!fileName || missingRequired.length > 0}
            className="dialog-primary"
          >
            Import
          </button>
        </footer>
      </div>
    </div>
  );
}
