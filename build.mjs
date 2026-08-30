import { build } from 'rolldown';

const input = 'src/index.js';

const outputs = [
	{ file: 'dist/snarkdown.js',      format: 'cjs',  exports: 'default', minify: true },
	{ file: 'dist/snarkdown.es.js',   format: 'esm',                       minify: true },
	{ file: 'dist/snarkdown.umd.js',  format: 'iife', name: 'snarkdown', exports: 'default', minify: true }
];

for (const output of outputs) {
	await build({ input, output });
}
