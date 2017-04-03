declare var require;
declare var __dirname;

import index = require("../../index");

var fs = require("fs");
var path = require("path");
var chaiModule = require("chai");

var assert:any = <any>chaiModule.assert

var connection;

export function stopConnection() {
    if(connection) {
        connection.stop();
    }
}

export function data(relativePath: string): string {
    return path.resolve(__dirname, "../../../src/test/data", relativePath);
}

export function getValidationReport(apiPath:string, callback: (result: Object, error: any, closeDocument: () => void) => void): void {
    try {
        var content = fs.readFileSync(apiPath).toString();
        
        connection = index.getNodeClientConnection();

        (<any>connection).loggingEnabled = false;

        connection.documentOpened({
            uri: apiPath,
            
            text: content
        });

        connection.onValidationReport(result => {
            callback(result, null, () => connection.documentClosed(apiPath));
        });
    } catch(e) {
        callback(null, e, () => connection && connection.documentClosed(apiPath));
    }
}

class ValidationReportDoner {
    private alreadyDone = false;
    
    constructor(private fullPath, private done: (error?: any) => void, private onReport: (result: any, reject: any, done: (error?: any) => void) => void) {

    }

    private doDone(closeDocument: () => void, error?: any): void {
        if(this.alreadyDone) {
            return;
        }

        this.alreadyDone = true;

        closeDocument();

        error ? this.done(error) : this.done();
    }
    
    run(): void {
        getValidationReport(this.fullPath, (result: any, reject: any, closeDocument: () => void) => {
            if(!result) {
                this.onReport(null, reject, (error?:any) => {
                    this.doDone(closeDocument, error);
                });
                
                return;
            }
            
            if(result.pointOfViewUri !== this.fullPath) {
                return;
            }
            
            this.onReport(result, reject, (error?:any) => {
                this.doDone(closeDocument, error);
            });
        });
    }
}

export function testErrors(done, fullPath, errors?, ignoreWarnings?) {
    new ValidationReportDoner(fullPath, done, (result: any, rejection: any, done: any) => {
        if(result) {
            var receivedErrors: any = prepareErrors(result, ignoreWarnings);

            try {
                testErrorsSync(receivedErrors, errors);

                done();
            } catch(assertErr) {
                done(assertErr);
            }
        } else {
            done(rejection);
        }
    }).run();
}

export function testErrorsByNumber(done, fullPath, count: number = 0, deviations: number = 0) {
    new ValidationReportDoner(fullPath, done, (result: any, rejection: any, done: any) => {
        if(result) {
            var receivedErrors: any = prepareErrors(result, false);
            
            try {
                testErrorsByNumberSync(receivedErrors, count, deviations);

                done();
            } catch(assertErr) {
                done(assertErr);
            }
        } else {
            done(rejection);
        }
    }).run();
}

function prepareErrors(result, ignoreWarnings): any[] {
    var receivedErrors: any = (result && result.issues) || [];

    if(ignoreWarnings){
        receivedErrors = receivedErrors.filter(err => !(err.type === "Warning"));
    }

    receivedErrors = receivedErrors.length === 0 ? receivedErrors : extractTraces({
        trace: receivedErrors
    });

    receivedErrors = removeDuplicates(receivedErrors);

    receivedErrors = receivedErrors.map(err =>  {
        return {
            message: err.text
        }
    });

    return receivedErrors;
}

function testErrorsByNumberSync(errors, count:number=0,deviations:number=0){
    var condition:boolean = false;
    
    if(deviations==0){
        condition = errors.length == count;
    }
    else if(deviations>0){
        condition = errors.length >= count;
    }
    else{
        condition = errors.length <= count;
    }
    if(!condition) {
        if (errors.length > 0) {
            errors.forEach(error=>{
                if (typeof error.message == 'string') {
                    console.warn(error.message);
                } else {
                    console.warn(error);
                }
                console.warn("\n");
            })

        }
    }
    if(deviations==0) {
        assert.equal(errors.length, count);
    }
    else if(deviations>0){
        assert.equal(errors.length>=count, true);
    }
    else{
        assert.equal(errors.length<=count, true);
    }
}

function testErrorsSync(receivedErrors, expectedErrors=[]){
    var testErrors;

    var hasUnexpectedErr = false;

    if(expectedErrors.length>0){
        testErrors = validateErrors(receivedErrors, expectedErrors);
        hasUnexpectedErr = testErrors.unexpected.length > 0 || testErrors.lostExpected.length > 0;
    }

    var condition:boolean = false;
    condition = receivedErrors.length == expectedErrors.length;

    var errorMsg = '';
    if (hasUnexpectedErr){
        if (testErrors.unexpected.length > 0) {
            errorMsg += "\nUnexpected errors: \n\n";
            testErrors.unexpected.forEach(unexpectedError=> {
                errorMsg += unexpectedError + "\n\n";
            });
        }
        if (testErrors.lostExpected.length > 0){
            errorMsg += "\nDisappeared expected errors: \n\n"
            testErrors.lostExpected.forEach(lostExpected=>{
                errorMsg += lostExpected + "\n\n";
            });
        }
    }

    assert.equal(hasUnexpectedErr, false, "Unexpected errors found\n"+errorMsg);
    assert.equal(receivedErrors.length, expectedErrors.length, "Wrong number of errors\n"+errorMsg);
}

function validateErrors(realErrors:any, expectedErrors:string[]){
    var errors = {'unexpected': [], 'lostExpected': []};
    if (realErrors.length > 0){
        realErrors.forEach(error=>{
            var realError: string;
            if (typeof error.message == 'string'){
                realError = error.message;
            }else{
                realError = error;
            }
            var isExpectedError:boolean = false;
            expectedErrors.forEach(expectedError=>{
                var index = realError.search(new RegExp(expectedError, "mi"));
                if (index>-1) {
                    isExpectedError = true;
                } else {
                    index = realError.search(new RegExp(escapeRegexp(expectedError), "mi"));
                    if (index>-1) isExpectedError = true;
                }
            });
            if (!isExpectedError)
                errors.unexpected.push(realError);
        });

        expectedErrors.forEach(expectedError=>{
            var isLostError = true;
            realErrors.forEach(error=>{
                var realError: string;
                if (typeof error.message == 'string'){
                    realError = error.message;
                }else{
                    realError = error;
                }
                var index = realError.search(new RegExp(expectedError, "i"))
                if (index > -1) {
                    isLostError = false;
                } else {
                    index = realError.search(new RegExp(escapeRegexp(expectedError), "i"));
                    if (index > -1) isLostError = false;
                }
            });
            if (isLostError)
                errors.lostExpected.push(expectedError);
        });
    }
    return errors;
}

function removeDuplicates(errors: any[]): any[] {
    var result = [];

    errors.forEach(error => {
        var found = false;
        
        for(var i = 0; i < result.length; i++) {
            if(compareErrors(error, result[i])) {
                found = true;
                
                break;
            }
        }
        
        if(found) {
           return; 
        }

        result.push(error);
    });

    return result;
}

function compareErrors(e1: any, e2: any): boolean {
    if(e1.range.start !== e2.range.start) {
        return false;
    }
    
    if(e1.range.end !== e2.range.end) {
        return false;
    }
    
    if(e1.code !== e2.code) {
        return false;
    }
    
    if(e1.filePath !== e2.filePath) {
        return false;
    }
    
    if(e1.text !== e2.text) {
        return false;
    }
    
    return true;
}

function extractTraces(error: any): any[] {
    if(!error.trace || error.trace.length === 0) {
        return [error]
    }

    var result = [];

    error.trace.forEach(child => {
        if(child.type === "Trace") {
            child.type = error.type;
        }

        result = result.concat(extractTraces(child))
    });

    return result;
}

function escapeRegexp(regexp: string) {
    return regexp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function sleep(milliseconds) {
    var start = new Date().getTime();
    
    while(true) {
        if((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}