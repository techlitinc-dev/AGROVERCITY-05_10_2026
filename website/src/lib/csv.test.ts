import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { csvDate, downloadCsv } from './csv';

describe('csvDate', () => {
  it('returns empty string for empty input', () => {
    expect(csvDate('')).toBe('');
  });

  it('returns the input unchanged when it is not a parseable date', () => {
    expect(csvDate('not-a-date')).toBe('not-a-date');
  });

  it('formats a valid ISO date in en-IN locale', () => {
    const out = csvDate('2026-10-09T00:00:00Z');
    expect(out).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('downloadCsv', () => {
  let created: { href: string; download: string; clicked: boolean; removed: boolean }[];
  let lastBlobText: string;

  beforeEach(() => {
    created = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: () => {
        const el = { href: '', download: '', clicked: false, removed: false,
          click() { this.clicked = true; },
          remove() { this.removed = true; } };
        created.push(el);
        return el;
      },
      body: { appendChild: vi.fn() },
    });
    // Blob exists in Node; capture what we serialize so we can assert escaping.
    const OriginalBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class extends OriginalBlob {
      constructor(parts?: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        void Promise.all((parts ?? []).map((p) => (p instanceof Blob ? p.text() : Promise.resolve(String(p)))))
          .then((texts) => { lastBlobText = texts.join(''); });
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('writes a BOM-prefixed CSV and quotes cells containing commas/quotes/newlines', async () => {
    downloadCsv('r.csv', ['name', 'note'], [
      ['Sabzi Mandi, Pune', 'He said "ok"'],
      ['plain', 'line1\nline2'],
    ]);
    await vi.waitFor(() => expect(lastBlobText).toBeDefined());
    expect(lastBlobText).toBe('\uFEFFname,note\n"Sabzi Mandi, Pune","He said ""ok"""\nplain,"line1\nline2"');
    expect(created).toHaveLength(1);
    expect(created[0].download).toBe('r.csv');
    expect(created[0].href).toBe('blob:mock');
    expect(created[0].clicked).toBe(true);
    expect(created[0].removed).toBe(true);
  });
});
