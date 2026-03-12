import { EventEmitter } from 'node:events'
import { ReadStream, createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import ExcelJs from 'exceljs'

import { Events } from './Events.interface'
import { createInterface } from 'node:readline'
import { RowMapper } from './mapper.interface'

const FILE_TYPES = {
  EXCEL: 'EXCEL',
  CSV: 'CSV',
} as const

export class SheetReader extends EventEmitter {
  /**
   * The path to the Excel or CSV file to be read.
   * @private
   * @property {string} path
   */
  private path: string

  /**
   * The encoding of the file. Defaults to 'utf-8' for CSV files. This property is used only when the file type is CSV.
   * @private
   * @property {BufferEncoding} encoding
   */
  private encoding: BufferEncoding = 'utf-8'

  /**
   * An optional array of strings representing the key names for the json object. This property is optional and if not provided, the rows will be emitted using the first row of the sheet as the keys for the json object. -- Is expected to be an array of arrays, where each inner array represents the headers for a specific sheet in the case of Excel files with multiple sheets.
   * @private
   * @property {Array<Array<string>>} headers
   */
  private headers?: Array<Array<string>>

  /**
   * A boolean indicating whether to include the first row of the sheet as part of the emitted data. If set to `true`, the first row will be included in the emitted data; if set to `false`, the first row will be treated as headers and will not be included in the emitted data. Defaults to `false`.
   * @private
   * @property {boolean} includeFirstRow
   */
  private includeFirstRow: boolean = false

  /**
   * The maximum number of data rows to read. If set, the reader will stop after emitting this many rows. Defaults to `undefined` (no limit).
   * @private
   * @property {number | undefined} maxRows
   */
  private maxRows?: number

  /**
   * Counter for emitted data rows.
   * @private
   */
  private _emittedRows = 0

  /**
   * The type of the file being read, either 'EXCEL' or 'CSV'. This is determined based on the file extension of the provided path.
   * @private
   * @property {keyof typeof FILE_TYPES} fileType
   */
  private fileType: keyof typeof FILE_TYPES = FILE_TYPES.EXCEL

  /**
   * The read stream
   * @private
   * @property {ReadStream} reader - The read stream used to read the file. This stream is created based on the file type and is used to emit 'row' events as data is read from the file.
   */
  private reader: ReadStream

  /**
   * A boolean indicating whether the reader is currently paused. This is used to control the flow of data when reading from the file, allowing the reader to be paused and resumed as needed.
   * @private
   * @property {boolean} _paused
   */
  private _paused = false

  /**
   * A function that resolves the promise used to pause the reader. This is set when the reader is paused and is called when the reader is resumed to allow the reading process to continue.
   * @private
   * @property {(() => void) | null} _resumeResolve
   */
  private _resumeResolve: (() => void) | null = null


  /**
   * An optional function that takes a row object and returns a transformed version of that object. This allows you to modify the data as it's being read, such as changing property names, filtering out certain properties, or transforming values.
   * @private
   * @property {RowMapper[] | undefined} mappers
   */
  private mappers?: RowMapper[]


  /**
   *  Validates the provided file path. Throws an error if the path is invalid or the file does not exist.
   * @param {string} path - The path to the file to be validated.
   * @throws {Error} Will throw an error if the file path is not provided or if the file does not exist.
   */
  private validateFilePath(path: string): void {
    if (!path) {
      throw new Error('File path is required')
    }

    if (!existsSync(path)) {
      throw new Error(`File does not exist: ${path}`)
    }
  }


  /**
   * Reads a CSV file line by line using the readline module.
   * @private
   */
  private async readCsv() {

    const rl = createInterface({ input: this.reader, crlfDelay: Infinity })
    const sheetName = this.getFileName()

    let rowNumber = 0
    let headers: string[] = []
    let isHeaderSet = false
    let mapper: RowMapper | undefined = this.mappers ? this.mappers[0] : undefined

    for await (const line of rl) {
      if (this._paused) {
        await new Promise<void>((resolve) => {
          this._resumeResolve = resolve
        })
      }
      rowNumber++
      const values = this.parseCsvLine(line)

      if (!isHeaderSet) {
        headers = this.getHeader(values as string[], 1)
        isHeaderSet = true
      }

      if (rowNumber === 1 && !this.includeFirstRow) {
        continue
      }

      this.emit('row', { row: this.mapRow({ values, headers, isCsv: true, mapper }), sheetName, rowNumber })
      this._emittedRows++

      if (this.maxRows && this._emittedRows >= this.maxRows) {
        this.destroy()
        return
      }
    }
  }


  /**
   * Parses a line from a CSV file into an array of fields.
   * @param line
   * @returns {string[]} An array of strings representing the fields in the CSV line.
   */
  private parseCsvLine(line: string): string[] {
    return Array.from(line.matchAll(/(?<=^|,)("(?:[^"]|"")*"|[^,]*)/g), (match) => {
      const field = match[1]
      return field.startsWith('"') ? field.slice(1, -1).replace(/""/g, '"') : field
    })
  }


  /**
   * Reads an Excel file using the exceljs library. Emits a 'row' event for each row read from the sheet, providing the row data and the sheet name.
   * @private
   *
   */
  private async readExcel() {
    const workBook = new ExcelJs.stream.xlsx.WorkbookReader(this.path, {
      hyperlinks: 'ignore',
      styles: 'ignore',
      sharedStrings: 'cache',
      entries: 'ignore',
    })

    let workBookNumber = 0
    let mapper: RowMapper | undefined = undefined
    for await (const worksheet of workBook) {
      workBookNumber++

      mapper = this.mappers ? this.mappers[workBookNumber - 1] : undefined

      let headers: string[] = []
      let isHeaderSet = false

      for await (const row of worksheet) {
        if (this._paused) {
          await new Promise<void>((resolve) => {
            this._resumeResolve = resolve
          })
        }

        if (!isHeaderSet) {
          headers = this.getHeader(row.values as string[], workBookNumber)
          isHeaderSet = true
        }

        if (row.number === 1 && !this.includeFirstRow) {
          continue
        }

        this.emit('row', {
          row: this.mapRow({ values: row.values as ExcelJs.CellValue[], headers, mapper }),
          sheetName: row.worksheet.name,
          rowNumber: row.number,
        })
        this._emittedRows++

        if (this.maxRows && this._emittedRows >= this.maxRows) {
          this.destroy()
          return
        }
      }
    }
  }

  /**
   * Maps the values of a row to the corresponding headers.
   * @param values - The values of the row.
   * @param headers - The headers to map the values to.
   * @returns An object representing the mapped row.
   */
  private mapRow({
    values,
    headers,
    isCsv,
    mapper,
  }: {
    values: ExcelJs.CellValue[]
    headers: string[]
    isCsv?: boolean
    mapper?: RowMapper
  }) {
    const mappedRow = values.reduce(
      (acc, value, index) => {
        if (!isCsv) acc[headers[index - 1] as string] = value
        else acc[headers[index] as string] = value

        return acc
      },
      {} as { [key: string]: ExcelJs.CellValue }
    )

    return mapper ? mapper(mappedRow) : mappedRow
  }

  /**
   * Retrieves the header for the current sheet. If headers were provided in the constructor, it returns the corresponding header for the current workbook number. Otherwise, it returns the default headers extracted from the first row of the sheet.
   * @param defaultHeaders
   * @param workBookNumber
   * @returns
   */
  private getHeader(defaultHeaders: string[], workBookNumber: number): string[] {
    if (this.headers && this.headers[workBookNumber - 1]) return this.headers[workBookNumber - 1]
    return Object.values(defaultHeaders)
  }

  private getFileName(): string {
    return path.basename(this.path)
  }

  /**
   *
   * Initializes a new instance of the SheetReader class.
   * Validates the provided file path and sets up a read stream for the specified file.
   *
   * @param {object} params - An object containing the options.
   * @param {string} params.path - The path to the Excel or CSV file to be read.
   * @param {BufferEncoding} [params.encoding='utf-8'] - The encoding of the file. Defaults to 'utf-8' -- Is used only when file is CSV.
   * @param {Array<Array<string>>} [params.headers] - An optional array of strings representing the key names for the json object. This property is optional and if not provided, the rows will be emitted using the first row of the sheet as the keys for the json object. -- Is expected to be an array of arrays, where each inner array represents the headers for a specific sheet in the case of Excel files with multiple sheets.
   * @param {boolean} [params.includeFirstRow=false] - A boolean indicating whether to include the first row of the sheet as part of the emitted data. If set to `true`, the first row will be included in the emitted data; if set to `false`, the first row will be treated as headers and will not be included in the emitted data. Defaults to `false`.
   * @param {number} [params.maxRows] - The maximum number of data rows to read. If set, the reader will stop after emitting this many rows.
   * @param {RowMapper[]} [params.mappers] - An optional array of functions that take a row object and return a transformed version of that object. This allows you to modify the data as it's being read, such as changing property names, filtering out certain properties, or transforming values. Each function in the array corresponds to a sheet in the case of Excel files with multiple sheets.
   * @throws {Error} Will throw an error if the file path is not provided or if the file does not exist.
   */
  constructor({
    path,
    encoding,
    headers,
    includeFirstRow,
    maxRows,
    mappers,
  }: {
    path: string
    encoding?: BufferEncoding
    headers?: Array<Array<string>>
    includeFirstRow?: boolean
    maxRows?: number
    mappers?: RowMapper[]
  }) {
    super()
    this.path = path
    this.validateFilePath(path)
    this.fileType = path.endsWith('.csv') ? 'CSV' : 'EXCEL'
    this.encoding = encoding || this.encoding
    this.headers = headers
    this.includeFirstRow = includeFirstRow || false
    this.maxRows = maxRows
    this.mappers = mappers
  }

  /**
   * Adds listeners to the read stream for handling 'end' and 'error' events.
   * @private
   * @returns {Promise<this>} A promise that resolves when the listeners have been added.
   */
  public start(): SheetReader {
    try {
      if (this.listenerCount('row') === 0) {
        throw new Error(
          'No listeners registered for "row" event. Please register a listener before starting the reader.'
        )
      }

      this.reader =
        this.fileType === 'EXCEL'
          ? createReadStream(this.path)
          : createReadStream(this.path, { encoding: this.encoding })

      // Run the async read method in the background and catch errors
      const readPromise = this.fileType === 'EXCEL'
        ? this.readExcel()
        : this.readCsv()
      readPromise.catch((error) => this.emit('error', error))

      this.reader.on('end', () => {
        this.emit('end')
      })

      this.reader.on('error', (error) => {
        this.emit('error', error)
      })
    } catch (error) {
      this.emit('error', error as Error)
    } finally {
      return this as SheetReader
    }
  }

  /**
   * Registers a listener that is called for each row read from the sheet.
   *
   * @param event - The `'row'` event.
   * @param listener - Receives the row data and the sheet name it belongs to.
   */
  public on<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.on(event, listener)
  }

  /**
   *  Checks if the reader is currently paused.
   * @returns {boolean} `true` if the reader is paused, otherwise `false`.
   * @public
   */
  public isPaused(): boolean {
    return this._paused
  }

  /**
   * Pauses the reading process. This can be used to temporarily stop reading from the file, for example, to manage backpressure or to perform some processing before resuming.
   * @public
   */
  public pause(): void {
    this._paused = true
  }

  /**
   * Resumes the reading process if it was previously paused. This allows the reader to continue reading from the file after being paused.
   * @public
   */
  public resume(): void {
    this._paused = false
    if (this._resumeResolve) {
      this._resumeResolve()
      this._resumeResolve = null
    }
  }

  /**
   * Destroys the reader and releases any resources associated with it. This should be called when you are done with the reader to ensure that all resources are properly cleaned up.
   * @public
   */
  public destroy(): void {
    if (this.reader) {
      this.pause()
      this.reader.destroy()
      this.reader.emit('end')
    }
  }
}
