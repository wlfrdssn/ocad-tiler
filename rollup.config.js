import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
// import buble from '@rollup/plugin-buble'

const output = (file, plugins) => ({
  input: 'src/index.js',
  output: {
    name: 'OcadTiler',
    format: 'cjs',
    indent: false,
    file,
    exports: 'default',
  },
  plugins,
  external: ['ocad2geojson/src/ocad-to-svg', 'flatbush'],
})

export default [output('ocad-tiler.js', [commonjs(), resolve()])]
