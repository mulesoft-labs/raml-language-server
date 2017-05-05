import fs = require("fs");
import path = require("path");
import mkdirp = require("mkdirp");
var webpack = require("webpack");

function createBrowserPackage(minify = true) {
    console.log("Minify: " + minify);
    var rootPath = path.join(__dirname, "../../../../");

    var sourceClientFile = path.join(rootPath, "/dist/entryPoints/web_worker/client/launch.js");
    var sourceWorkerFile = path.join(rootPath, "/dist/entryPoints/web_worker/server/ramlServerWorker.js");

    var targetFolder = path.join(rootPath, "browserVersion");

    var targetClientFile = path.join(targetFolder, "ramlServerClient.js");
    var targetWorkerFile = path.join(targetFolder, "ramlServerWorker.js");

    mkdirp.sync(targetFolder);

    webPackForBrowser(rootPath, sourceClientFile, sourceWorkerFile, targetClientFile, targetWorkerFile, minify);
}

/**
 *
 * @param parserRootFolder - full path to cloned parser repository root folder
 * @param rootFile - full path to parser index JS file
 * @param targetFileName
 * @param callback
 */
function webPackForBrowser(parserRootFolder: string, sourceClientFile : string, sourceWorkerFile: string,
    targetClientFile : string, targetWorkerFile: string, minify: boolean) {
    console.log("Preparing to Webpack browser bundle: raml-1-parser.js");

    var plugins = [];
    if (minify) {
        plugins.push(new webpack.optimize.UglifyJsPlugin({
            minimize: true,
            compress: { warnings: false }
        }));
    }

    var relativeSourceClientFile = path.relative(parserRootFolder, sourceClientFile);
    relativeSourceClientFile = "./"+relativeSourceClientFile;

    var relativeSourceWorkerFile = path.relative(parserRootFolder, sourceWorkerFile);
    relativeSourceWorkerFile = "./"+relativeSourceWorkerFile;

    var targetFolder = path.dirname(targetClientFile);
    var baseTargetClientFileName = path.basename(relativeSourceClientFile);
    var baseTargetWorkerFileName = path.basename(relativeSourceWorkerFile);

    var config = {
        context: parserRootFolder,

        entry: {
            bundle: relativeSourceClientFile,
            worker: relativeSourceWorkerFile
        },

        output: {
            path: targetFolder,

            library: ['RAML', 'Server'],

            filename: "[name].bundle.js",

            libraryTarget: "umd"
        },

        plugins: plugins,
        resolve: {
            alias: {
                fs: path.resolve(__dirname, "../../../../web-tools/emptyFS.js")
            }
        },

        module: {
            loaders: [
                { test: /\.json$/, loader: "json" }
            ]
        },
        externals: [
            {
                "libxml-xsd" : true,
                "ws" : true,
                "typescript" : true,
                "raml-xml-validation": "RAML.XmlValidation",
                "raml-json-validation": "RAML.JsonValidation"
            }
        ],
        node: {
            console: false,
            global: true,
            process: true,
            Buffer: true,
            __filename: true,
            __dirname: true,
            setImmediate: true
        }
    };

    webpack(config, function(err, stats) {
        if(err) {
            console.log(err.message);

            return;
        }

        console.log("Webpack Building Browser Bundle:");

        console.log(stats.toString({reasons : true, errorDetails: true}));
    });
}

createBrowserPackage();
