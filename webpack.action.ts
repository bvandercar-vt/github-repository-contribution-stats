import path from 'path';
import { fileURLToPath } from 'url';

import TsconfigPathsWebpackPlugin from 'tsconfig-paths-webpack-plugin';
import type webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: webpack.Configuration = {
  output: {
    path: path.resolve(__dirname, 'action', 'dist'),
    filename: 'index.cjs',
  },
  target: 'node',
  stats: {
    builtAt: true,
    errorDetails: true,
    errorStack: true,
  },
  mode: 'production',
  entry: {
    index: './action/src/index.ts',
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsWebpackPlugin()],
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.ts/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  plugins: [],
  performance: {
    hints: false,
  },
  ignoreWarnings: [/Failed to parse source map/],
};

export default config;
