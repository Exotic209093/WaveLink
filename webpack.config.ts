import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type { Configuration } from 'webpack';

const config: Configuration = {
  entry: {
    background: path.resolve(__dirname, 'src/background/index.ts'),
    popup: path.resolve(__dirname, 'src/popup/index.tsx'),
    content: path.resolve(__dirname, 'src/content/index.ts'),
    app: path.resolve(__dirname, 'src/app/index.tsx'),
    offscreen: path.resolve(__dirname, 'src/offscreen/index.ts'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/index.js',
    // Async chunks (from dynamic import() in the app and popup) emit under
    // dist/chunks/. publicPath '/' anchors chunk URLs to the extension root
    // (chrome-extension://<id>/chunks/...) so they resolve from any extension
    // page regardless of its directory or query string.
    chunkFilename: 'chunks/[name].chunk.js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@background': path.resolve(__dirname, 'src/background'),
      '@popup': path.resolve(__dirname, 'src/popup'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@data': path.resolve(__dirname, 'src/data'),
    },
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/popup/popup.html'),
      filename: 'popup/popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/app/app.html'),
      filename: 'app/app.html',
      chunks: ['app'],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/offscreen/offscreen.html'),
      filename: 'offscreen/offscreen.html',
      chunks: ['offscreen'],
    }),
  ],
  optimization: {
    splitChunks: false,
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map',
};

export default config;
