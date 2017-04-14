//This module provides completion proposals

import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

import {
    IEditorManagerModule
} from './editorManager'

import {
    IAbstractTextEditor,
    IListeningModule
} from './commonInterfaces'

import {
    IValidationIssue,
    StructureNodeJSON,
    Icons,
    TextStyles,
    StructureCategories,
    Suggestion,
    ILogger
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;

import {
    pathFromURI,
    dirname,
    basename,
    resolve
} from '../../common/utils'

import suggestions = require("raml-suggestions")


//TODO replace this with a new FS manager which should rely on editor manager and
//other ways to report existing files
import fs = require("fs")

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : IListeningModule {

    return new CompletionManagerModule(connection, astManagerModule, editorManagerModule);
}

export function initialize() {

}

initialize();

class ASTProvider implements suggestions.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule) {
    }

    getASTRoot() {
        return <any> this.astManagerModule.getCurrentAST(this.uri);
    }

    getSelectedNode() {
        return this.getASTRoot();
    }
}

/**
 * Editor state provider.
 */
class EditorStateProvider implements suggestions.IEditorStateProvider {
    private editor : IAbstractTextEditor;

    constructor(private uri: string, private offset: number,
                private editorManagerModule: IEditorManagerModule) {
        this.editor = editorManagerModule.getEditor(uri);
    }

    /**
     * Text of the document opened in the editor.
     */
    getText(): string {
        if (!this.editor) return "";

        return this.editor.getText();
    }

    /**
     * Full path to the document opened in the editor.
     */
    getPath(): string {
        if (!this.editor) return "";

        return this.editor.getPath();
    }

    /**
     * File name of the document opened in the editor.
     */
    getBaseName(): string {
        if (!this.editor) return "";

        return basename(this.getPath());
    }

    /**
     * Editor cursor offset.
     */
    getOffset(): number {
        if (!this.editor) return 0;

        return this.offset;
    }
}

class FSProvider implements suggestions.IFSProvider {

    constructor(private logger: ILogger) {

    }

    contentDirName(content: suggestions.IEditorStateProvider): string {
        let contentPath = content.getPath();

        let converted = pathFromURI(contentPath);

        let result = dirname(converted);

        this.logger.debugDetail("contentDirName result: " + result,
            "CompletionManagerModule", "FSProvider#contentDirName")

        return result;
    }

    dirName(childPath: string): string {
        this.logger.debugDetail("Dirname for path: " + childPath,
            "CompletionManagerModule", "FSProvider#dirName")

        let result =  dirname(childPath);

        this.logger.debugDetail("result: " + result,
            "CompletionManagerModule", "FSProvider#dirName")

        return result;
    }

    exists(checkPath: string): boolean {
        this.logger.debugDetail("Request for existence: " + checkPath,
            "CompletionManagerModule", "FSProvider#exists")

        return fs.existsSync(checkPath);
    }

    resolve(contextPath: string, relativePath: string): string {
        return resolve(contextPath, relativePath);
    }

    isDirectory(dirPath: string): boolean {

        this.logger.debugDetail("Request for directory check: " + dirPath,
            "CompletionManagerModule", "FSProvider#isDirectory")

        var stat = fs.statSync(dirPath);

        return stat && stat.isDirectory();
    }

    readDir(dirPath: string): string[] {
        this.logger.debugDetail("Request for directory content: " + dirPath,
            "CompletionManagerModule", "FSProvider#readDir")

        return fs.readdirSync(dirPath);
    }

    existsAsync(path: string): Promise<boolean> {
        this.logger.debugDetail("Request for existence: " + path,
            "CompletionManagerModule", "FSProvider#existsAsync")

        return new Promise(resolve => {
            fs.exists(path, (result) => {resolve(result)})
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDirAsync(path: string): Promise<string[]> {
        this.logger.debugDetail("Request for directory content: " + path,
            "CompletionManagerModule", "FSProvider#readDirAsync")

        return new Promise(resolve => {
            fs.readdir(path, (err, result) => {resolve(result)})
        });
    }

    /**
     * Check whether the path points to a directory.
     * @param fullPath
     */
    isDirectoryAsync(path: string): Promise<boolean> {

        this.logger.debugDetail("Request for directory check: " + path,
            "CompletionManagerModule", "FSProvider#isDirectoryAsync")

        return new Promise(resolve => {
            fs.stat(path, (err, stats) => {resolve(stats.isDirectory())})
        });
    }
}

class CompletionManagerModule implements IListeningModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    listen() {
        this.connection.onDocumentCompletion((uri, position)=>{
            return this.getCompletion(uri, position);
        })
    }

    getCompletion(uri: string, position: number) : Suggestion[] {
        this.connection.debug("Called getCompletion for position " + position, "CompletionManagerModule", "getCompletion")
        ;
        let astProvider = new ASTProvider(uri, this.astManagerModule);
        let editorProvider = new EditorStateProvider(uri, position, this.editorManagerModule);
        let fsProvider = new FSProvider(this.connection);

        //TODO remove after leaving prototype phase, only needed for logging
        let editorText = editorProvider.getText();
        this.connection.debugDetail("Current text:\n" + editorText, "CompletionManagerModule", "getCompletion")
        let cutStart = position-10>=0?position-10:0
        let cutEnd = position+10<editorText.length?position+10:editorText.length-1;
        let cutText = editorText.substring(cutStart, position+1) + "I" + editorText.substring(position+1, cutEnd)
        this.connection.debugDetail("Completion position cutoff:" + cutText,
            "CompletionManagerModule", "getCompletion")

        let currentAST = this.astManagerModule.getCurrentAST(uri);
        this.connection.debugDetail("Current AST found: " + (currentAST?"true":"false"), "CompletionManagerModule", "getCompletion")
        if (currentAST) {
            this.connection.debugDetail(currentAST.printDetails(), "CompletionManagerModule", "getCompletion");
        }


        suggestions.setDefaultASTProvider(astProvider);

        let result = suggestions.suggest(editorProvider, fsProvider);
        this.connection.debug("Got suggestion results: " + (result?result.length:0), "CompletionManagerModule", "getCompletion")

        for (let suggestion of result) {
            this.connection.debug("Suggestion: text: " + suggestion.text, "CompletionManagerModule", "getCompletion")
            this.connection.debug("Suggestion: displayText: " + suggestion.displayText, "CompletionManagerModule", "getCompletion")
            this.connection.debug("Suggestion: prefix: " + suggestion.prefix, "CompletionManagerModule", "getCompletion")
        }

        return result;
    }
}