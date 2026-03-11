import path from 'node:path'
import { sheetToJson } from './'

const BATCH_SIZE = 25000

/* // Make instance of SheetReader and start reading the file
const readerXlsx = sheetToJson({
    path: path.resolve(process.cwd(), 'resources', 'large_data_set.xlsx'),
})

readerXlsx.on('row', ({ row, sheetName, rowNumber }) => {
    console.log(JSON.stringify({ rowNumber, sheetName, row }, null, 2))

    if (rowNumber > BATCH_SIZE) readerXlsx.destroy()
})

readerXlsx.on('end', () => {
    console.log('Finished reading the file. sheetName')
})

// Start the reader
readerXlsx.start() */

interface TargetMapper {
  id: number,
  name: string
  lastName: string
}
// Make instance of SheetReader and start reading the file for CSV
const readerCsv = sheetToJson({
  path: path.resolve(process.cwd(), 'resources', 'large_data_set.csv'),
  headers: [['a', 'b', 'c', 'd', 'e', 'f']],
  mappers: [(row: { a: string, b: string, c: string, d: string, e: string, f: string }): TargetMapper => {
    return {
      id: Number(row.a),
      name: row.b,
      lastName: row.c
    }
  }]
})

readerCsv.on('row', ({ row, sheetName, rowNumber }) => {
  console.log(JSON.stringify({ rowNumber, sheetName, row }, null, 2))

  /* if (rowNumber > 10) readerCsv.destroy() */
})

readerCsv.on('end', () => {
  console.log('Finished reading the file')
})

// Start the reader
readerCsv.start()
