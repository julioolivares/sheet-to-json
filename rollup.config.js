const { default: typescript } = require('@rollup/plugin-typescript')
const { default: dts } = require('rollup-plugin-dts')
const isDevelopment = process.env.NODE_ENV === 'development'

const watch = {
    exclude: 'node_modules/**',
    clearScreen: false,
    include: 'src/**/*.ts'
}
const plugins = [typescript()]
const external = ['exceljs', 'node:events', 'node:stream', 'node:fs', 'node:path', 'node:fs/promises', 'node:readline', 'node:path', 'node:url']

const onwarn = (warning, warn) => {

    if (warning.code === 'UNRESOLVED_IMPORT') {
        console.error(warning)
        throw new Error(
            `Dependencia no resuelta: ${warning.exporter}: \n ${warning.message}`
        );
    }

    warn(warning);
}

const builders = [
    {
        input: './src/index.ts',
        output: [
            {
                file: 'dist/index.mjs',
                format: 'esm',
                sourcemap: isDevelopment ? 'inline' : false,
                compact: true,
                inlineDynamicImports: true,
            },
            {
                file: `dist/index.js`,
                format: 'cjs',
                sourcemap: (isDevelopment) ? true : false,
                compact: true,
                inlineDynamicImports: true,

            },
        ],
        plugins,
        external,
        watch,
        onwarn
    },



    {
        input: './src/cli.ts',
        output: [
            {
                file: 'dist/cli.mjs',
                format: 'esm',
                sourcemap: false,
                compact: true,
                inlineDynamicImports: true,
                banner: '#!/usr/bin/env node',
            }
        ],
        plugins,
        external,
        watch,
        onwarn
    },

    // Type declarations
    {
        input: './src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts({
            respectExternal: false
        })],
        external
    }
]

if (isDevelopment) {
    builders.push({
        input: './src/run.ts',
        output: [
            {
                file: 'dist/run.mjs',
                format: 'esm',
                sourcemap: isDevelopment ? 'inline' : false,
                compact: true,
                inlineDynamicImports: true,
            }
        ],
        plugins,
        external,
        watch,
        onwarn
    },)
}

module.exports = builders
