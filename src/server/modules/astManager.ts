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

    /**
     * Performs the actual business logics.
     * Should resolve the promise when finished.
     */
    run() : Promise<IHighLevelNode> {
        //TODO think about sharing and storing the project
        this.logger.log("ParseDocumentRunnable:run Running the parsing");

        var dummyProject: any = parser.project.createProject(path.dirname(this.uri));

        let editor = this.editorManager.getEditor(this.uri);

        this.logger.log("ParseDocumentRunnable:run Got editor: " + (editor != null));

        var fsResolver = {
            content : function(path) {
                this.logger.log("Request for path " + path)
                if (path.indexOf("file://") == 0) {
                    path = path.substring(7);
                    this.logger.log("Path cahnged to: " + path)
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
                    this.logger.log("Request for path " + path)
                    if (path.indexOf("file://") == 0) {
                        path = path.substring(7);
                        this.logger.log("Path cahnged to: " + path)
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
        this.logger.log("ParseDocumentRunnable:run Parsing uri " + documentUri)
        if (documentUri.indexOf("file://") == 0) {
            documentUri = documentUri.substring(7);
            this.logger.log("ParseDocumentRunnable:run Parsing uri changed to: " + documentUri)
        }

        if (!editor) {

            return parser.loadRAML(documentUri, [], {
                filePath: documentUri,
                fsResolver: dummyProject.resolver,
                httpResolver: dummyProject._httpResolver,
                rejectOnErrors: false
            }).then((api: parser.hl.BasicNode) => {
                this.logger.log("ParseDocumentRunnable:run parsing finished, api: " + (api != null));
                return api.highLevel();
            },error=>{
                this.logger.log("ParseDocumentRunnable:run parsing finished, ERROR: " + error);
            })

        } else {
            this.logger.log("ParseDocumentRunnable:run EDITOR text:\n" + editor.getText())
            return parser.parseRAML(editor.getText(), {
                filePath: documentUri,
                fsResolver: dummyProject.resolver,
                httpResolver: dummyProject._httpResolver,
                rejectOnErrors: false
            }).then((api: parser.hl.BasicNode) => {
                this.logger.log("ParseDocumentRunnable:run parsing finished, api: " + (api != null));
                return api.highLevel();
            },error=>{
                this.logger.log("ParseDocumentRunnable:run parsing finished, ERROR: " + error);
            })

        }


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

        this.connection.onChangeDocument(
            (document : IChangedDocument)=>{this.onChangeDocument(document)}
        );

        this.connection.onCloseDocument(
            (uri : string)=>{this.onCloseDocument(uri)}
        );
    }

    getCurrentAST(uri: string) : IHighLevelNode {
        return this.currentASTs[uri];
    }

    onNewASTAvailable(listener: (uri: string, ast: IHighLevelNode, error? : Error)=>{}) {
        this.astListeners.push(listener);
    }

    private notifyASTChanged(uri: string, ast: IHighLevelNode, error? : Error){
        this.connection.log("ASTManager:notifyASTChanged Got new AST parser results, notifying the listeners")
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
        this.connection.log("ASTManager:onChangeDocument document is changed")
        this.reconciler.schedule(new ParseDocumentRunnable(document.uri, this.editorManager,
            this.connection))
            .then(newAST=>{
                this.connection.log("ASTManager:onChangeDocument On change document handler promise returned new ast")
                    this.registerNewAST(document.uri, newAST)
                }
            ).catch(
                error=>{
                    this.connection.log("ASTManager:onChangeDocument On change document handler promise returned new ast error")
                    this.registerASTParseError(document.uri, error)
                }
            );
    }

    onCloseDocument(uri : string) : void {
        delete this.currentASTs[uri]
    }

    registerNewAST(uri: string, ast: IHighLevelNode) : void {
        //cleaning ASTs
        this.currentASTs = {};

        this.connection.log("ASTManager: registering new AST for URI: " + uri);

        this.currentASTs[uri] = ast;

        this.notifyASTChanged(uri, ast)
    }

    registerASTParseError(uri : string, error : any) {
        //cleaning ASTs
        this.currentASTs = {};

        this.notifyASTChanged(uri, null, error)
    }
}