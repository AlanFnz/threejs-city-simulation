const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      template: 'html/index.html',
    }),
  ],
  entry: './src/main.ts',
  module: {
    rules: [
      {
        // load GLSL shaders in as text
        test: /.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ['raw-loader'],
      },
      {
        // process typescript
        test: /.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // process css
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        // images and GLTF files
        test: /\.(png|jpe?g|gif|svg|gltf|glb)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'assets',
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.ogg$/i,
        use: {
          loader: 'file-loader',
          options: { outputPath: 'assets/audio', name: '[name].[contenthash:8].[ext]' },
        },
      },
      {
        // font files
        test: /\.(otf|ttf)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/fonts/[name][ext]' },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};

