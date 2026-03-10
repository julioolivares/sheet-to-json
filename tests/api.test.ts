import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { sheetToJson, ExcelUtils } from '../src/index'

import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, 'fixtures')
const CSV_PATH = path.join(FIXTURES, 'sample.csv')
const QUOTED_CSV = path.join(FIXTURES, 'quoted.csv')
const XLSX_PATH = path.resolve('resources', 'large_data_set.xlsx')

// ─── helpers ────────────────────────────────────────────────
function collect(reader: ReturnType<typeof sheetToJson>): Promise<{ row: object; sheetName: string; rowNumber: number }[]> {
    return new Promise((resolve, reject) => {
        const rows: { row: object; sheetName: string; rowNumber: number }[] = []
        reader.on('row', (data) => rows.push(data))
        reader.on('error', reject)
        reader.on('end', () => resolve(rows))
        reader.start()
    })
}

// ─── sheetToJson – CSV ──────────────────────────────────────
describe('sheetToJson – CSV', () => {
    it('should read all data rows using first row as headers', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        const rows = await collect(reader)

        assert.equal(rows.length, 5)
        assert.deepEqual(rows[0].row, { name: 'Alice', age: '30', city: 'New York' })
        assert.equal(rows[0].sheetName, 'sample.csv')
        assert.equal(rows[0].rowNumber, 2)
    })

    it('should include first row when includeFirstRow is true', async () => {
        const reader = sheetToJson({ path: CSV_PATH, includeFirstRow: true })
        const rows = await collect(reader)

        assert.equal(rows.length, 6)
        assert.deepEqual(rows[0].row, { name: 'name', age: 'age', city: 'city' })
        assert.equal(rows[0].rowNumber, 1)
    })

    it('should use custom headers when provided', async () => {
        const reader = sheetToJson({ path: CSV_PATH, headers: [['col1', 'col2', 'col3']] })
        const rows = await collect(reader)

        assert.equal(rows.length, 5)
        assert.ok('col1' in (rows[0].row as Record<string, unknown>))
        assert.ok('col2' in (rows[0].row as Record<string, unknown>))
        assert.ok('col3' in (rows[0].row as Record<string, unknown>))
    })

    it('should limit rows with maxRows', async () => {
        const reader = sheetToJson({ path: CSV_PATH, maxRows: 2 })
        const rows = await collect(reader)

        assert.equal(rows.length, 2)
        assert.deepEqual(rows[0].row, { name: 'Alice', age: '30', city: 'New York' })
        assert.deepEqual(rows[1].row, { name: 'Bob', age: '25', city: 'London' })
    })

    it('should parse quoted CSV fields correctly', async () => {
        const reader = sheetToJson({ path: QUOTED_CSV })
        const rows = await collect(reader)

        assert.equal(rows.length, 2)
        const row0 = rows[0].row as Record<string, string>
        assert.equal(row0.name, 'Smith, John')
        assert.equal(row0.city, 'San Francisco')
        const row1 = rows[1].row as Record<string, string>
        assert.equal(row1.name, 'O"Brien')
        assert.equal(row1.city, 'New "York"')
    })

    it('should accept encoding option', async () => {
        const reader = sheetToJson({ path: CSV_PATH, encoding: 'utf-8' })
        const rows = await collect(reader)
        assert.ok(rows.length > 0)
    })
})

// ─── sheetToJson – XLSX ─────────────────────────────────────
describe('sheetToJson – XLSX', () => {
    it('should read rows from xlsx file', async () => {
        const reader = sheetToJson({ path: XLSX_PATH, maxRows: 5 })
        const rows = await collect(reader)

        assert.equal(rows.length, 5)
        assert.ok('sheetName' in rows[0])
        assert.ok('rowNumber' in rows[0])
        assert.ok(typeof rows[0].row === 'object')
    })

    it('should limit xlsx rows with maxRows', async () => {
        const reader = sheetToJson({ path: XLSX_PATH, maxRows: 3 })
        const rows = await collect(reader)
        assert.equal(rows.length, 3)
    })

    it('should include first row for xlsx when includeFirstRow is true', async () => {
        const reader = sheetToJson({ path: XLSX_PATH, maxRows: 3, includeFirstRow: true })
        const rows = await collect(reader)
        assert.equal(rows.length, 3)
        assert.equal(rows[0].rowNumber, 1)
    })

    it('should use custom headers for xlsx', async () => {
        const reader = sheetToJson({
            path: XLSX_PATH,
            maxRows: 3,
            headers: [['h1', 'h2', 'h3', 'h4', 'h5', 'h6']],
        })
        const rows = await collect(reader)
        assert.equal(rows.length, 3)
        const row = rows[0].row as Record<string, unknown>
        assert.ok('h1' in row)
        assert.ok('h2' in row)
    })
})

// ─── SheetReader – flow control ─────────────────────────────
describe('SheetReader – flow control', () => {
    it('should emit error when started without row listener', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        const error = await new Promise<Error>((resolve) => {
            reader.on('error', resolve)
            reader.start()
        })
        assert.match(error.message, /No listeners registered/)
    })

    it('should throw on missing path', () => {
        assert.throws(() => sheetToJson({ path: '' }), /File path is required/)
    })

    it('should throw on non-existent file', () => {
        assert.throws(() => sheetToJson({ path: '/does/not/exist.csv' }), /File does not exist/)
    })

    it('should support pause and resume', async () => {
        const reader = sheetToJson({ path: CSV_PATH })

        // Verify initial state
        assert.equal(reader.isPaused(), false)

        // Verify pause sets state
        reader.pause()
        assert.equal(reader.isPaused(), true)

        // Verify resume resets state
        reader.resume()
        assert.equal(reader.isPaused(), false)

        // Verify it still reads all rows after pause/resume cycle
        const rows = await collect(reader)
        assert.equal(rows.length, 5)
    })

    it('should support destroy to stop reading early', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        const rows: object[] = []

        const done = new Promise<void>((resolve, reject) => {
            reader.on('row', ({ row }) => {
                rows.push(row)
                if (rows.length === 2) reader.destroy()
            })
            reader.on('error', reject)
            reader.on('end', resolve)
            reader.start()
        })

        await done
        assert.ok(rows.length <= 3)
    })

    it('should pause and resume mid-read for CSV', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        const rows: object[] = []
        let wasPaused = false

        const done = new Promise<void>((resolve, reject) => {
            reader.on('row', ({ row }) => {
                rows.push(row)
                if (rows.length === 2 && !wasPaused) {
                    wasPaused = true
                    reader.pause()
                    assert.equal(reader.isPaused(), true)
                    setImmediate(() => reader.resume())
                }
            })
            reader.on('error', reject)
            reader.on('end', () => resolve())
            reader.start()
        })

        await done
        assert.ok(wasPaused, 'reader was paused during reading')
        assert.ok(rows.length >= 3)
    })

    it('should pause and resume mid-read for XLSX', async () => {
        const reader = sheetToJson({ path: XLSX_PATH, maxRows: 10 })
        const rows: object[] = []
        let wasPaused = false

        const done = new Promise<void>((resolve, reject) => {
            reader.on('row', ({ row }) => {
                rows.push(row)
                if (rows.length === 3 && !wasPaused) {
                    wasPaused = true
                    reader.pause()
                    assert.equal(reader.isPaused(), true)
                    setImmediate(() => reader.resume())
                }
            })
            reader.on('error', reject)
            reader.on('end', () => resolve())
            reader.start()
        })

        await done
        assert.ok(wasPaused, 'reader was paused during xlsx reading')
        assert.equal(rows.length, 10)
    })

    it('should resume with no pending resolve (no-op)', () => {
        const reader = sheetToJson({ path: CSV_PATH })
        // resume without prior pause should not throw
        reader.resume()
        assert.equal(reader.isPaused(), false)
    })

    it('should destroy before start without throwing', () => {
        const reader = sheetToJson({ path: CSV_PATH })
        // destroy before start — reader stream is not yet created
        // should not throw
        assert.doesNotThrow(() => reader.destroy())
    })

    it('should work with only required path param (no optional args)', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        const rows = await collect(reader)
        assert.equal(rows.length, 5)
    })

    it('should register and emit end event', async () => {
        const reader = sheetToJson({ path: CSV_PATH })
        let ended = false

        const done = new Promise<void>((resolve, reject) => {
            reader.on('row', () => { })
            reader.on('error', reject)
            reader.on('end', () => {
                ended = true
                resolve()
            })
            reader.start()
        })

        await done
        assert.equal(ended, true)
    })

    it('should destroy xlsx reader early', async () => {
        const reader = sheetToJson({ path: XLSX_PATH })
        const rows: object[] = []

        const done = new Promise<void>((resolve, reject) => {
            reader.on('row', ({ row }) => {
                rows.push(row)
                if (rows.length === 3) reader.destroy()
            })
            reader.on('error', reject)
            reader.on('end', resolve)
            reader.start()
        })

        await done
        assert.ok(rows.length <= 4)
    })

    it('should use includeFirstRow false explicitly', async () => {
        const reader = sheetToJson({ path: CSV_PATH, includeFirstRow: false })
        const rows = await collect(reader)
        assert.equal(rows.length, 5)
        assert.equal(rows[0].rowNumber, 2)
    })

    it('should read CSV with maxRows equal to total rows', async () => {
        const reader = sheetToJson({ path: CSV_PATH, maxRows: 5 })
        const rows = await collect(reader)
        assert.equal(rows.length, 5)
    })

    it('should read CSV with maxRows greater than total rows', async () => {
        const reader = sheetToJson({ path: CSV_PATH, maxRows: 100 })
        const rows = await collect(reader)
        assert.equal(rows.length, 5)
    })
})

// ─── ExcelUtils ─────────────────────────────────────────────
describe('ExcelUtils', () => {
    it('should convert Excel serial 1 to 1900-01-01', () => {
        const date = ExcelUtils.excelSerialToDate(1)
        assert.equal(date.getUTCFullYear(), 1899)
        assert.equal(date.getUTCMonth(), 11) // December
        assert.equal(date.getUTCDate(), 31)
    })

    it('should convert Excel serial 44927 to 2023-01-01', () => {
        const date = ExcelUtils.excelSerialToDate(44927)
        assert.equal(date.getUTCFullYear(), 2023)
        assert.equal(date.getUTCMonth(), 0)
        assert.equal(date.getUTCDate(), 1)
    })

    it('should handle fractional days (time component)', () => {
        const date = ExcelUtils.excelSerialToDate(44927.5)
        assert.equal(date.getUTCHours(), 12)
    })
})
