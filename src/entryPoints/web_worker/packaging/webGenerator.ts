import fs = require("fs");
import path = require("path");
import mkdirp = require("mkdirp");
import rimraf = require("rimraf");
var childProcess = require('child_process');
var webpack = require("webpack");

var rootPath = path.join(__dirname, "../../../../");

function createBrowserPackage(minify = false) {
    console.log("Minify: " + minify);

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
    console.log("Preparing to Webpack browser bundle: client.js");

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
            client: relativeSourceClientFile,
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

export function copyDirSyncRecursive(
    to:string,
    from:string):void{

    if(path.resolve(to)==path.resolve(from)){
        return;
    }

    if(!fs.lstatSync(from).isDirectory()){

        mkdirp.sync(path.dirname(to));

        var buffer = fs.readFileSync(from);

        fs.writeFileSync(to, buffer);

        return;
    }

    fs.readdirSync(from).forEach(x=>{

        var fromChild = path.resolve(from,x);

        var toChild = path.resolve(to,x);
        copyDirSyncRecursive(toChild,fromChild);
    });
}

function generateBrowserNpmJSON() {
    let targetNPMPath = path.join(rootPath, "./browser_version_npm");

    let targetPackageJSONPath = path.resolve(targetNPMPath, "./package.json");
    var sourcePackageJsonPath = path.resolve(rootPath, "./package.json");

    let packageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath).toString());

    let targetJson : any = {};
    targetJson.version = packageJson.version;
    targetJson.name = packageJson.name + '-browser';
    targetJson.main = "client.bundle.js";

    fs.writeFileSync(targetPackageJSONPath, JSON.stringify(targetJson, null, '\t'));
}

function createBrowserNPM() {
    let browserVersionPath = path.join(rootPath, "./browserVersion")
    let browserNpmPath = path.join(rootPath, "./browser_version_npm")

    rimraf.sync(browserNpmPath);

    mkdirp.sync(browserNpmPath);

    generateBrowserNpmJSON();

    copyDirSyncRecursive(browserNpmPath, browserVersionPath);
}

function publishBrowserNPM() {
    let browserNpmPath = path.join(rootPath, "./browser_version_npm")
    childProcess.execSync('cd ' + browserNpmPath + ' && npm publish');
}

function createAndPublishBrowserNPM() {

    createBrowserNPM();
    publishBrowserNPM();
}

createBrowserPackage();

declare var process: any;
var isNpm = process.argv[process.argv.indexOf("--type") + 1] === 'npm';

if (isNpm) {
    createAndPublishBrowserNPM();
}