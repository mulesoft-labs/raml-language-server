import path = require("path")
import suiteUtil = require("./testSuiteUtils")

var args = process.argv;
var inputDataDir = null;
var mochaFile = null;
var dataRoot = null;

for(var i = 0 ; i < args.length ; i++){
    if(i < args.length-1) {
        if (args[i] == "-inputDataDir") {
            inputDataDir = args[++i];
        }
        else if (args[i] == "-mochaFile") {
            mochaFile = args[++i];
        }
        else if (args[i] == "-dataRoot") {
            dataRoot = args[++i];
        }
    }
}

if(inputDataDir==null){
    inputDataDir = path.resolve(suiteUtil.projectFolder(),"src/test/data/structure");
}

if(mochaFile==null){
    mochaFile = path.resolve(suiteUtil.projectFolder(),"src/test/structure_suite.ts");
}

if(dataRoot==null){
    dataRoot = path.resolve(suiteUtil.projectFolder(),"src/test/data")
}
suiteUtil.generateSuite(
    inputDataDir,
    mochaFile,
    dataRoot,
    'Async outline test set'
);

