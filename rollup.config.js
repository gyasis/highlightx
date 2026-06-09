import resolve from '@rollup/plugin-node-resolve';

// Builds the HighlighterDecorator class into ESM + UMD bundles.
export default {
  input: 'src/HighlighterDecorator.js',
  output: [
    { file: 'dist/highlighter-decorator.esm.js', format: 'es', sourcemap: true },
    {
      file: 'dist/highlighter-decorator.umd.js',
      format: 'umd',
      name: 'HighlighterDecorator',
      sourcemap: true
    }
  ],
  plugins: [resolve()]
};
