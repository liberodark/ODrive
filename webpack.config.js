const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const path = require("path");

module.exports = {
  mode: 'development',
  context: path.resolve(__dirname, 'app/assets'),
  entry: {
    //teambuilder: "./javascript/teambuilder.js",
    frontend: "./javascript/index.js"
  },
  output: {
    path: path.resolve(__dirname, "public/"),
    filename: "javascript/[name].js"
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: "style-loader" },
          { loader: "css-loader" },
          { loader: "resolve-url-loader" },
        ],
      },
      {
        test: /\.scss$/,
        use: [
         { loader: MiniCssExtractPlugin.loader,options: {
           publicPath: './',
           reloadAll: true,
			}, 
         },
          { loader: "css-loader" },
          { loader: "sass-loader" },
          { loader: "resolve-url-loader" }, 
               
            ]
        
        ,
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: "file-loader?publicPath=../&name=./files/[hash].[ext]"
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: "url-loader?publicPath=../&name=./files/[hash].[ext]&limit=10000&mimetype=application/font-woff"
      },
      {
        test: /\.png$/,
        use: "url-loader?publicPath=../&name=./files/[hash].[ext]&limit=10000&mimetype=image/png"
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([{
      context: __dirname,
      from: "node_modules/jquery/dist/jquery.min.js",
      to: "javascript"
    }, {
      context: __dirname,
      from: "node_modules/tether/dist/js/tether.min.js",
      to: "javascript"
    }, {
      from: "javascript/preload.js", to: "javascript"
    }, {
      from: "javascript/settings.js", to: "javascript"
    }]),
    new webpack.ProvidePlugin({
      $: 'jquery', jquery: 'jquery', jQuery: 'jquery',
      "window.Tether": 'tether', "Popper": "popper.js"
    }),
    //new MiniCssExtractPlugin("assets/stylesheets/styles.css")
      new MiniCssExtractPlugin({
      filename: '/app/assets/stylesheets/styles.css',
    })
  ],
  externals: {
    jquery: 'jQuery'
  }
};