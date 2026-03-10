import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const CLI = path.resolve('dist', 'cli.mjs')
const CSV_PATH = path.resolve('tests', 'fixtures', 'sample.csv')
const XLSX_PATH = path.resolve('resources', 'large_data_set.xlsx')

function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve) => {
        execFile('node', [CLI, ...args], { timeout: 30_000 }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, code: error?.code ? Number(error.code) : (error ? 1 : 0) })
        })
    })
}

// ─── CLI – help & version ───────────────────────────────────
describe('CLI – help & version', () => {
    it('should show help with --help', async () => {
        const { stdout, code } = await run(['--help'])
        assert.equal(code, 0)
        assert.ok(stdout.includes('sheet-to-json'))
        assert.ok(stdout.includes('-p, --path'))
        assert.ok(stdout.includes('-n, --number-rows'))
    })

    it('should show version with --version', async () => {
        const { stdout, code } = await run(['--version'])
        assert.equal(code, 0)
        assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/)
    })

    it('should error when no path is provided', async () => {
        const { stderr, code } = await run([])
        assert.equal(code, 1)
        assert.ok(stderr.includes('-p <path> is required'))
    })

    it('should error on unknown option', async () => {
        const { stderr, code } = await run(['--unknown-flag'])
        assert.equal(code, 1)
        assert.ok(stderr.includes('Unknown option'))
    })
})

// ─── CLI – CSV output ───────────────────────────────────────
describe('CLI – CSV stdout', () => {
    it('should output JSON lines to stdout for CSV', async () => {
        const { stdout, code } = await run([CSV_PATH])
        assert.equal(code, 0)

        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 5)

        const first = JSON.parse(lines[0])
        assert.equal(first.name, 'Alice')
        assert.equal(first.age, '30')
        assert.equal(first.city, 'New York')
    })

    it('should accept positional path argument', async () => {
        const { stdout, code } = await run([CSV_PATH])
        assert.equal(code, 0)
        assert.ok(stdout.trim().length > 0)
    })

    it('should accept -p flag', async () => {
        const { stdout, code } = await run(['-p', CSV_PATH])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 5)
    })

    it('should accept --path long form', async () => {
        const { stdout, code } = await run(['--path', CSV_PATH])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 5)
    })

    it('should limit rows with -n', async () => {
        const { stdout, code } = await run([CSV_PATH, '-n', '2'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 2)
    })

    it('should limit rows with --number-rows', async () => {
        const { stdout, code } = await run([CSV_PATH, '--number-rows', '3'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 3)
    })

    it('should use custom headers with -h', async () => {
        const { stdout, code } = await run([CSV_PATH, '-h', 'col1,col2,col3'])
        assert.equal(code, 0)
        const first = JSON.parse(stdout.trim().split('\n')[0])
        assert.ok('col1' in first)
        assert.ok('col2' in first)
        assert.ok('col3' in first)
    })

    it('should use custom headers with --headers', async () => {
        const { stdout, code } = await run([CSV_PATH, '--headers', 'a,b,c'])
        assert.equal(code, 0)
        const first = JSON.parse(stdout.trim().split('\n')[0])
        assert.ok('a' in first)
        assert.ok('b' in first)
    })

    it('should include first row with -i', async () => {
        const { stdout, code } = await run([CSV_PATH, '-i'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 6)
        const first = JSON.parse(lines[0])
        assert.equal(first.name, 'name')
    })

    it('should include first row with --include-first', async () => {
        const { stdout, code } = await run([CSV_PATH, '--include-first'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 6)
    })

    it('should accept -e encoding flag', async () => {
        const { stdout, code } = await run([CSV_PATH, '-e', 'utf-8'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 5)
    })

    it('should accept --encoding long form', async () => {
        const { stdout, code } = await run([CSV_PATH, '--encoding', 'utf-8'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 5)
    })

    it('should combine multiple flags', async () => {
        const { stdout, code } = await run([CSV_PATH, '-e', 'utf-8', '-h', 'x,y,z', '-i', '-n', '3'])
        assert.equal(code, 0)
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, 3)
        const first = JSON.parse(lines[0])
        assert.ok('x' in first)
    })
})

// ─── CLI – file output ──────────────────────────────────────
describe('CLI – file output (-o)', () => {
    const OUTPUT = path.resolve('tests', 'fixtures', '_test_output.json')

    it('should write JSON to a file with -o', async () => {
        const { stdout, code } = await run([CSV_PATH, '-o', OUTPUT])
        assert.equal(code, 0)
        assert.ok(stdout.includes('Written 5 rows'))
        assert.ok(existsSync(OUTPUT))

        const content = JSON.parse(await readFile(OUTPUT, 'utf-8'))
        assert.equal(content.length, 5)
        assert.equal(content[0].name, 'Alice')

        unlinkSync(OUTPUT)
    })

    it('should write JSON to a file with --output', async () => {
        const { stdout, code } = await run([CSV_PATH, '--output', OUTPUT])
        assert.equal(code, 0)
        assert.ok(stdout.includes('Written 5 rows'))

        const content = JSON.parse(await readFile(OUTPUT, 'utf-8'))
        assert.equal(content.length, 5)

        unlinkSync(OUTPUT)
    })

    it('should write limited rows with -n -o', async () => {
        const { stdout, code } = await run([CSV_PATH, '-n', '3', '-o', OUTPUT])
        assert.equal(code, 0)
        assert.ok(stdout.includes('Written 3 rows'))

        const content = JSON.parse(await readFile(OUTPUT, 'utf-8'))
        assert.equal(content.length, 3)

        unlinkSync(OUTPUT)
    })
})

// ─── CLI – XLSX ─────────────────────────────────────────────
describe('CLI – XLSX', () => {
    const OUTPUT = path.resolve('tests', 'fixtures', '_test_xlsx_output.json')

    it('should read xlsx with -n and -o', async () => {
        const { stdout, code } = await run([XLSX_PATH, '-n', '5', '-o', OUTPUT])
        assert.equal(code, 0)
        assert.ok(stdout.includes('Written 5 rows'))

        const content = JSON.parse(await readFile(OUTPUT, 'utf-8'))
        assert.equal(content.length, 5)

        unlinkSync(OUTPUT)
    })
})

// ─── CLI – error handling ───────────────────────────────────
describe('CLI – error handling', () => {
    it('should error on non-existent file', async () => {
        const { stderr, code } = await run(['/does/not/exist.csv'])
        assert.equal(code, 1)
    })
})
