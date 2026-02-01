const path = require('path');
const webpack = require("webpack");
const PACKAGE = require('./package.json');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HTMLInlineCSSWebpackPlugin = require("html-inline-css-webpack-plugin").default;
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = {
    entry: {
        index: './src/index.js',
    },

    output: {
        filename: 'script.js',
        path: path.resolve(__dirname, 'dist/single'),
        clean: true,
        publicPath: '',
    },

    optimization: {
        minimize: true,
        minimizer: [
            new CssMinimizerPlugin(),
            new TerserPlugin(),
        ],
    },

    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader"
                ]
            },
            {
                test: /favicon.svg$/,
                type: 'asset/inline',
            },
        ]
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: `./src/index.html`,
            inject: true,
            filename: PACKAGE.name + '.html',
            version: PACKAGE.version,
            title: PACKAGE.title,
        }),
        new HtmlInlineScriptPlugin({
            htmlMatchPattern: [new RegExp(`${PACKAGE.name + '.html'}$`)],
        }),
        new MiniCssExtractPlugin({
            filename: 'style.css',
        }),
        new webpack.DefinePlugin({
            APP_VER: JSON.stringify(PACKAGE.version),
        }),
        new HTMLInlineCSSWebpackPlugin(),
    ],

    mode: 'production',
};