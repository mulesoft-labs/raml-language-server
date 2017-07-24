import clientInterfaces = require("../../../client/client")
import commonInterfaces = require("../../../common/typeInterfaces")

import {
    ProtocolMessage,
    MessageToServerType
} from '../../common/protocol'

import {
    MessageDispatcher
} from '../../common/messageDispatcher'

import {
    IChangedDocument,
    MessageSeverity,
    ILoggerSettings,
    IExecutableAction,
    IUIDisplayRequest
} from '../../../client/typeInterfaces'

import {
    VersionedDocumentManager
} from './clientVersionManager'

import {
    filterLogMessage
} from '../../../common/utils'

export abstract class AbstractClientConnection extends MessageDispatcher<MessageToServerType>
    implements clientInterfaces.IClientConnection {

    private loggerSettings : ILoggerSettings;

    private validationReportListeners : {(report:clientInterfaces.IValidationReport):void}[] = [];
    private structureReportListeners : {(report:clientInterfaces.IStructureReport):void}[] = [];
    private versionManager : VersionedDocumentManager;

    private onExistsListeners : {(path : string):Promise<boolean>}[] = [];
    private onReadDirListeners : {(path : string):Promise<string[]>}[] = [];
    private onIsDirectoryListeners : {(path : string):Promise<boolean>}[] = [];
    private onContentListeners : {(path : string):Promise<string>}[] = [];
    private onDetailsReportListeners : {(report : clientInterfaces.IDetailsReport):void}[] = [];
    private onDisplayActionUIListeners : {(uiDisplayRequest: IUIDisplayRequest):Promise<any>}[] = [];

    /**
     * Sends message to the counterpart.
     * @param message
     */
    abstract sendMessage (message : ProtocolMessage<MessageToServerType>) : void;

    /**
     * Stops the server.
     */
    abstract stop() : void;

    constructor(name: string){
        super(name);

        this.versionManager = new VersionedDocumentManager(this);
    }

    onValidationReport(listener : (report:clientInterfaces.IValidationReport)=>void) {
        this.validationReportListeners.push(listener);
    }

    onStructureReport(listener : (report:clientInterfaces.IStructureReport)=>void) {
        this.structureReportListeners.push(listener);
    }

    documentOpened(document: clientInterfaces.IOpenedDocument) : void {

        let commonOpenedDocument = this.versionManager.registerOpenedDocument(document);
        if (!commonOpenedDocument) return;

        this.send({
            type : "OPEN_DOCUMENT",
            payload : commonOpenedDocument
        })
    }

    documentChanged(document: IChangedDocument) : void {

        let commonChangedDocument = this.versionManager.registerChangedDocument(document);
        if (!commonChangedDocument) return;

        this.send({
            type : "CHANGE_DOCUMENT",
            payload : commonChangedDocument
        })
    }

    documentClosed(uri : string) : void {

        //this.versionManager.unregisterDocument(uri);

        this.send({
            type : "CLOSE_DOCUMENT",
            payload : uri
        })
    }

    getStructure(uri: string) : Promise<{[categoryName:string] : clientInterfaces.StructureNodeJSON}> {

        return this.sendWithResponse({
            type : "GET_STRUCTURE",
            payload : uri
        });
    }

    getSuggestions(uri: string, position: number) : Promise<clientInterfaces.Suggestion[]> {
        return this.sendWithResponse({
            type : "GET_SUGGESTIONS",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    /**
     * Requests server for the positions of the declaration of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    openDeclaration(uri: string, position: number) : Promise<clientInterfaces.ILocation[]> {
        return this.sendWithResponse({
            type : "OPEN_DECLARATION",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    /**
     * Requests server for the positions of the references of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    findReferences(uri: string, position: number) : Promise<clientInterfaces.ILocation[]> {
        return this.sendWithResponse({
            type : "FIND_REFERENCES",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    /**
     * Requests server for the positions of the references of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    markOccurrences(uri: string, position: number) : Promise<clientInterfaces.IRange[]> {
        return this.sendWithResponse({
            type : "MARK_OCCURRENCES",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    /**
     * Requests server for rename of the element
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    rename(uri: string, position: number, newName: string) : Promise<clientInterfaces.IChangedDocument[]>{
        return this.sendWithResponse({
            type : "RENAME",
            payload : {
                uri : uri,
                position: position,
                newName: newName
            }
        });
    }

    /**
     * Requests server for the document+position details.
     * @param uri
     */
    getDetails(uri: string, position: number) : Promise<clientInterfaces.DetailsItemJSON> {
        return this.sendWithResponse({
            type : "GET_DETAILS",
            payload : {
                uri: uri,
                position: position
            }
        });
    }

    /**
     * Sets connection logger configuration, both for the server and for the client.
     * @param loggerSettings
     */
    setLoggerConfiguration(loggerSettings: ILoggerSettings) : void {

        //changing client configuration
        this.loggerSettings = loggerSettings;

        //changing server configuration
        this.send({
            type : "SET_LOGGER_CONFIGURATION",
            payload : loggerSettings
        })
    }

    VALIDATION_REPORT(report : clientInterfaces.IValidationReport) : void {
        for (let listener of this.validationReportListeners) {
            listener(report);
        }
    }

    STRUCTURE_REPORT(report : clientInterfaces.IStructureReport) : void {
        for (let listener of this.structureReportListeners) {
            listener(report);
        }
    }

    EXISTS(path : string) : Promise<boolean> {

        for (let listener of this.onExistsListeners) {
            let result = listener(path);
            if (result !==null) return result;
        }

        return null;
    }

    READ_DIR(path : string) : Promise<string[]> {

        for (let listener of this.onReadDirListeners) {
            let result = listener(path);
            if (result !==null) return result;
        }

        return null;
    }

    IS_DIRECTORY(path : string) : Promise<boolean>{

        for (let listener of this.onIsDirectoryListeners) {
            let result = listener(path);
            if (result !==null) return result;
        }

        return null;
    }

    CONTENT(path : string) : Promise<string> {

        for (let listener of this.onContentListeners) {
            let result = listener(path);
            if (result !==null) return result;
        }

        return null;
    }

    DETAILS_REPORT(report : clientInterfaces.IDetailsReport) : void {
        for (let listener of this.onDetailsReportListeners) {
            listener(report);
        }
    }

    /**
     * Gets latest document version.
     * @param uri
     */
    getLatestVersion(uri: string) : Promise<number> {
        let version = this.versionManager.getLatestDocumentVersion(uri);

        return Promise.resolve(version);
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
     * Listens to the server requests for FS path existence, answering whether
     * a particular path exists on FS.
     */
    onExists(listener: (path: string)=>Promise<boolean>) : void {
        this.onExistsListeners.push(listener);
    }

    /**
     * Listens to the server requests for directory contents, answering with a list
     * of files in a directory.
     */
    onReadDir(listener: (path: string)=>Promise<string[]>) : void {
        this.onReadDirListeners.push(listener)
    }

    /**
     * Listens to the server requests for directory check, answering whether
     * a particular path is a directory.
     */
    onIsDirectory(listener: (path: string)=>Promise<boolean>) : void {
        this.onIsDirectoryListeners.push(listener)
    }

    /**
     * Listens to the server requests for file contents, answering what contents file has.
     */
    onContent(listener: (path: string)=>Promise<string>) : void {
        this.onContentListeners.push(listener)
    }

    /**
     * Reports to the server the position (cursor) change on the client.
     * @param uri - document uri.
     * @param position - curtsor position, starting from 0.
     */
    positionChanged(uri: string, position: number) : void {
        this.send({
            type : "CHANGE_POSITION",
            payload : {
                uri: uri,
                position: position
            }
        })
    }

    /**
     * Report from the server that the new details are calculated
     * for particular document and position.
     * @param listener
     */
    onDetailsReport(listener : (IDetailsReport)=>void) {
        this.onDetailsReportListeners.push(listener);
    }

    /**
     * Calculates the list of executable actions avilable in the current context.
     *
     * @param uri - document uri.
     * @param position - optional position in the document.
     * If not provided, the last reported by positionChanged method will be used.
     */
    calculateEditorContextActions(uri: string,
        position?: number) : Promise<IExecutableAction[]> {

        return this.sendWithResponse({
            type : "CALCULATE_ACTIONS",
            payload : {
                uri: uri,
                position: position
            }
        })
    }

    /**
     * Executes the specified action. If action has UI, causes a consequent
     * server->client UI message resulting in onDisplayActionUI listener call.
     * @param uri - document uri
     * @param action - action to execute.
     * @param position - optional position in the document.
     * If not provided, the last reported by positionChanged method will be used.
     */
    executeContextAction(uri: string, action: IExecutableAction,
        position?: number): Promise<IChangedDocument[]> {

        return this.sendWithResponse({
            type : "EXECUTE_ACTION",
            payload : {
                uri: uri,
                position: position,
                actionId: action.id
            }
        })
    }

    /**
     * Adds a listener to display action UI.
     * @param listener - accepts UI display request, should result in a promise
     * returning final UI state to be transferred to the server.
     */
    onDisplayActionUI(
        listener: (uiDisplayRequest: IUIDisplayRequest)=>Promise<any>) {

        this.onDisplayActionUIListeners.push(listener);
    }

    DISPLAY_ACTION_UI(uiDisplayRequest: IUIDisplayRequest) : Promise<any> {
        if (!this.onDisplayActionUIListeners)
            return Promise.reject(new Error("No handler for DISPLAY_ACTION_UI"));

        return this.onDisplayActionUIListeners[0](uiDisplayRequest);
    }
}