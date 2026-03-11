import { resolve, dirname } from 'node:path'
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sheetToJson } from './readerStream'

interface CliArgs {
  path?: string
  encoding?: BufferEncoding
  headers?: Array<Array<string>>
  includeFirstRow: boolean
  output?: string
  maxRows?: number
}

function printHelp(): void {
  console.log(`
  sheet-to-json - Convert Excel/CSV files to JSON

  Usage:
    sheet-to-json -p <file> [options]

  Options:
    -p, --path             Path to the Excel or CSV file (required)
    -e, --encoding         File encoding (default: utf-8)
    -h, --headers          Comma-separated list of header names
    -i, --include-first    Include first row as data (default: false)
    -n, --number-rows      Maximum number of rows to read
    -o, --output           Output file path (.json). If omitted, prints to stdout
    --help                 Show this help message
    --version              Show version

  Examples:
    sheet-to-json -p data.csv
    sheet-to-json -p data.xlsx -o result.json
    sheet-to-json -p data.csv -h "id,name,email" -i
    sheet-to-json -p data.csv -n 100 -o out.json
`)
}

async function parseArgs(argv: string[]): Promise<CliArgs> {
  const args: CliArgs = { includeFirstRow: false }
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]

    switch (arg) {
      case '-p':
      case '--path':
        args.path = argv[++i]
        break
      case '-e':
      case '--encoding':
        args.encoding = argv[++i] as BufferEncoding
        break
      case '-h':
      case '--headers':
        args.headers = [argv[++i].split(',').map((h) => h.trim())]
        break
      case '-i':
      case '--include-first':
        args.includeFirstRow = true
        break
      case '-n':
      case '--number-rows':
        args.maxRows = parseInt(argv[++i], 10)
        break
      case '-o':
      case '--output':
        args.output = argv[++i]
        break
      case '--help':
        printHelp()
        process.exit(0)
        break
      case '--version': {
        const __dirname = dirname(fileURLToPath(import.meta.url))
        const pkg = JSON.parse(await readFile(resolve(__dirname, '..', 'package.json'), 'utf-8'))
        console.log(pkg.version)
        process.exit(0)
        break
      }
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`)
          printHelp()
          process.exit(1)
        } else if (!args.path) {
          args.path = arg
        }
        break
    }
    i++
  }

  return args
}

async function main() {
  const args = await parseArgs(process.argv.slice(2))

  if (!args.path) {
    console.error('Error: -p <path> is required\n')
    printHelp()
    process.exit(1)
  }

  const filePath = resolve(args.path)
  const rows: object[] = []

  const reader = sheetToJson({
    path: filePath,
    encoding: args.encoding,
    headers: args.headers,
    includeFirstRow: args.includeFirstRow,
    maxRows: args.maxRows,
  })

  process.on('SIGINT', () => {
    reader.destroy()
    process.exit(0)
  })

  reader.on('row', ({ row }) => {
    if (args.output) {
      rows.push(row)
    } else {
      process.stdout.write(JSON.stringify(row) + '\n')
    }
  })

  reader.on('error', (err: Error) => {
    console.error('Error:', err.message)
    process.exit(1)
  })

  reader.on('end', async () => {
    if (args.output) {
      const outputPath = resolve(args.output)
      await writeFile(outputPath, JSON.stringify(rows, null, 2), 'utf-8')
      console.log(`Written ${rows.length} rows to ${outputPath}`)
    }
  })

  reader.start()
}

main()
