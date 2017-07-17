import {
    IServerConnection,
    IRange,
    IValidationIssue,
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    ILogger,
    MessageSeverity,
    ILocation,
    DetailsItemJSON,
    IDetailsReport
} from '../../../server/core/connections'

import {
    ProtocolMessage,
    MessageToServerType, MessageToClientType
} from '../../common/protocol'

import {
    MessageDispatcher
} from '../../common/messageDispatcher'

import {IStructureReport, ILoggerSettings} from "../../../common/typeInterfaces";

import {
    filterLogMessage
} from "../../../common/utils"

export abstract class AbstractMSServerConnection extends MessageDispatcher<MessageToClientType> implements IServerConnection {

    abstract sendMessage (message : ProtocolMessage<MessageToClientType>) : void;

    private loggerSettings : ILoggerSettings;

    private openDocumentListeners : {(document: IOpenedDocument):void}[] = [];
    private changeDocumentListeners : {(document: IChangedDocument):void}[] = [];
    private closeDocumentListeners : {(string):void}[] = [];
    private documentStructureListeners : {(uri : string):Promise<{[categoryName:string] : StructureNodeJSON}>}[] = [];
    private documentCompletionListeners : {(uri : string, position: number):Promise<Suggestion[]>}[] = [];
    private openDeclarationListeners : {(uri : string, position: number):ILocation[]}[] = [];
    private findReferencesListeners : {(uri : string, position: number):ILocation[]}[] = [];
    private markOccurrencesListeners : {(uri : string, position: number):IRange[]}[] = [];
    private renameListeners : {(uri : string, position: number, newName: string):IChangedDocument[]}[] = [];
    private documentDetailsListeners : {(uri : string, position: number):Promise<DetailsItemJSON>}[] = [];
    private changePositionListeners: {(uri : string, position: number):void}[] = [];

    constructor(name : string) {
        super(name)
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
    onDocumentStructure(listener: (uri : string)=>Promise<{[categoryName:string] : StructureNodeJSON}>) {
        this.documentStructureListeners.push(listener);
    }

    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentCompletion(listener: (uri : string, position: number)=>Promise<Suggestion[]>) {
        this.documentCompletionListeners.push(listener);
    }

    /**
     * Adds a listener to document open declaration request.  Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDeclaration(listener: (uri: string, position: number) => ILocation[]){
        this.openDeclarationListeners.push(listener);
    }

    /**
     * Adds a listener to document find references request.  Must notify listeners in order of registration.
     * @param listener
     */
    onFindReferences(listener: (uri: string, position: number) => ILocation[]){
        this.findReferencesListeners.push(listener);
    }

    /**
     * Finds the set of document (and non-document files) edits to perform the requested rename.
     * @param listener
     */
    onRename(listener: (uri: string, position: number, newName: string) => IChangedDocument[]) {
        this.renameListeners.push(listener)
    }

    /**
     * Reports latest validation results
     * @param report
     */
    validated(report:IValidationReport) : void {
        this.send({
            type : "VALIDATION_REPORT",
            payload : report
        })
    }

    /**
     * Reports new calculated structure when available.
     * @param uri - document uri
     * @param structure - structure for the document
     */
    structureAvailable(report:IStructureReport) {
        this.send({
            type : "STRUCTURE_REPORT",
            payload : report
        })
    }

    /**
     * Returns whether path/url exists.
     * @param fullPath
     */
    exists(path: string): Promise<boolean> {
        return this.sendWithResponse({
            type: "EXISTS",
            payload: path
        })
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDir(path: string): Promise<string[]> {
        return this.sendWithResponse({
            type: "READ_DIR",
            payload: path
        })
    }

    /**
     * Returns whether path/url represents a directory
     * @param path
     */
    isDirectory(path: string): Promise<boolean> {
        return this.sendWithResponse({
            type: "IS_DIRECTORY",
            payload: path
        })
    }

    /**
     * File contents by full path/url.
     * @param path
     */
    content(path:string):Promise<string> {
        return this.sendWithResponse({
            type: "CONTENT",
            payload: path
        })
    }

    /**
     * Marks occurrences of a symbol under the cursor in the current document.
     * @param listener
     */
    onMarkOccurrences(listener: (uri: string, position: number) => IRange[]) {
        this.markOccurrencesListeners.push(listener);
    }

    /**
     * Adds a listener to document details request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentDetails(listener: (uri : string, position: number)=>Promise<DetailsItemJSON>){
        this.documentDetailsListeners.push(listener)
    }

    /**
     * Adds a listener to document cursor position change notification.
     * Must notify listeners in order of registration.
     * @param listener
     */
    onChangePosition(listener: (uri: string, position: number)=>void) {
        this.changePositionListeners.push(listener);
    }

    /**
     * Reports new calculated details when available.
     * @param report - details report.
     */
    detailsAvailable(report: IDetailsReport) {
        this.send({
            type : "DETAILS_REPORT",
            payload : report
        })
    }

    /**
     * Handler of OPEN_DOCUMENT message.
     * @param document
     * @constructor
     */
    OPEN_DOCUMENT(document : IOpenedDocument) : void {
        for (let listener of this.openDocumentListeners) {
            listener(document);
        }
    }

    /**
     * Handler of CHANGE_DOCUMENT message.
     * @param document
     * @constructor
     */
    CHANGE_DOCUMENT(document : IChangedDocument) : void {
        for (let listener of this.changeDocumentListeners) {
            listener(document);
        }
    }

    /**
     * Handler of CLOSE_DOCUMENT message.
     * @param uri
     * @constructor
     */
    CLOSE_DOCUMENT(uri : string) : void {
        for (let listener of this.closeDocumentListeners) {
            listener(uri);
        }
    }

    /**
     * Handler of GET_STRUCTURE message.
     * @param uri
     * @constructor
     */
    GET_STRUCTURE(uri : string) : Promise<{[categoryName:string] : StructureNodeJSON}> {
        if (this.documentStructureListeners.length == 0)
            return Promise.resolve({});

        return this.documentStructureListeners[0](uri);
    }

    /**
     * Handler of GET_SUGGESTIONS message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    GET_SUGGESTIONS(payload:{uri : string, position: number}) : Promise<Suggestion[]> {
        if (this.documentCompletionListeners.length == 0)
            return Promise.resolve([]);

        let promises = []
        for(let listener of this.documentCompletionListeners) {
            this.debugDetail("Calling a listener",
                "ProxyServerConnection", "getCompletion")

            let listenerResult = listener(payload.uri, payload.position);
            if (listenerResult) promises.push(listenerResult)
        }

        return Promise.all(promises).then(resolvedResults => {

            let result = [];
            for (let currentPromiseResult of resolvedResults) {
                result = result.concat(currentPromiseResult);
            }

            return result;
        })


    }

    /**
     * Handler of OPEN_DECLARATION message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    OPEN_DECLARATION(payload:{uri : string, position: number}) : ILocation[]{
        if (this.openDeclarationListeners.length == 0)
            return [];

        let result = [];
        for (let listener of this.openDeclarationListeners) {
            result = result.concat(listener(payload.uri, payload.position));
        }

        return result;
    }

    /**
     * Handler of FIND_REFERENCES message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    FIND_REFERENCES(payload:{uri : string, position: number}) : ILocation[]{
        if (this.findReferencesListeners.length == 0)
            return [];

        let result = [];
        for (let listener of this.findReferencesListeners) {
            result = result.concat(listener(payload.uri, payload.position));
        }

        return result;
    }

    /**
     * Handler of MARK_OCCURRENCES message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    MARK_OCCURRENCES(payload:{uri : string, position: number}) : IRange[]{
        if (this.markOccurrencesListeners.length == 0)
            return [];

        let result = [];
        for (let listener of this.markOccurrencesListeners) {
            result = result.concat(listener(payload.uri, payload.position));
        }

        return result;
    }

    /**
     * Handler of RENAME message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @param newName - new name
     * @constructor
     */
    RENAME(payload:{uri : string, position: number, newName: string}) : IChangedDocument[]{
        if (this.renameListeners.length == 0)
            return [];

        let result = [];
        for (let listener of this.renameListeners) {
            result = result.concat(listener(payload.uri, payload.position, payload.newName));
        }

        return result;
    }

    SET_LOGGER_CONFIGURATION(payload:ILoggerSettings) : void {

        this.setLoggerConfiguration(payload);
    }

    /**
     * Handler of GET_STRUCTURE message.
     * @param uri
     * @constructor
     */
    GET_DETAILS(payload:{uri : string, position: number}) : Promise<DetailsItemJSON> {
        if (this.documentDetailsListeners.length == 0)
            return Promise.resolve(null);

        return this.documentDetailsListeners[0](payload.uri,payload.position);
    }

    /**
     * Handler for CHANGE_POSITION message.
     * @param payload
     * @constructor
     */
    CHANGE_POSITION(payload:{uri : string, position: number}) : void {
        for (let listener of this.changePositionListeners) {
            listener(payload.uri, payload.position);
        }
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

        let filtered = filterLogMessage({
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
}