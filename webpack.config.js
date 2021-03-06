const webpack = require("webpack");

module.exports = {
    entry: './ranker.js',
    output: {
        path: './',
        filename: 'ranker.bundle.js'
    },
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader'
        }]
    },
    devtool: 'source-map',
    plugins: [
        new webpack.optimize.UglifyJsPlugin({minimize: true})
    ]
};
