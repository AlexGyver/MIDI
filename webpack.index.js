const path = require('path');
const webpack = require("webpack");
const PACKAGE = require('./package.json');
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const ReplaceHashInFileWebpackPlugin = require('replace-hash-in-file-webpack-plugin');

module.exports = {
    entry: {
        index: './src/index.js',
    },

    output: {
        filename: 'script.js',
        path: path.resolve(__dirname, 'index'),
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
                test: /favicon\.svg$/,
                type: 'asset/resource',
                generator: {
                    filename: 'favicon.svg'
                }
            }
        ]
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: `./src/index.html`,
            inject: true,
            hash: true,
            version: PACKAGE.version,
            title: PACKAGE.title,
            manifest: '<link rel="manifest" href="manifest.json" />',
        }),
        new MiniCssExtractPlugin({
            filename: 'style.css',
        }),
        new webpack.DefinePlugin({
            APP_VER: JSON.stringify(PACKAGE.version),
            USE_SW: JSON.stringify(true),
        }),
        new CopyPlugin({
            patterns: [
                { from: "src/assets/sw.js", to: "" },
                { from: "src/assets/manifest.json", to: "" },
                { from: "src/assets/icon.png", to: "" },
            ],
        }),
        new ReplaceHashInFileWebpackPlugin([
            {
                dir: 'index',
                files: ['sw.js'],
                rules: [
                    {
                        search: /@cachename/,
                        replace: '[hash]'
                    }
                ]
            },
            {
                dir: 'index',
                files: ['manifest.json'],
                rules: [
                    {
                        search: /@theme_color/,
                        replace: PACKAGE.theme_color,
                    },
                    {
                        search: /@background_color/,
                        replace: PACKAGE.background_color,
                    },
                    {
                        search: /@name/g,
                        replace: PACKAGE.title,
                    },
                    {
                        search: /@description/,
                        replace: PACKAGE.description,
                    },
                ]
            }
        ])
    ],

    mode: 'production',
};