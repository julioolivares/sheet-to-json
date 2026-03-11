export interface RowMapper<Target = any> {
  /**
   * A function that takes a row object and returns a transformed version of that object. This allows you to modify the data as it's being read, such as changing property names, filtering out certain properties, or transforming values.
   * @param {Row} row - The original row object read from the sheet.
   * @returns {Target} - The transformed row object.
   */
  (row: any): Target
}
