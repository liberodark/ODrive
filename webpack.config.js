const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const webpack = require('webpack');
const path = require("path");

module.exports = {
  context: path.join(__dirname, 'app/assets'),
  entry: {
    //teambuilder: "./javascript/teambuilder.js",
    frontend: "./javascript/index.js"
  },
  output: {
    path: path.join(__dirname, "public/"),
    filename: "javascript/[name].js"
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          use: ["css-loader", "resolve-url-loader"],
          fallback: "style-loader"
        })
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [{
            loader: "css-loader"
          }, {
            loader: "resolve-url-loader"
          }, {
            loader: "sass-loader?sourceMap"
          }],
          fallback: "style-loader"
        })
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
      $: 'jquery', jquery: 'jquery', jQuery: 'jquery' ,
      "window.Tether": 'tether', "Popper": "popper.js"
    }),
    new ExtractTextPlugin("stylesheets/styles.css")
  ],
  externals: {
    jquery: 'jQuery'
  }
}
