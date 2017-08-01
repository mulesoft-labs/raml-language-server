//This module maintains AST for RAML units and provides AST contents and
// notifications to other server modules

import parser = require("raml-1-parser");
import path = require("path");
import {
    IServerConnection
} from '../core/connections'

import {
    IOpenedDocument,
    IChangedDocument,
    ILogger
} from '../../common/typeInterfaces'

import {
    Runnable,
    Reconciler
} from '../../common/reconciler'

import {
    IEditorManagerModule
} from './editorManager'

import {
    IListeningModule
} from './commonInterfaces'

export type IHighLevelNode = parser.hl.IHighLevelNode;

var shortid = require('shortid');

var PromiseConstructor = require('promise-polyfill');
if(typeof Promise === 'undefined' && typeof window !== 'undefined') {
    (<any>window).Promise = PromiseConstructor;
}

export interface IASTListener {
    (uri: string, version:number, ast: IHighLevelNode, error? : Error):void;
}

/**
 * Manager of AST states.
 */
export interface IASTManagerModule extends IListeningModule {

    /**
     * Start listening to the connection.
     */
    listen();

    /**
     * Returns currently available AST for the document, if any
     * @param uri
     */
    getCurrentAST(uri: string) : IHighLevelNode;

    /**
     * Gets current AST if there is any.
     * If not, performs immediate asynchronous parsing and returns the results.
     * @param uri
     */
    forceGetCurrentAST(uri: string) : Promise<IHighLevelNode>;

    /**
     * Adds listener for new ASTs being parsed.
     * @param listener
     */
    onNewASTAvailable(listener: IASTListener);
}

/**
 * Creates new AST manager
 * @param connection
 * @returns {ASTManager}
 */
export function createManager(connection : IServerConnection,
                              editorManager : IEditorManagerModule) : IASTManagerModule {
    return new ASTManager(connection, editorManager);
}

/**
 * Copy of Options interface as it cant be referenced directly
 */
interface Options {
    /**
     * Module used for operations with file system
     **/
    fsResolver?: any;
    /**
     * Module used for operations with web
     **/
    httpResolver?: any;
    /**
     * Whether to return Api which contains errors.
     **/
    rejectOnErrors?: boolean;
    /**
     * If true, attribute defaults will be returned if no actual vale is specified in RAML code.
     * Affects only attributes.
     */
    attributeDefaults?: boolean;
    /**
     * Absolute path of the RAML file. May be used when content is provided directly on
     * RAML parser method call instead of specifying file path and making the parser to
     * load the file.
     */
    filePath?: string;
}

class ParseDocumentRunnable implements Runnable<IHighLevelNode> {

    private canceled = false;

    constructor(private uri : string,
                private version: number,
                private editorManager : IEditorManagerModule,
                private connection : IServerConnection,
                private logger: ILogger) {
        //TODO maybe also accept pure content
    }

    public static TYPE_CONST = "astManager.ParseDocumentRunnable";

    public static isInstance(runnable : Runnable<any>) : runnable is ParseDocumentRunnable {
        return (<any>runnable).getTypeConst &&
            typeof((<any>runnable).getTypeConst) == "function" &&
            ParseDocumentRunnable.TYPE_CONST === (<any>runnable).getTypeConst();
    }

    public getTypeConst() : string {
        return ParseDocumentRunnable.TYPE_CONST;
    }

    public toString() : string {
        return "[Runnable " + this.uri + ":" + this.version + "]";
    }

    private prepareParserOptions() : Options {
        //TODO think about sharing and storing the project
        this.logger.debug("Running the parsing",
            "ParseDocumentRunnable", "prepareParserOptions");

        var dummyProject: any = parser.project.createProject(path.dirname(this.uri));

        let connection = this.connection;

        let logger = this.logger;

        var fsResolver = {
            content : function(path) {

                logger.debug("Request for path " + path,
                    "ParseDocumentRunnable", "fsResolver#content")

                logger.error("Should never be called",
                    "ParseDocumentRunnable", "fsResolver#content")
                return null;
            },

            contentAsync : function(path){

                logger.debug("Request for path " + path,
                    "ParseDocumentRunnable", "fsResolver#contentAsync")

                if (path.indexOf("file://") == 0) {
                    path = path.substring(7);
                    logger.debugDetail("Path changed to: " + path,
                        "ParseDocumentRunnable", "fsResolver#contentAsync")
                }

                return connection.content(path);
            }
        }

        let documentUri = this.uri;
        this.logger.debugDetail("Parsing uri " + documentUri,
            "ParseDocumentRunnable", "prepareParserOptions")

        if (documentUri.indexOf("file://") == 0) {
            documentUri = documentUri.substring(7);
            this.logger.debugDetail("Parsing uri changed to: " + documentUri,
                "ParseDocumentRunnable", "prepareParserOptions")
        }

        return {
            filePath: documentUri,
            fsResolver: fsResolver,
            httpResolver: dummyProject._httpResolver,
            rejectOnErrors: false
        }
    }

    private parseAsynchronously(parserOptions: any) : Promise<IHighLevelNode> {
        let editor = this.editorManager.getEditor(this.uri);

        this.logger.debugDetail("Got editor: " + (editor != null),
            "ParseDocumentRunnable", "parseAsynchronously");

        if (!editor) {

            return parser.loadRAML(parserOptions.filePath, [], parserOptions).then((api: parser.hl.BasicNode) => {

                this.logger.debug("Parsing finished, api: " + (api != null),
                    "ParseDocumentRunnable", "parseAsynchronously");

                return api.highLevel();
            },error=>{

                this.logger.debug("Parsing finished, ERROR: " + error,
                    "ParseDocumentRunnable", "parseAsynchronously");

                throw error;
            })

        } else {
            this.logger.debugDetail("EDITOR text:\n" + editor.getText(),
                "ParseDocumentRunnable", "parseAsynchronously")

            return parser.parseRAML(editor.getText(), parserOptions).then((api: parser.hl.BasicNode) => {

                this.logger.debug("Parsing finished, api: " + (api != null),
                    "ParseDocumentRunnable", "parseAsynchronously");

                return api.highLevel();
            },error=>{

                this.logger.debug("Parsing finished, ERROR: " + error,
                    "ParseDocumentRunnable", "parseAsynchronously");
                throw error;
            })

        }
    }

    //Commented out as we do not allow to run parsing synhronously any more due to the connection,
    //which provides file system information does this only asynchronously
    // parseSynchronously(parserOptions: any) : IHighLevelNode {
    //
    //     let editor = this.editorManager.getEditor(this.uri);
    //
    //     this.logger.debugDetail("Got editor: " + (editor != null),
    //         "ParseDocumentRunnable", "parseSynchronously");
    //
    //     if (!editor) {
    //
    //         let api = parser.loadRAMLSync(parserOptions.filePath, [], parserOptions);
    //         this.logger.debug("Parsing finished, api: " + (api != null),
    //             "ParseDocumentRunnable", "parseSynchronously");
    //
    //         return api.highLevel();
    //     } else {
    //         this.logger.debugDetail("EDITOR text:\n" + editor.getText(),
    //             "ParseDocumentRunnable", "parseSynchronously")
    //
    //         let api = parser.parseRAMLSync(editor.getText(), parserOptions);
    //         this.logger.debug("Parsing finished, api: " + (api != null),
    //             "ParseDocumentRunnable", "parseSynchronously");
    //
    //         return api.highLevel();
    //     }
    // }

    /**
     * Performs the actual business logics.
     * Should resolve the promise when finished.
     */
    run() : Promise<IHighLevelNode> {

        let options = this.prepareParserOptions();
        return this.parseAsynchronously(options);
    }

    //Commented out as we do not allow to run parsing synhronously any more due to the connection,
    //which provides file system information does this only asynchronously
    // public runSynchronously() : IHighLevelNode {
    //     let options = this.prepareParserOptions();
    //     return this.parseSynchronously(options);
    // }

    /**
     * Whether two runnable conflict with each other.
     * Must work fast as its called often.
     * @param other
     */
    conflicts(other : Runnable<any>) : boolean {
        if (ParseDocumentRunnable.isInstance(other)) {
            return other.getURI() == this.getURI();
        }

        return false;
    }

    /**
     * Cancels the runnable. run() method should do nothing if launched later,
     * if cancel is called during the run() method execution, run() should stop as soon as it can.
     */
    cancel() : void {
        this.canceled = true;
    }

    /**
     * Whether cancel() method was called at least once.
     */
    isCanceled() : boolean {
        return this.canceled;
    }

    public getURI() {
        return this.uri;
    }
}

class ASTManager implements IASTManagerModule {

    private astListeners: IASTListener[] = [];

    private currentASTs : {[uri:string] : IHighLevelNode} = {};

    private reconciler : Reconciler;

    constructor(private connection : IServerConnection,
                private editorManager : IEditorManagerModule) {

        this.reconciler = new Reconciler(connection, 250);
    }

    listen() : void {
        this.connection.onOpenDocument(
            (document: IOpenedDocument)=>{this.onOpenDocument(document)}
        );

        this.editorManager.onChangeDocument(
            (document : IChangedDocument)=>{this.onChangeDocument(document)}
        );

        this.connection.onCloseDocument(
            (uri : string)=>{this.onCloseDocument(uri)}
        );
    }

    getCurrentAST(uri: string) : IHighLevelNode {
        return this.currentASTs[uri];
    }

    forceGetCurrentAST(uri: string) : Promise<IHighLevelNode> {
        let current = this.currentASTs[uri];
        if (current) return Promise.resolve(current);

        let runner = new ParseDocumentRunnable(uri, null, this.editorManager,
            this.connection, this.connection)

        let newASTPromise = runner.run();
        if (!newASTPromise) return null;

        return newASTPromise.then(newAST=>{
            let version = null;
            let editor = this.editorManager.getEditor(uri);
            if (editor) version = editor.getVersion();

            this.registerNewAST(uri, version, newAST)

            return newAST;
        })
    }

    onNewASTAvailable(listener: (uri: string, version: number,
                                 ast: IHighLevelNode, error? : Error)=>void) {
        this.astListeners.push(listener);
    }

    private notifyASTChanged(uri: string, version: number, ast: IHighLevelNode, error? : Error){

        this.connection.debug("Got new AST parser results, notifying the listeners",
            "ASTManager", "notifyASTChanged")

        for (let listener of this.astListeners) {
            listener(uri, version, ast);
        }
    }

    onOpenDocument(document: IOpenedDocument) : void {
        this.reconciler.schedule(new ParseDocumentRunnable(document.uri, 0, this.editorManager,
            this.connection, this.connection))
            .then(
                newAST=>this.registerNewAST(document.uri, document.version, newAST),
                error=>this.registerASTParseError(document.uri, error)
            )

    }

    onChangeDocument(document : IChangedDocument) : void {

        this.connection.debug(" document is changed", "ASTManager", "onChangeDocument")

        this.reconciler.schedule(new ParseDocumentRunnable(document.uri, document.version,
            this.editorManager, this.connection, this.connection))
            .then(newAST=>{

                    this.connection.debugDetail(
                        "On change document handler promise returned new ast",
                        "ASTManager", "onChangeDocument")

                    this.registerNewAST(document.uri, document.version, newAST)
                },
                error=>{

                    this.connection.debugDetail(
                        "On change document handler promise returned new ast error",
                        "ASTManager", "onChangeDocument")

                    this.registerASTParseError(document.uri, error)
                }
            );
    }

    onCloseDocument(uri : string) : void {
        delete this.currentASTs[uri]
    }

    registerNewAST(uri: string, version: number, ast: IHighLevelNode) : void {
        //cleaning ASTs
        //this.currentASTs = {};

        this.connection.debug("Registering new AST for URI: " + uri,
            "ASTManager", "registerNewAST");

        this.currentASTs[uri] = ast;

        this.notifyASTChanged(uri, version, ast)
    }

    registerASTParseError(uri : string, error : any) {
        //cleaning ASTs
        this.currentASTs = {};

        this.notifyASTChanged(uri, null, error)
    }
}