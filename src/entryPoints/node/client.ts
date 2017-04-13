import clientInterfaces = require("../../client/client")
import commonInterfaces = require("../../common/typeInterfaces")

import {
    MessageDispatcher,
    ProtocolMessage,
    MessageToServerType
} from './protocol'

import {
    IChangedDocument,
    MessageSeverity,
    ILoggerSettings
} from '../../client/typeInterfaces'

import {
    VersionedDocumentManager
} from './clientVersionManager'

import {
    filterLogMessage
} from '../../common/utils'

import childProcess = require("child_process");

export class NodeProcessClientConnection extends MessageDispatcher<MessageToServerType>
    implements clientInterfaces.IClientConnection {

    private loggerSettings : ILoggerSettings;

    private validationReportListeners : {(report:clientInterfaces.IValidationReport):void}[] = [];
    private structureReportListeners : {(report:clientInterfaces.IStructureReport):void}[] = [];
    private versionManager : VersionedDocumentManager;

    constructor(private serverProcess : childProcess.ChildProcess){
        super("NodeProcessClientConnection");

        this.versionManager = new VersionedDocumentManager(this);

        serverProcess.on('message', (serverMessage: ProtocolMessage<MessageToServerType>) => {
            this.handleRecievedMessage(serverMessage);
        });

        serverProcess.stdout.on('data', data => {
            console.log(data.toString());
        });

        serverProcess.stderr.on('data', data => {
            console.log(data.toString());
        });

        serverProcess.on('close', function (code) {
            this.debug('Validation process exited with code ' + code, "NodeProcessClientConnection");
        });
    }

    stop() : void {
        this.serverProcess.kill();
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

    /**
     * Gets latest document version.
     * @param uri
     */
    getLatestVersion(uri: string) : Promise<number> {
        let version = this.versionManager.getLatestDocumentVersion(uri);

        return Promise.resolve(version);
    }

    sendMessage
    (message : ProtocolMessage<MessageToServerType>) : void {

        this.serverProcess.send(message);
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
}