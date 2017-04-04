//This module reports RAML warnings and errors

import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

import {
    IValidationIssue,
    ILogger
} from '../../common/typeInterfaces'

import {
    IListeningModule
} from './commonInterfaces'

import parser = require("raml-1-parser");
import utils = parser.utils;

type IHighLevelNode = parser.hl.IHighLevelNode;

export function createManager(connection : IServerConnection,
    astManagerModule : IASTManagerModule) : IListeningModule {

    return new ValidationManager(connection, astManagerModule);
}

class Acceptor extends utils.PointOfViewValidationAcceptorImpl {
    private foundIssues : IValidationIssue[] = [];

    constructor(private ramlPath: string, primaryUnit : parser.hl.IParseResult,
        private logger: ILogger) {
        super([], primaryUnit)
    }

    buffers:{[path:string]:any} = {}

    getErrors(): IValidationIssue[] {
        return this.foundIssues;
    }

    accept(issue: parser.hl.ValidationIssue) {
        if(!issue){
            return;
        }

        this.logger.debugDetail("Accepting issue: " + issue.message,
            "ValidationManager", "accept")

        this.transformIssue(issue);

        var issueType = issue.isWarning ? "Warning" :"Error";

        var issuesArray: parser.hl.ValidationIssue[] = [];

        while(issue) {
            issuesArray.push(issue);

            if(issue.extras && issue.extras.length>0){
                issue = issue.extras[0];
            } else {
                issue = null;
            }
        }

        var issues = issuesArray.reverse().map(x=>{
            var result = this.convertParserIssue(x,issueType);

            issueType = "Trace";

            return result;
        });

        for(var i = 0 ; i < issues.length - 1; i++){
            issues[0].trace.push(issues[i + 1]);
        }

        var message = issues[0];

        this.foundIssues.push(message);
    }

    private convertParserIssue(originalIssue: parser.hl.ValidationIssue, issueType:string): IValidationIssue {
        var t = originalIssue.message;

        var ps = originalIssue.path;

        if(originalIssue.unit) {
            ps = originalIssue.unit.absolutePath();
        }

        var trace = {
            code: originalIssue.code,
            type: issueType,
            filePath: originalIssue.path ? ps : null,
            text: t,
            range: {
                start : originalIssue.start,
                end : originalIssue.end
            },
            trace: [],
        };

        return trace;
    }

    acceptUnique(issue: parser.hl.ValidationIssue){
        this.accept(issue);
    }

    end() {

    }
}

class ValidationManager {
    constructor(private connection : IServerConnection, private astManagerModule : IASTManagerModule) {
    }

    listen() {
        this.astManagerModule.onNewASTAvailable((uri: string, version: number, ast: IHighLevelNode)=>{
            this.newASTAvailable(uri, version, ast);
        })
    }

    newASTAvailable(uri: string, version: number, ast: IHighLevelNode):void {

        this.connection.debug("Got new AST:\n" + (ast!=null?ast.printDetails():null),
            "ValidationManager", "newASTAvailable")

        let errors = this.gatherValidationErrors(ast, uri);

        this.connection.debug("Number of errors is:\n" + (errors?errors.length:0),
            "ValidationManager", "newASTAvailable")

        this.connection.validated({
            pointOfViewUri : uri,
            version: version,
            issues : errors
        })
    }

    gatherValidationErrors(astNode: parser.IHighLevelNode, ramlPath: string) : IValidationIssue[] {
        if (!astNode) return;

        let acceptor = new Acceptor(ramlPath, astNode.root(), this.connection);

        astNode.validate(acceptor);

        return acceptor.getErrors();
    }
}