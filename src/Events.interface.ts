interface RowEvent {
  /**
   * Emitted for each row read from the sheet. The `row` parameter contains the data of the row as an object, and `sheetName` indicates which sheet the row belongs to.
   * @param {object} params - The parameters for the row event.
   * @param {object} params.row - The data of the row as an object.
   * @param {string} params.sheetName - The name of the sheet the row belongs to.
   * @param {number} params.rowNumber - The number of the row in the sheet.
   */
  (params: { row: object; sheetName: string; rowNumber: number }): void
}

interface ErrorEvent {
  /**
   * Emitted when an error occurs during reading.
   * @param {Error} error - The error that occurred.
   */
  (error: Error): void
}

interface EndEvent {
  /**
   * Emitted when a sheet has been fully read.
   */
  (): void
}

interface Events {
  row: RowEvent
  end: EndEvent
  error: ErrorEvent
}

export type { RowEvent, ErrorEvent, EndEvent, Events }
