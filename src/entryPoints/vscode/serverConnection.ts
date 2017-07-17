import {
    IServerConnection
} from '../../server/core/connections'

import {
    IRange,
    IValidationIssue,
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    StructureCategories,
    Suggestion,
    MessageSeverity,
    ILocation,
    ITextEdit,
    ILoggerSettings
} from '../../common/typeInterfaces'

import {
    AbstractServerConnection
} from "../../server/core/connectionsImpl"

import utils = require("../../common/utils")

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, IConnection, TextDocumentSyncKind,
    TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
    InitializeParams, InitializeResult, TextDocumentPositionParams,
    CompletionItem, CompletionItemKind, DocumentSymbolParams, SymbolInformation,
    SymbolKind, Position, Location, ReferenceParams, Range, DocumentHighlight, RenameParams,
    WorkspaceEdit, TextDocumentEdit, TextEdit, CompletionList
} from 'vscode-languageserver';

import fs = require("fs")

export class ProxyServerConnection extends AbstractServerConnection implements IServerConnection {

    private loggerSettings : ILoggerSettings;
    private documents: TextDocuments;

    constructor(private vsCodeConnection : IConnection){
        super()

        this.setLoggerConfiguration({
            allowedComponents: [
                "CompletionManagerModule",
                "ProxyServerConnection"
            ],
            //maxSeverity: MessageSeverity.ERROR,
            //maxMessageLength: 50
        })
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

            for (let listener of this.changeDocumentListeners) {
                listener({
                    uri: change.document.uri,
                    text: change.document.getText()
                });
            }
        });

        this.vsCodeConnection.onDocumentSymbol((symbolParams : DocumentSymbolParams)=>{

            return this.getSymbols(symbolParams.textDocument.uri);
        })

        // This handler provides the initial list of the completion items.
        this.vsCodeConnection.onCompletion((textDocumentPosition: TextDocumentPositionParams): Promise<CompletionList> => {

            return this.getCompletion(textDocumentPosition.textDocument.uri, textDocumentPosition.position);
        });

        this.vsCodeConnection.onDefinition((textDocumentPosition: TextDocumentPositionParams): Location[] => {

            return this.openDeclaration(textDocumentPosition.textDocument.uri, textDocumentPosition.position);
        });

        this.vsCodeConnection.onReferences((referenceParams: ReferenceParams): Location[] => {

            return this.findReferences(referenceParams.textDocument.uri, referenceParams.position);
        });

        this.vsCodeConnection.onDocumentHighlight((textDocumentPosition: TextDocumentPositionParams): DocumentHighlight[] => {

            return this.documentHighlight(textDocumentPosition.textDocument.uri, textDocumentPosition.position);
        });

        this.vsCodeConnection.onRenameRequest((renameParams: RenameParams): WorkspaceEdit => {

            return this.rename(renameParams.textDocument.uri,
                renameParams.position, renameParams.newName);
        });
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
                this.debugDetail("Issue text: " + issue.text,
                    "ProxyServerConnection", "validated")


                let originalIssueUri = issue.filePath;
                if (!originalIssueUri) {
                    originalIssueUri = report.pointOfViewUri;
                }

                this.debugDetail("Issue original uri: " + originalIssueUri,
                    "ProxyServerConnection", "validated")

                let issueUri = utils.transformUriToOriginalFormat(report.pointOfViewUri, originalIssueUri);
                this.debugDetail("Issue uri: " + issueUri,
                    "ProxyServerConnection", "validated")

                let document = this.documents.get(issueUri)
                this.debugDetail("Document found: " + (document!=null?"true":"false"),
                    "ProxyServerConnection", "validated")

                let start = document.positionAt(issue.range.start)
                let end = document.positionAt(issue.range.end)

                diagnostics.push({
                    severity: issue.type == "Error"?DiagnosticSeverity.Error:DiagnosticSeverity.Warning,
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

    getSymbols(uri: string) : Promise<SymbolInformation[]> {
        this.debug("ServerConnection:getSymbols called for uri: " + uri,
            "ProxyServerConnection", "getSymbols")

        if (this.documentStructureListeners.length == 0) return Promise.resolve([]);

        //TODO handle many structure providers?
        let structurePromise : Promise<{[categoryName:string] : StructureNodeJSON}> =
            this.documentStructureListeners[0](uri);

        this.debugDetail("ServerConnection:getSymbols got structure promise: " + (structurePromise != null),
            "ProxyServerConnection", "getSymbols")

        if (!structurePromise) return Promise.resolve([]);

        return structurePromise.then(structure=>{
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
        })
    }

    getCompletion(uri: string, position : Position) : Promise<CompletionList> {
        this.debug("getCompletion called for uri: " + uri,
            "ProxyServerConnection", "getCompletion")

        if (this.documentCompletionListeners.length == 0) return Promise.resolve({
            isIncomplete: true,
            items: []
        });

        let document = this.documents.get(uri)
        this.debugDetail("got document: " + (document != null),
            "ProxyServerConnection", "getCompletion")
        if (!document) return Promise.resolve({
            isIncomplete: true,
            items: []
        });

        let offset = document.offsetAt(position);

        this.debugDetail("offset is: " + offset,
            "ProxyServerConnection", "getCompletion")

        let promises = []
        for(let listener of this.documentCompletionListeners) {
            this.debugDetail("Calling a listener",
                "ProxyServerConnection", "getCompletion")

            let listenerResult = listener(uri, offset);
            if (listenerResult) promises.push(listenerResult)
        }

        return Promise.all(promises).then(resolvedResults => {

            let result : CompletionItem[]  = [];

            this.debugDetail("Got suggestion promises resolved: "
                + (resolvedResults?resolvedResults.length:0),
                "ProxyServerConnection", "getCompletion")

            for(let currentPromiseResult of resolvedResults) {

                let suggestions = currentPromiseResult;

                this.debugDetail("Got suggestions: " + (suggestions?suggestions.length:0),
                    "ProxyServerConnection", "getCompletion")

                for (let suggestion of suggestions) {
                    let text = suggestion.text || suggestion.displayText;

                    this.debugDetail("adding suggestion: " + text,
                        "ProxyServerConnection", "getCompletion")

                    text = this.removeCompletionPreviousLineIndentation(text);

                    result.push({
                        label: text,
                        kind: CompletionItemKind.Text
                    })
                }
            }

            return {
                isIncomplete: true,
                items: result
            };
        })
    }

    private removeCompletionPreviousLineIndentation(originalText: string) {
        let lastNewLineIndex = originalText.lastIndexOf("\n");
        if (lastNewLineIndex == -1 || lastNewLineIndex == originalText.length-1) return originalText;

        let textAfterLastNewLine = originalText.substring(lastNewLineIndex + 1);
        if (textAfterLastNewLine.trim() != "") return originalText;

        return originalText.substring(0, lastNewLineIndex+1) + "  ";
    }

    openDeclaration(uri: string, position : Position) : Location[] {
        this.debug("openDeclaration called for uri: " + uri,
            "ProxyServerConnection", "openDeclaration")

        if (this.openDeclarationListeners.length == 0) return [];

        let document = this.documents.get(uri)
        this.debugDetail("got document: " + (document != null),
            "ProxyServerConnection", "openDeclaration")
        if (!document) return [];

        let offset = document.offsetAt(position);

        let result : Location[]  = [];

        for(let listener of this.openDeclarationListeners) {
            let locations = listener(uri, offset);
            this.debugDetail("Got locations: " + (locations?locations.length:0),
                "ProxyServerConnection", "openDeclaration")

            if (locations) {
                for (let location of locations) {
                    let start = document.positionAt(location.range.start)
                    let end = document.positionAt(location.range.end)
                    result.push({
                        uri: location.uri,
                        range: {
                            start: start,
                            end: end
                        }
                    })
                }
            }
        }

        return result;
    }

    findReferences(uri: string, position : Position) : Location[] {
        this.debug("findReferences called for uri: " + uri,
            "ProxyServerConnection", "findReferences")

        if (this.findreferencesListeners.length == 0) return [];

        let document = this.documents.get(uri)
        this.debugDetail("got document: " + (document != null),
            "ProxyServerConnection", "findReferences")
        if (!document) return [];

        let offset = document.offsetAt(position);

        let result : Location[]  = [];

        for(let listener of this.findreferencesListeners) {
            let locations = listener(uri, offset);
            this.debugDetail("Got locations: " + (locations?locations.length:0),
                "ProxyServerConnection", "findReferences")

            if (locations) {
                for (let location of locations) {
                    let start = document.positionAt(location.range.start)
                    let end = document.positionAt(location.range.end)
                    result.push({
                        uri: location.uri,
                        range: {
                            start: start,
                            end: end
                        }
                    })
                }
            }
        }

        return result;
    }

    /**
     * Returns whether path/url exists.
     * @param fullPath
     */
    exists(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.exists(path, (result) => {resolve(result)})
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDir(path: string): Promise<string[]> {
        return new Promise(resolve => {
            fs.readdir(path, (err, result) => {resolve(result)})
        });
    }

    /**
     * Returns whether path/url represents a directory
     * @param path
     */
    isDirectory(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.stat(path, (err, stats) => {resolve(stats.isDirectory())})
        });
    }

    /**
     * File contents by full path/url.
     * @param path
     */
    content(path:string):Promise<string> {
        return new Promise(function(resolve, reject) {

            fs.readFile(path,(err,data)=>{
                if(err!=null){
                    return reject(err);
                }

                let content = data.toString();
                resolve(content);
            });
        });
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

        let filtered = utils.filterLogMessage({
            message:message,
            severity: severity,
            component: component,
            subcomponent: subcomponent
        }, this.loggerSettings)

        if (filtered) {
            this.internalLog(filtered.message, filtered.severity,
                filtered.component, filtered.subcomponent);
        }
    }

    /**
     * Logs a message
     * @param message - message text
     * @param severity - message severity
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    internalLog(message:string, severity: MessageSeverity,
        component?: string, subcomponent?: string) : void {

        let toLog = "";

        let currentDate = new Date();
        toLog += currentDate.getHours() + ":" + currentDate.getMinutes() + ":" +
            currentDate.getSeconds() + ":" + currentDate.getMilliseconds() + " ";

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

    /**
     * Sets connection logger configuration.
     * @param loggerSettings
     */
    setLoggerConfiguration(loggerSettings: ILoggerSettings) {
        this.loggerSettings = loggerSettings;
    }

    documentHighlight(uri: string, position : Position) : DocumentHighlight[] {
        this.debug("documentHighlight called for uri: " + uri,
            "ProxyServerConnection", "documentHighlight")

        if (this.markOccurrencesListeners.length == 0) return [];

        let document = this.documents.get(uri)
        this.debugDetail("got document: " + (document != null),
            "ProxyServerConnection", "documentHighlight")
        if (!document) return [];

        let offset = document.offsetAt(position);

        let result : DocumentHighlight[]  = [];

        for(let listener of this.markOccurrencesListeners) {
            let locations = listener(uri, offset);
            this.debugDetail("Got locations: " + (locations?locations.length:0),
                "ProxyServerConnection", "documentHighlight")

            if (locations) {
                for (let location of locations) {
                    let start = document.positionAt(location.start)
                    let end = document.positionAt(location.end)
                    result.push({
                        kind: 1,
                        range: {
                            start: start,
                            end: end
                        }
                    })
                }
            }
        }

        return result;
    }

    rename(uri: string, position : Position, newName: string) : WorkspaceEdit {
        this.debug("rename called for uri: " + uri + " and name " + newName,
            "ProxyServerConnection", "rename")

        if (this.renameListeners.length == 0) return [];

        let document = this.documents.get(uri)
        this.debugDetail("got document: " + (document != null),
            "ProxyServerConnection", "rename")
        if (!document) return [];

        let offset = document.offsetAt(position);

        let uriToChanges : {[uri:string] : TextEdit[]} = {}
        //TODO same for document versions when they are introduced

        for(let listener of this.renameListeners) {

            let changedDocuments : IChangedDocument[] = listener(uri, offset, newName);

            this.debugDetail("Got changed documents: " +
                (changedDocuments?changedDocuments.length:0),
                "ProxyServerConnection", "rename")

            if (changedDocuments) {
                for (let changedDocument of changedDocuments) {

                    this.debugDetail("Converting changes in a document: " +
                        changedDocument.uri,
                        "ProxyServerConnection", "rename")

                    let existingDocument = this.documents.get(changedDocument.uri);
                    if (!existingDocument) {

                        this.error("Can not apply a full-content change of document " +
                            changedDocument.uri + " because its previous version is not found " +
                            "in the list of documents")
                        continue;
                    }

                    this.debugDetail("Found existing document: " +
                        (existingDocument?"true":"false"),
                        "ProxyServerConnection", "rename")

                    var existingChanges = uriToChanges[changedDocument.uri];
                    this.debugDetail("Found existing changes: " +
                        (existingChanges?"true":"false"),
                        "ProxyServerConnection", "rename")

                    if (!existingChanges) {
                        existingChanges = [];
                    }

                    let editsToApply : TextEdit[] = [];

                    if (changedDocument.text) {
                        this.debugDetail("Changed document has text set.",
                            "ProxyServerConnection", "rename")

                        let previousText = existingDocument.getText();
                        this.debugDetail("Old text:\n" + previousText,
                            "ProxyServerConnection", "rename")

                        let previousTextLength = previousText.length;

                        let startPosition = existingDocument.positionAt(0);
                        let endPosition = previousTextLength==0?
                            existingDocument.positionAt(0):
                            existingDocument.positionAt(previousTextLength-1);


                        this.debugDetail("Edit start position: [" + startPosition.line +
                            " ," + startPosition.character+"]",
                            "ProxyServerConnection", "rename")
                        this.debugDetail("Edit end position: [" + endPosition.line +
                            " ," + endPosition.character+"]",
                            "ProxyServerConnection", "rename")
                        this.debugDetail("Edit text:\n" + changedDocument.text,
                            "ProxyServerConnection", "rename")

                        editsToApply.push({
                            range: {
                                start: startPosition,
                                end: endPosition
                            },
                            newText: changedDocument.text
                        })

                    } else if (changedDocument.textEdits) {
                        this.debugDetail("Changed document has edits set.",
                            "ProxyServerConnection", "rename")

                        editsToApply = changedDocument.textEdits.map(currentEdit=>{
                            let startPosition = existingDocument.positionAt(currentEdit.range.start);
                            let endPosition = existingDocument.positionAt(currentEdit.range.end);

                            return {
                                range: {
                                    start: startPosition,
                                    end: endPosition
                                },
                                newText: currentEdit.text
                            }
                        });
                    }


                    let newChanges = existingChanges.concat(editsToApply)
                    uriToChanges[changedDocument.uri] = newChanges;
                    this.debugDetail("Saving changes for uri " + changedDocument.uri + ": " +
                        uriToChanges[changedDocument.uri].length,
                        "ProxyServerConnection", "rename")
                }
            }
        }

        let uriChanges: TextDocumentEdit[] = [];
        for (let uri in uriToChanges) {
            uriChanges.push({
                textDocument: {
                    uri: uri,
                    version: 0
                },
                edits: uriToChanges[uri]
            })

        }

        let result: WorkspaceEdit = <any>{
            //changes: uriChanges
            documentChanges: uriChanges
        }

        this.debugDetail("Returning",
            "ProxyServerConnection", "rename")
        return result;
    }



}

// function asWorkspaceEdit(item) {
//     if (!item) {
//         return undefined;
//     }
//     let result = new code.WorkspaceEdit();
//     item.changes.forEach(change => {
//         result.set(_uriConverter(change.textDocument.uri), asTextEdits(change.edits));
//     });
//     return result;
// }