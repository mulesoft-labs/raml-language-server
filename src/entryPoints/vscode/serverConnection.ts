import {
    IServerConnection
} from '../../server/core/connections'

import {
    IValidationIssueRange,
    IValidationIssue,
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    StructureCategories,
    Suggestion,
    MessageSeverity
} from '../../common/typeInterfaces'

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, IConnection, TextDocumentSyncKind,
    TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
    InitializeParams, InitializeResult, TextDocumentPositionParams,
    CompletionItem, CompletionItemKind,DocumentSymbolParams, SymbolInformation,
    SymbolKind, Position
} from 'vscode-languageserver';

export class ProxyServerConnection implements IServerConnection {

    private openDocumentListeners : {(document: IOpenedDocument):void}[] = [];
    private changeDocumentListeners : {(document: IChangedDocument):void}[] = [];
    private closeDocumentListeners : {(string):void}[] = [];
    private documentStructureListeners : {(uri : string):{[categoryName:string] : StructureNodeJSON}}[] = [];
    private documentCompletionListeners : {(uri : string, position: number):Suggestion[]}[] = [];
    private documents: TextDocuments;

    constructor(private vsCodeConnection : IConnection){
    }

    public listen() : void {

        // Create a simple text document manager. The text document manager
        // supports full document sync only
        this.documents = new TextDocuments();

        // Make the text document manager listen on the connection
        // for open, change and close text document events
        this.documents.listen(this.vsCodeConnection);

        // The content of a text document has changed. This event is emitted
        // when the text document first opened or when its content has changed.
        this.documents.onDidChangeContent((change) => {

            this.debug(`${change.document.uri} changed`, "ProxyServerConnection")
            this.debugDetail(`Text is:\n ` + change.document.getText(), "ProxyServerConnection");

            for (let listener of this.changeDocumentListeners) {
                listener({
                    uri: change.document.uri,
                    text: change.document.getText()
                });
            }
        });

        // this.vsCodeConnection.onDidOpenTextDocument((params) => {
        //     // A text document got opened in VSCode.
        //     // params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
        //     // params.textDocument.text the initial full content of the document.
        //     this.log(`${params.textDocument.uri} opened, document text is:\n` + params.textDocument.text);
        //
        //     for (let listener of this.openDocumentListeners) {
        //         listener({
        //             uri: params.textDocument.uri,
        //             text: params.textDocument.text
        //         });
        //     }
        // });

        // this.vsCodeConnection.onDidChangeTextDocument((params) => {
        //     // The content of a text document did change in VSCode.
        //     // params.textDocument.uri uniquely identifies the document.
        //     // params.contentChanges describe the content changes to the document.
        //     this.vsCodeConnection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
        // });

        // this.vsCodeConnection.onDidCloseTextDocument((params) => {
        //     // A text document got closed in VSCode.
        //     // params.textDocument.uri uniquely identifies the document.
        //     this.log(`${params.textDocument.uri} closed.`);
        //
        //     for (let listener of this.closeDocumentListeners) {
        //         listener(params.textDocument.uri);
        //     }
        // });

        this.vsCodeConnection.onDidChangeWatchedFiles((change) => {
            // Monitored files have change in VSCode
            this.debug('We received an file change event', "ProxyServerConnection");
        });

        this.vsCodeConnection.onDocumentSymbol((symbolParams : DocumentSymbolParams)=>{
            this.debug('We received get symbols request', "ProxyServerConnection");
            return this.getSymbols(symbolParams.textDocument.uri);
        })

        // This handler provides the initial list of the completion items.
        this.vsCodeConnection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
            // The pass parameter contains the position of the text document in
            // which code complete got requested. For the example we ignore this
            // info and always provide the same completion items.
            return this.getCompletion(textDocumentPosition.textDocument.uri, textDocumentPosition.position);
        });
        //
        // // This handler resolve additional information for the item selected in
        // // the completion list.
        // this.vsCodeConnection.onCompletionResolve((item: CompletionItem): CompletionItem => {
        //     if (item.data === 1) {
        //         item.detail = 'TypeScript details',
        //             item.documentation = 'TypeScript documentation'
        //     } else if (item.data === 2) {
        //         item.detail = 'JavaScript details',
        //             item.documentation = 'JavaScript documentation'
        //     }
        //     return item;
        // });
    }

    /**
     * Adds a listener to document open notification. Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDocument(listener: (document: IOpenedDocument)=>void) {
        this.openDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document change notification. Must notify listeners in order of registration.
     * @param listener
     */
    onChangeDocument(listener: (document : IChangedDocument)=>void) {
        this.changeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document close notification. Must notify listeners in order of registration.
     * @param listener
     */
    onCloseDocument(listener: (uri : string)=>void) {
        this.closeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentStructure(listener: (uri : string)=>{[categoryName:string] : StructureNodeJSON}) {
        this.documentStructureListeners.push(listener);
    }

    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentCompletion(listener: (uri : string, position: number)=>Suggestion[]) {
        this.documentCompletionListeners.push(listener);
    }

    /**
     * Reports latest validation results
     * @param report
     */
    validated(report:IValidationReport) : void {
        this.debug("HERE WE HAVE FRESH NEW VALIDATION REPORT for uri: " + report.pointOfViewUri,
            "ProxyServerConnection", "validated")
        this.debugDetail("Number of issues: " + (report.issues!=null?report.issues.length:0),
            "ProxyServerConnection", "validated")

        let diagnostics: Diagnostic[] = [];

        if (report && report.issues) {
            for (let issue of report.issues) {

                let document = this.documents.get(report.pointOfViewUri)
                let start = document.positionAt(issue.range.start)
                let end = document.positionAt(issue.range.end)
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: start,
                        end: end
                    },
                    message: issue.text,
                    source: 'ex'
                });


                this.debugDetail("ISSUE: " + issue.text,
                    "ProxyServerConnection", "validated");
                this.debugDetail("ISSUE, document found: " + (document!=null),
                    "ProxyServerConnection", "validated");
            }
        }

        this.vsCodeConnection.sendDiagnostics({
            uri: report.pointOfViewUri,
            diagnostics
        });
    }

    getSymbols(uri: string) : SymbolInformation[] {
        this.debug("ServerConnection:getSymbols called for uri: " + uri,
            "ProxyServerConnection", "getSymbols")

        if (this.documentStructureListeners.length == 0) return [];

        //TODO handle many structure providers?
        let structure : {[categoryName:string] : StructureNodeJSON} = this.documentStructureListeners[0](uri);

        this.debugDetail("ServerConnection:getSymbols got structure: " + (structure != null),
            "ProxyServerConnection", "getSymbols")

        if (!structure) return [];

        let document = this.documents.get(uri)
        this.debugDetail("ServerConnection:getSymbols got document: " + (document != null),
            "ProxyServerConnection", "getSymbols")
        if (!document) return [];

        var result : SymbolInformation[] = [];
        for (let categoryName in structure) {
            let vsKind : SymbolKind = null;

            if (StructureCategories[StructureCategories.ResourcesCategory] == categoryName) {
                vsKind = SymbolKind.Function
            } else if (StructureCategories[StructureCategories.ResourceTypesAndTraitsCategory] == categoryName) {
                vsKind = SymbolKind.Interface;
            } else if (StructureCategories[StructureCategories.SchemasAndTypesCategory] == categoryName) {
                vsKind = SymbolKind.Class;
            } else if (StructureCategories[StructureCategories.OtherCategory] == categoryName) {
                vsKind = SymbolKind.Constant;
            }

            let topLevelNode = structure[categoryName];
            let items = topLevelNode.children;
            if (items) {
                result = result.concat(items.map(item=>{
                    let start = document.positionAt(item.start)
                    let end = document.positionAt(item.end)
                    this.debugDetail("ServerConnection:getSymbols converting item " + item.text,
                        "ProxyServerConnection", "getSymbols");

                    let symbolInfo : SymbolInformation = {
                        name: item.text,
                        kind: vsKind,
                        location: {
                            uri: uri,
                            range: {
                                start: start,
                                end: end
                            }
                        }
                    }
                    return symbolInfo;
                }));
            }
        }

        return result;
    }

    getCompletion(uri: string, position : Position) : CompletionItem[] {
        this.debug("ServerConnection:getCompletion called for uri: " + uri,
            "ProxyServerConnection", "getCompletion")

        if (this.documentCompletionListeners.length == 0) return [];

        let document = this.documents.get(uri)
        this.debugDetail("ServerConnection:getCompletion got document: " + (document != null),
            "ProxyServerConnection", "getCompletion")
        if (!document) return [];

        let offset = document.offsetAt(position);

        this.debugDetail("ServerConnection:getCompletion offset is: " + offset,
            "ProxyServerConnection", "getCompletion")

        let result : CompletionItem[]  = [];

        for(let listener of this.documentCompletionListeners) {

            this.debugDetail("ServerConnection:getCompletion Calling a listener",
                "ProxyServerConnection", "getCompletion")

            let suggestions = listener(uri, offset);

            this.debugDetail("ServerConnection:getCompletion Got suggestions: " + (suggestions?suggestions.length:0),
                "ProxyServerConnection", "getCompletion")

            for (let suggestion of suggestions) {
                let text = suggestion.text || suggestion.displayText;

                this.debugDetail("ServerConnection:getCompletion adding suggestion: " + text,
                    "ProxyServerConnection", "getCompletion")

                result.push({
                    label: text,
                    kind: CompletionItemKind.Text
                })
            }
        }

        return result;
    }

    /**
     * Logs a message
     * @param message - message text
     * @param severity - message severity
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    log(message:string, severity: MessageSeverity,
        component?: string, subcomponent?: string) : void {

        let toLog = "";
        if (severity != MessageSeverity.WARNING && severity != MessageSeverity.ERROR) {
            MessageSeverity[severity];
        }

        if (component) toLog+= (component + ": ")
        if (subcomponent) toLog+= (subcomponent + ": ")

        toLog += message;

        if (severity == MessageSeverity.WARNING) {
            console.warn(toLog);
        } else if (severity == MessageSeverity.ERROR) {
            console.error(toLog);
        } else {
            console.log(toLog);
        }
    }

    /**
     * Logs a DEBUG severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debug(message:string,
          component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG, component, subcomponent);
    }

    /**
     * Logs a DEBUG_DETAIL severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugDetail(message:string,
                component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG_DETAIL, component, subcomponent);
    }

    /**
     * Logs a DEBUG_OVERVIEW severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    debugOverview(message:string,
                  component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.DEBUG_OVERVIEW, component, subcomponent);
    }

    /**
     * Logs a WARNING severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    warning(message:string,
            component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.WARNING, component, subcomponent);
    }

    /**
     * Logs an ERROR severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    error(message:string,
          component?: string, subcomponent?: string) : void {
        this.log(message, MessageSeverity.ERROR, component, subcomponent);
    }
}