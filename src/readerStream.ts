import { RowMapper } from './mapper.interface'
import { SheetReader } from './sheetReader'
/**
 * Reads an Excel or CSV file and returns a reader instance that emits 'row' events for each row read from the file. The reader can be paused and resumed to control the flow of data.
 * @param {object} params - The parameters for reading the file.
 * @param {string} params.path - The path to the Excel or CSV file to be read. This parameter is required and must point to an existing file.
 * @param {BufferEncoding} [params.encoding='utf-8'] - The encoding of the file. This parameter is optional and defaults to 'utf-8' for CSV files. It is used only when the file type is CSV.
 * @param {string[]} [params.headers] - An optional array of strings representing the key names for the json object. This property is optional and if not provided, the rows will be emitted using the first row of the sheet as the keys for the json object.
 * @param {boolean} [params.includeFirstRow=false] - A boolean indicating whether to include the first row of the sheet in the emitted rows. This property is optional and defaults to false. If set to true, the first row will be included in the emitted rows; if set to false, the first row will be treated as headers and will not be included in the emitted rows.
 * @param {number} [params.maxRows] - The maximum number of data rows to read. If set, the reader will stop after emitting this many rows.
 * @param {RowMapper[]} [params.mappers] - An optional array of functions that take a row object and return a transformed version of that object. This allows you to modify the data as it's being read, such as changing property names, filtering out certain properties, or transforming values. Each function in the array corresponds to a sheet in the case of Excel files with multiple sheets.
 * @returns {SheetReader} A SheetReader instance that emits 'row' events as data is read from the file. The SheetReader instance can be paused and resumed using its pause() and resume() methods, respectively.
 * @throws {Error} Will throw an error if the file path is not provided or if the file does not exist.
 */
export const sheetToJson = ({
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
}): SheetReader => {
  return new SheetReader({ path, encoding, headers, includeFirstRow, maxRows, mappers })
}
