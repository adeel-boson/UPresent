// A CSV reader for roster uploads (RFC 4180, as spreadsheets export it):
// quoted fields may hold commas, line breaks, and doubled quotes; lines end
// in LF or CRLF; a leading byte-order mark is dropped. Small enough that a
// dependency isn't worth it (CODING_STANDARDS §12).

export type CsvRecord = {
  // The line the record starts on, 1-based, so a report can point at it even
  // when an earlier quoted field spans lines.
  line: number;
  fields: string[];
};

// Records with every field blank (empty lines, a spreadsheet's trailing
// ",,,") are left out.
export function parseCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let line = 1;
  let recordLine = 1;
  let quoteLine: number | undefined;
  let i = text.startsWith("﻿") ? 1 : 0;

  const endRecord = () => {
    fields.push(field);
    if (fields.some((value) => value.trim() !== "")) {
      records.push({ line: recordLine, fields });
    }
    fields = [];
    field = "";
  };

  while (i < text.length) {
    const char = text[i];
    if (quoteLine !== undefined) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        quoteLine = undefined;
      } else {
        if (char === "\n") line++;
        field += char;
      }
      i++;
    } else if (char === '"') {
      quoteLine = line;
      i++;
    } else if (char === ",") {
      fields.push(field);
      field = "";
      i++;
    } else if (char === "\r" || char === "\n") {
      endRecord();
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line++;
      recordLine = line;
    } else {
      field += char;
      i++;
    }
  }
  if (quoteLine !== undefined) {
    throw new CsvUnclosedQuoteError(quoteLine);
  }
  endRecord();
  return records;
}

export class CsvUnclosedQuoteError extends Error {
  constructor(readonly line: number) {
    super(`The quote opened on line ${line} is never closed.`);
    this.name = "CsvUnclosedQuoteError";
  }
}
