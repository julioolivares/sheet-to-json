import path from 'node:path'
import { sheetToJson } from './index'

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
  id: number
  name: string
  lastName: string
}

try {
  // Make instance of SheetReader and start reading the file for CSV
  const readerCsv = sheetToJson({
    path: path.resolve(process.cwd(), 'tests', 'fixtures', 'Carga - Detalle lista de precio.xlsx'),
    headers: [['codCobertura', 'descripcion', 'precio', 'activo']],
    encoding: 'utf-8',
    includeFirstRow: false,
    maxRows: 1000, // Arbitrary limit to prevent excessively large files from being processed
  })

  readerCsv.on('row', ({ row, sheetName, rowNumber }) => {
    console.log(JSON.stringify({ rowNumber, sheetName, row }, null, 2))

    /* if (rowNumber > 10) readerCsv.destroy() */
  })

  readerCsv.on('end', () => {
    console.log('Finished reading the file')
  })

  readerCsv.on('error', (error) => {
    console.error('Error reading the file:', error)
  })

  // Start the reader
  readerCsv.start()
} catch (err) {
  console.error('Error:', err)
}
