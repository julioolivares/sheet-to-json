# sheet-to-json

A streaming library that converts Excel (.xlsx) and CSV files into JSON objects — row by row, sheet by sheet. It streams the file and emits each row as a plain JavaScript object via events, so it can handle large files without loading everything into memory. It also ships with a CLI for quick conversions from the terminal.

---

## 📦 Installation

### As a library (in your project)

```bash
npm install sheet-to-json
# or
pnpm add sheet-to-json
```

### As a CLI tool (globally)

```bash
npm install -g sheet-to-json
# or
pnpm add -g sheet-to-json
```

After a global install, the `sheet-to-json` command is available everywhere in your terminal.

> **Requires Node.js 18 or later.**

---

## 🔌 API

The library exposes three things from its main entry point:

```ts
import { sheetToJson, ExcelUtils, RowEvent, EndEvent, ErrorEvent } from 'sheet-to-json'
```

### `sheetToJson(options)`

Creates a streaming reader for the given file and returns a `SheetReader` instance.

| Parameter         | Type             | Default   | Description                                                                     |
| ----------------- | ---------------- | --------- | ------------------------------------------------------------------------------- |
| `path`            | `string`         | —         | **(required)** Path to a `.csv` or `.xlsx` file.                                |
| `encoding`        | `BufferEncoding` | `'utf-8'` | Character encoding (CSV only).                                                  |
| `headers`         | `string[][]`     | —         | Custom header names. If omitted, the first row of each sheet is used as keys.   |
| `includeFirstRow` | `boolean`        | `false`   | When `true`, the first row is emitted as data instead of being used as headers. |
| `maxRows`         | `number`         | —         | Stop reading after emitting this many data rows.                                |

**Returns** a `SheetReader` (extends `EventEmitter`) with these methods and events:

| Method / Event  | Description                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| `.start()`      | Begins reading the file. You must register at least a `'row'` listener before calling this. |
| `.pause()`      | Pauses reading (useful for back-pressure).                                                  |
| `.resume()`     | Resumes reading after a pause.                                                              |
| `.isPaused()`   | Returns `true` if the reader is currently paused.                                           |
| `.destroy()`    | Stops reading and cleans up the underlying stream.                                          |
| `'row'` event   | Fired for each row. Receives `{ row, sheetName, rowNumber }`.                               |
| `'end'` event   | Fired when reading is complete.                                                             |
| `'error'` event | Fired on any read error. Receives the `Error` object.                                       |

### `ExcelUtils.excelSerialToDate(serial)`

Converts an Excel serial date number into a JavaScript `Date`. Handy when you encounter raw numeric dates in spreadsheet cells.

```ts
ExcelUtils.excelSerialToDate(44927) // → 2023-01-01T00:00:00.000Z
```

### Type exports

- **`RowEvent`** — Signature of the `'row'` event listener: `(params: { row: object; sheetName: string; rowNumber: number }) => void`
- **`EndEvent`** — Signature of the `'end'` event listener: `() => void`
- **`ErrorEvent`** — Signature of the `'error'` event listener: `(error: Error) => void`

---

## 💻 CLI

Once installed (globally or via `npx`), you can convert files straight from the terminal.

```
sheet-to-json <file> [options]
```

### Options

| Flag | Alias             | Description                                                            |
| ---- | ----------------- | ---------------------------------------------------------------------- |
| `-p` | `--path`          | Path to the file. Can also be passed as the first positional argument. |
| `-e` | `--encoding`      | File encoding (default: `utf-8`).                                      |
| `-h` | `--headers`       | Comma-separated list of header names (e.g. `"id,name,email"`).         |
| `-i` | `--include-first` | Treat the first row as data, not headers.                              |
| `-n` | `--number-rows`   | Maximum number of rows to read.                                        |
| `-o` | `--output`        | Write output to a `.json` file instead of stdout.                      |
|      | `--help`          | Show the help message.                                                 |
|      | `--version`       | Print the package version.                                             |

### Examples

```bash
# Stream a CSV to stdout (one JSON object per line)
sheet-to-json data.csv

# Convert an Excel file and save the result
sheet-to-json -p report.xlsx -o report.json

# Use custom headers and include the first row as data
sheet-to-json data.csv -h "id,name,email" -i

# Read only the first 100 rows
sheet-to-json data.csv -n 100

# Combine options
sheet-to-json data.csv -h "id,name,email" -i -n 500 -o output.json
```

When `-o` is omitted, each row is printed to stdout as a single JSON line — this makes it easy to pipe into other tools like `jq`, `grep`, or another script.

Press `Ctrl+C` at any time to stop reading gracefully.

---

## 🚀 Usage examples

### Basic CSV reading

```ts
import { sheetToJson } from 'sheet-to-json'

const reader = sheetToJson({ path: './users.csv' })

reader.on('row', ({ row, rowNumber }) => {
  console.log(`Row ${rowNumber}:`, row)
})

reader.on('end', () => {
  console.log('Done!')
})

reader.on('error', (err) => {
  console.error('Something went wrong:', err.message)
})

reader.start()
```

### Excel file with multiple sheets

```ts
const reader = sheetToJson({ path: './report.xlsx' })

reader.on('row', ({ row, sheetName, rowNumber }) => {
  console.log(`[${sheetName}] Row ${rowNumber}:`, row)
})

reader.on('end', () => console.log('All sheets processed.'))
reader.start()
```

### Custom headers

If the file doesn't have a header row — or you want to override the existing one — pass your own:

```ts
const reader = sheetToJson({
  path: './raw-data.csv',
  headers: [['id', 'full_name', 'email', 'created_at']],
  includeFirstRow: true,
})

reader.on('row', ({ row }) => {
  // row is typed with your custom keys: { id, full_name, email, created_at }
  console.log(row)
})

reader.start()
```

### Pause and resume (back-pressure)

```ts
const reader = sheetToJson({ path: './big-file.csv' })

reader.on('row', async ({ row }) => {
  reader.pause()
  await saveToDatabase(row) // some slow async operation
  reader.resume()
})

reader.on('end', () => console.log('All rows saved.'))
reader.start()
```

### Limit the number of rows

```ts
const reader = sheetToJson({
  path: './huge-dataset.csv',
  maxRows: 1000,
})

const rows: object[] = []

reader.on('row', ({ row }) => rows.push(row))
reader.on('end', () => {
  console.log(`Got ${rows.length} rows`) // 1000
})

reader.start()
```

### Convert Excel serial dates

```ts
import { ExcelUtils } from 'sheet-to-json'

const date = ExcelUtils.excelSerialToDate(44927)
console.log(date.toISOString()) // "2023-01-01T00:00:00.000Z"
```

---

## 📄 License

MIT
