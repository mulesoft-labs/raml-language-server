import parser = require("raml-1-parser");
import path = require("path");
import fs = require('fs');
import {
    IServerConnection
} from '../core/connections'

import {
    IOpenedDocument,
    IChangedDocument,
    ILogger
} from '../../common/typeInterfaces'

import {
    IEditorManagerModule
} from './editorManager'


export type IHighLevelNode = parser.hl.IHighLevelNode;

var shortid = require('shortid');

var PromiseConstructor = require('promise-polyfill');
if(typeof Promise === 'undefined' && typeof window !== 'undefined') {
    (<any>window).Promise = PromiseConstructor;
}

export interface IASTListener {
    (uri: string, ast: IHighLevelNode):void;
}

/**
 * Manager of AST states.
 */
export interface IASTManagerModule {

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
     * Gets current AST if there is any. If not, performs immediate synchronous parsing and returns the results.
     * @param uri
     */
    forceGetCurrentAST(uri: string) : IHighLevelNode;

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

interface Runnable<ResultType> {

    /**
     * Performs the actual business logics.
     * Should resolve the promise when finished.
     */
    run() : Promise<ResultType>;

    /**
     * Performs the actual business logics synchronously.
     */
    runSynchronously() : IHighLevelNode;

    /**
     * Whether two runnable conflict with each other.
     * Must work fast as its called often.
     * @param other
     */
    conflicts(other : Runnable<any>) : boolean;

    /**
     * Cancels the runnable. run() method should do nothing if launched later,
     * if cancel is called during the run() method execution, run() should stop as soon as it can.
     */
    cancel() : void;

    /**
     * Whether cancel() method was called at least once.
     */
    isCanceled() : boolean;
}

class Reconciler {

    private waitingList : Runnable<any>[] = [];
    private runningList : Runnable<any>[] = [];

    constructor(private timeout : number) {
    }

    public schedule<ResultType>(runnable: Runnable<ResultType>) : Promise<ResultType> {
        this.addToWaitingList(runnable);

        return new Promise((resolve : (value?: ResultType) => void, reject: (error?: any) => void)=>{

            setTimeout(()=>{

                if (runnable.isCanceled()) {
                    this.removeFromWaitingList(runnable)
                    return;
                }

                let currentlyRunning = this.findConflictingInRunningList(runnable);
                if (currentlyRunning) {
                    //TODO add an additional short timeout parameter to launch the reschedule
                    //at the finish of the currently running task for a short time after it.

                    this.schedule(runnable)
                    return;
                }

                this.removeFromWaitingList(runnable)
                this.addToRunningList(runnable)

                this.run(runnable).then(
                    (result)=>{ resolve(result); },
                    (error)=>{ reject(error); }
                )

            }, this.timeout);

        })
    }

    private run<ResultType>(runnable: Runnable<ResultType>) : Promise<ResultType> {

        return runnable.run().then(

            (result):ResultType=>{
                this.removeFromRunningList(runnable);
                return result;
            },
            (error):ResultType=>{
                this.removeFromRunningList(runnable);
                throw error;
            }

        );
    }

    /**
     * Adds item to waiting list and removes anything currently in the list,
     * which conflicts with the new item.
     * @param runnable
     */
    private addToWaitingList<ResultType>(runnable: Runnable<ResultType>) {
        this.waitingList = this.waitingList.filter(current=>{

            let conflicts = runnable.conflicts(current);
            if (conflicts) current.cancel();

            return !conflicts;
        })
    }

    /**
     * Removes runnable from the list of running ones.
     * @param runnable
     */
    private removeFromWaitingList<ResultType>(runnable: Runnable<ResultType>) {
        var index = this.waitingList.indexOf(runnable);
        if (index != -1) this.waitingList.splice(index, 1);
    }

    /**
     * Adds runnable to the list of running ones.
     * @param runnable
     */
    private addToRunningList<ResultType>(runnable: Runnable<ResultType>) {
        this.runningList.push(runnable);
    }

    /**
     * Removes runnable from the list of running ones.
     * @param runnable
     */
    private removeFromRunningList<ResultType>(runnable: Runnable<ResultType>) {
        var index = this.runningList.indexOf(runnable);
        if (index != -1) this.runningList.splice(index, 1);
    }

    /**
     * Finds the first conflicting runnable in the current list.
     * @param runnable
     * @returns {any}
     */
    private findConflictingInRunningList<ResultType>(runnable: Runnable<ResultType>) : Runnable<ResultType> {
        for (let current of this.runningList) {
            if (runnable.conflicts(current)) return current;
        }

        return null;
    }
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
                private editorManager : IEditorManagerModule,
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

    private prepareParserOptions() : Options {
        //TODO think about sharing and storing the project
        this.logger.debug("Running the parsing",
            "ParseDocumentRunnable", "prepareParserOptions");

        var dummyProject: any = parser.project.createProject(path.dirname(this.uri));



        var fsResolver = {
            content : function(path) {

                this.logger.debug("Request for path " + path,
                    "ParseDocumentRunnable", "fsResolver#content")

                if (path.indexOf("file://") == 0) {
                    path = path.substring(7);
                    this.logger.debugDetail("Path changed to: " + path,
                        "ParseDocumentRunnable", "fsResolver#content")
                }
                if (typeof path!="string"){
                    path=""+path;
                }
                if (!fs.existsSync(path)){
                    return null;
                }
                try {
                    return fs.readFileSync(path).toString();
                } catch (e){
                    return null;
                }
            },

            contentAsync : function(path){

                return new Promise(function(resolve, reject) {

                    this.logger.debug("Request for path " + path,
                        "ParseDocumentRunnable", "fsResolver#contentAsync")

                    if (path.indexOf("file://") == 0) {
                        path = path.substring(7);
                        this.logger.debugDetail("Path changed to: " + path,
                            "ParseDocumentRunnable", "fsResolver#contentAsync")
                    }

                    fs.readFile(path,function(err,data){
                        if(err!=null){
                            // return reject(err);
                            return reject(err.toString());
                        }
                        var content = data.toString();
                        resolve(content);
                    });
                });
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
            fsResolver: dummyProject.resolver,
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
            })

        }
    }

    parseSynchronously(parserOptions: any) : IHighLevelNode {
        let editor = this.editorManager.getEditor(this.uri);

        this.logger.debugDetail("Got editor: " + (editor != null),
            "ParseDocumentRunnable", "parseSynchronously");

        if (!editor) {

            let api = parser.loadRAMLSync(parserOptions.filePath, [], parserOptions);
            this.logger.debug("Parsing finished, api: " + (api != null),
                "ParseDocumentRunnable", "parseSynchronously");

            return api.highLevel();
        } else {
            this.logger.debugDetail("EDITOR text:\n" + editor.getText(),
                "ParseDocumentRunnable", "parseSynchronously")

            let api = parser.parseRAMLSync(editor.getText(), parserOptions);
            this.logger.debug("Parsing finished, api: " + (api != null),
                "ParseDocumentRunnable", "parseSynchronously");

            return api.highLevel();
        }
    }

    /**
     * Performs the actual business logics.
     * Should resolve the promise when finished.
     */
    run() : Promise<IHighLevelNode> {

        let options = this.prepareParserOptions();
        return this.parseAsynchronously(options);
    }

    public runSynchronously() : IHighLevelNode {
        let options = this.prepareParserOptions();
        return this.parseSynchronously(options);
    }

    /**
     * Whether two runnable conflict with each other.
     * Must work fast as its called often.
     * @param other
     */
    conflicts(other : Runnable<any>) : boolean {
        if (ParseDocumentRunnable.isInstance(other)) {
            return other.getURI() != this.getURI();
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

    private reconciler : Reconciler = new Reconciler(200);

    constructor(private connection : IServerConnection,
                private editorManager : IEditorManagerModule) {
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

    forceGetCurrentAST(uri: string) : IHighLevelNode {
        let current = this.currentASTs[uri];
        if (current) return current;

        let runner = new ParseDocumentRunnable(uri, this.editorManager,
            this.connection)

        let newAST = runner.runSynchronously();

        if (newAST) {
            this.registerNewAST(uri, newAST)
        }
    }

    onNewASTAvailable(listener: (uri: string, ast: IHighLevelNode, error? : Error)=>{}) {
        this.astListeners.push(listener);
    }

    private notifyASTChanged(uri: string, ast: IHighLevelNode, error? : Error){

        this.connection.debug("Got new AST parser results, notifying the listeners",
            "ASTManager", "notifyASTChanged")

        for (let listener of this.astListeners) {
            listener(uri, ast);
        }
    }

    onOpenDocument(document: IOpenedDocument) : void {
        this.reconciler.schedule(new ParseDocumentRunnable(document.uri, this.editorManager,
            this.connection))
            .then(
                newAST=>this.registerNewAST(document.uri, newAST)
            ).catch(
                error=>this.registerASTParseError(document.uri, error)
            );
    }

    onChangeDocument(document : IChangedDocument) : void {

        this.connection.debug(" document is changed", "ASTManager", "onChangeDocument")

        this.reconciler.schedule(new ParseDocumentRunnable(document.uri, this.editorManager,
            this.connection))
            .then(newAST=>{

                this.connection.debugDetail(
                    "On change document handler promise returned new ast",
                    "ASTManager", "onChangeDocument")

                    this.registerNewAST(document.uri, newAST)
                }
            ).catch(
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

    registerNewAST(uri: string, ast: IHighLevelNode) : void {
        //cleaning ASTs
        //this.currentASTs = {};

        this.connection.debug("Registering new AST for URI: " + uri,
            "ASTManager", "registerNewAST");

        this.currentASTs[uri] = ast;

        this.notifyASTChanged(uri, ast)
    }

    registerASTParseError(uri : string, error : any) {
        //cleaning ASTs
        this.currentASTs = {};

        this.notifyASTChanged(uri, null, error)
    }
}