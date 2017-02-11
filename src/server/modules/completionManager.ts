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
    IAbstractTextEditor
} from './commonInterfaces'

import {
    IValidationIssue,
    StructureNodeJSON,
    Icons,
    TextStyles,
    StructureCategories,
    Suggestion
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;

import suggestions = require("raml-suggestions")

//TODO remove this dependency and implement required methods from scratch
import pathModule = require("path")

//TODO replace this with a new FS manager which should rely on editor manager and
//other ways to report existing files
import fs = require("fs")

export interface ICompletionManagerModule {
    listen() : void;
}

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : ICompletionManagerModule {

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

        return pathModule.basename(this.getPath());
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
    contentDirName(content: suggestions.IEditorStateProvider): string {
        var contentPath = content.getPath();

        return pathModule.dirname(contentPath);
    }

    dirName(childPath: string): string {
        return pathModule.dirname(childPath);
    }

    exists(checkPath: string): boolean {
        return fs.existsSync(checkPath);
    }

    resolve(contextPath: string, relativePath: string): string {
        return pathModule.resolve(contextPath, relativePath);
    }

    isDirectory(dirPath: string): boolean {
        var stat = fs.statSync(dirPath);

        return stat && stat.isDirectory();
    }

    readDir(dirPath: string): string[] {
        return fs.readdirSync(dirPath);
    }

    existsAsync(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.exists(path, (result) => {resolve(result)})
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDirAsync(path: string): Promise<string[]> {
        return new Promise(resolve => {
            fs.readdir(path, (err, result) => {resolve(result)})
        });
    }

    /**
     * Check whether the path points to a directory.
     * @param fullPath
     */
    isDirectoryAsync(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.stat(path, (err, stats) => {resolve(stats.isDirectory())})
        });
    }
}

class CompletionManagerModule implements ICompletionManagerModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    listen() {
        this.connection.onDocumentCompletion((uri, position)=>{
            return this.getCompletion(uri, position);
        })
    }

    getCompletion(uri: string, position: number) : Suggestion[] {
        let astProvider = new ASTProvider(uri, this.astManagerModule);
        let editorProvider = new EditorStateProvider(uri, position, this.editorManagerModule);
        let fsProvider = new FSProvider();

        suggestions.setDefaultASTProvider(astProvider);

        return suggestions.suggest(editorProvider, fsProvider);
    }
}