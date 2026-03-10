export class ExcelUtils {
  /**
   * Converts an Excel serial number to a JavaScript Date object.
   *
   * @param {number} serial
   * @returns {Date} Date object representing the date corresponding to the given Excel serial number.
   *
   */
  static excelSerialToDate(serial: number): Date {
    // Excel's epoch starts on January 1, 1900, which is represented as serial number 1.
    const excelEpoch = Date.UTC(1899, 11, 30)
    const millisecondsInDay = 86400000
    const days = Math.floor(serial)
    const fractionalDay = serial - days
    const totalMs = Math.round(fractionalDay * millisecondsInDay)

    return new Date(excelEpoch + days * millisecondsInDay + totalMs)
  }
}
