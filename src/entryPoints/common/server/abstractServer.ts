import {
    DetailsItemJSON,
    IChangedDocument,
    IDetailsReport,
    IExecutableAction,
    ILocation,
    ILogger,
    IOpenedDocument,
    IRange,
    IServerConnection,
    IUIDisplayRequest,
    IValidationIssue,
    IValidationReport,
    MessageSeverity,
    StructureNodeJSON,
    Suggestion
} from "../../../server/core/connections";

import {
    MessageToClientType,
    MessageToServerType, ProtocolMessage
} from "../../common/protocol";

import {
    MessageDispatcher
} from "../../common/messageDispatcher";

import {ILoggerSettings, IStructureReport} from "../../../common/typeInterfaces";

import {
    filterLogMessage
} from "../../../common/utils";

export abstract class AbstractMSServerConnection extends MessageDispatcher<MessageToClientType>
    implements IServerConnection {

    private loggerSettings: ILoggerSettings;

    private openDocumentListeners: {(document: IOpenedDocument): void}[] = [];
    private changeDocumentListeners: {(document: IChangedDocument): void}[] = [];
    private closeDocumentListeners: {(string): void}[] = [];
    private documentStructureListeners: {(uri: string): Promise<{[categoryName: string]: StructureNodeJSON}>}[] = [];
    private documentCompletionListeners: {(uri: string, position: number): Promise<Suggestion[]>}[] = [];
    private openDeclarationListeners: {(uri: string, position: number): ILocation[]}[] = [];
    private findReferencesListeners: {(uri: string, position: number): ILocation[]}[] = [];
    private markOccurrencesListeners: {(uri: string, position: number): IRange[]}[] = [];
    private renameListeners: {(uri: string, position: number, newName: string): IChangedDocument[]}[] = [];
    private documentDetailsListeners: {(uri: string, position: number): Promise<DetailsItemJSON>}[] = [];
    private changePositionListeners: {(uri: string, position: number): void}[] = [];

    private calculateEditorContextActionsListeners:
        {(uri: string, position?: number): Promise<IExecutableAction[]>}[] = [];

    private executeContextActionListeners:
        {(uri: string, actionId: string,
          position?: number): Promise<IChangedDocument[]>}[] = [];

    constructor(name: string) {
        super(name);
    }

    public abstract sendMessage(message: ProtocolMessage<MessageToClientType>): void;

    /**
     * Adds a listener to document open notification. Must notify listeners in order of registration.
     * @param listener
     */
    public onOpenDocument(listener: (document: IOpenedDocument) => void) {
        this.openDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document change notification. Must notify listeners in order of registration.
     * @param listener
     */
    public onChangeDocument(listener: (document: IChangedDocument) => void) {
        this.changeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document close notification. Must notify listeners in order of registration.
     * @param listener
     */
    public onCloseDocument(listener: (uri: string) => void) {
        this.closeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    public onDocumentStructure(listener: (uri: string) => Promise<{[categoryName: string]: StructureNodeJSON}>) {
        this.documentStructureListeners.push(listener);
    }

    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    public onDocumentCompletion(listener: (uri: string, position: number) => Promise<Suggestion[]>) {
        this.documentCompletionListeners.push(listener);
    }

    /**
     * Adds a listener to document open declaration request.  Must notify listeners in order of registration.
     * @param listener
     */
    public onOpenDeclaration(listener: (uri: string, position: number) => ILocation[]){
        this.openDeclarationListeners.push(listener);
    }

    /**
     * Adds a listener to document find references request.  Must notify listeners in order of registration.
     * @param listener
     */
    public onFindReferences(listener: (uri: string, position: number) => ILocation[]){
        this.findReferencesListeners.push(listener);
    }

    /**
     * Finds the set of document (and non-document files) edits to perform the requested rename.
     * @param listener
     */
    public onRename(listener: (uri: string, position: number, newName: string) => IChangedDocument[]) {
        this.renameListeners.push(listener);
    }

    /**
     * Reports latest validation results
     * @param report
     */
    public validated(report: IValidationReport): void {
        this.send({
            type : "VALIDATION_REPORT",
            payload : report
        });
    }

    /**
     * Reports new calculated structure when available.
     * @param uri - document uri
     * @param structure - structure for the document
     */
    public structureAvailable(report: IStructureReport) {
        this.send({
            type : "STRUCTURE_REPORT",
            payload : report
        });
    }

    /**
     * Returns whether path/url exists.
     * @param fullPath
     */
    public exists(path: string): Promise<boolean> {
        return this.sendWithResponse({
            type: "EXISTS",
            payload: path
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    public readDir(path: string): Promise<string[]> {
        return this.sendWithResponse({
            type: "READ_DIR",
            payload: path
        });
    }

    /**
     * Returns whether path/url represents a directory
     * @param path
     */
    public isDirectory(path: string): Promise<boolean> {
        return this.sendWithResponse({
            type: "IS_DIRECTORY",
            payload: path
        });
    }

    /**
     * File contents by full path/url.
     * @param path
     */
    public content(path: string): Promise<string> {
        return this.sendWithResponse({
            type: "CONTENT",
            payload: path
        });
    }

    /**
     * Marks occurrences of a symbol under the cursor in the current document.
     * @param listener
     */
    public onMarkOccurrences(listener: (uri: string, position: number) => IRange[]) {
        this.markOccurrencesListeners.push(listener);
    }

    /**
     * Adds a listener to document details request. Must notify listeners in order of registration.
     * @param listener
     */
    public onDocumentDetails(listener: (uri: string, position: number) => Promise<DetailsItemJSON>){
        this.documentDetailsListeners.push(listener);
    }

    /**
     * Adds a listener to document cursor position change notification.
     * Must notify listeners in order of registration.
     * @param listener
     */
    public onChangePosition(listener: (uri: string, position: number) => void) {
        this.changePositionListeners.push(listener);
    }

    /**
     * Reports new calculated details when available.
     * @param report - details report.
     */
    public detailsAvailable(report: IDetailsReport) {
        this.send({
            type : "DETAILS_REPORT",
            payload : report
        });
    }

    /**
     * Handler of OPEN_DOCUMENT message.
     * @param document
     * @constructor
     */
    public OPEN_DOCUMENT(document: IOpenedDocument): void {
        for (const listener of this.openDocumentListeners) {
            listener(document);
        }
    }

    /**
     * Handler of CHANGE_DOCUMENT message.
     * @param document
     * @constructor
     */
    public CHANGE_DOCUMENT(document: IChangedDocument): void {
        for (const listener of this.changeDocumentListeners) {
            listener(document);
        }
    }

    /**
     * Handler of CLOSE_DOCUMENT message.
     * @param uri
     * @constructor
     */
    public CLOSE_DOCUMENT(uri: string): void {
        for (const listener of this.closeDocumentListeners) {
            listener(uri);
        }
    }

    /**
     * Handler of GET_STRUCTURE message.
     * @param uri
     * @constructor
     */
    public GET_STRUCTURE(uri: string): Promise<{[categoryName: string]: StructureNodeJSON}> {
        if (this.documentStructureListeners.length === 0) {
            return Promise.resolve({});
        }

        return this.documentStructureListeners[0](uri);
    }

    /**
     * Handler of GET_SUGGESTIONS message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    public GET_SUGGESTIONS(payload: {uri: string, position: number}): Promise<Suggestion[]> {
        if (this.documentCompletionListeners.length === 0) {
            return Promise.resolve([]);
        }

        const promises = [];
        for (const listener of this.documentCompletionListeners) {
            this.debugDetail("Calling a listener",
                "ProxyServerConnection", "getCompletion");

            const listenerResult = listener(payload.uri, payload.position);
            if (listenerResult) {
                promises.push(listenerResult);
            }
        }

        return Promise.all(promises).then((resolvedResults) => {

            let result = [];
            for (const currentPromiseResult of resolvedResults) {
                result = result.concat(currentPromiseResult);
            }

            return result;
        });

    }

    /**
     * Handler of OPEN_DECLARATION message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    public OPEN_DECLARATION(payload: {uri: string, position: number}): ILocation[]{
        if (this.openDeclarationListeners.length === 0) {
            return [];
        }

        let result = [];
        for (const listener of this.openDeclarationListeners) {
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
    public FIND_REFERENCES(payload: {uri: string, position: number}): ILocation[]{
        if (this.findReferencesListeners.length === 0) {
            return [];
        }

        let result = [];
        for (const listener of this.findReferencesListeners) {
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
    public MARK_OCCURRENCES(payload: {uri: string, position: number}): IRange[]{
        if (this.markOccurrencesListeners.length === 0) {
            return [];
        }

        let result = [];
        for (const listener of this.markOccurrencesListeners) {
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
    public RENAME(payload: {uri: string, position: number, newName: string}): IChangedDocument[]{
        if (this.renameListeners.length === 0) {
            return [];
        }

        let result = [];
        for (const listener of this.renameListeners) {
            result = result.concat(listener(payload.uri, payload.position, payload.newName));
        }

        return result;
    }

    public SET_LOGGER_CONFIGURATION(payload: ILoggerSettings): void {

        this.setLoggerConfiguration(payload);
    }

    /**
     * Handler of GET_STRUCTURE message.
     * @param uri
     * @constructor
     */
    public GET_DETAILS(payload: {uri: string, position: number}): Promise<DetailsItemJSON> {
        if (this.documentDetailsListeners.length === 0) {
            return Promise.resolve(null);
        }

        return this.documentDetailsListeners[0](payload.uri, payload.position);
    }

    /**
     * Handler for CHANGE_POSITION message.
     * @param payload
     * @constructor
     */
    public CHANGE_POSITION(payload: {uri: string, position: number}): void {
        for (const listener of this.changePositionListeners) {
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
    public log(message: string, severity: MessageSeverity,
               component?: string, subcomponent?: string): void {

        const filtered = filterLogMessage({
            message,
            severity,
            component,
            subcomponent
        }, this.loggerSettings);

        if (filtered) {
            this.internalLog(filtered.message, filtered.severity,
                filtered.component, filtered.subcomponent);
        }
    }

    public internalLog(message: string, severity: MessageSeverity,
                       component?: string, subcomponent?: string): void {

        let toLog = "";

        const currentDate = new Date();
        toLog += currentDate.getHours() + ":" + currentDate.getMinutes() + ":" +
            currentDate.getSeconds() + ":" + currentDate.getMilliseconds() + " ";

        if (component) {
            toLog += (component + ": ");
        }
        if (subcomponent) {
            toLog += (subcomponent + ": ");
        }

        toLog += message;

        if (severity === MessageSeverity.WARNING) {
            console.warn(toLog);
        } else if (severity === MessageSeverity.ERROR) {
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
    public debug(message: string,
                 component?: string, subcomponent?: string): void {
        this.log(message, MessageSeverity.DEBUG, component, subcomponent);
    }

    /**
     * Logs a DEBUG_DETAIL severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    public debugDetail(message: string,
                       component?: string, subcomponent?: string): void {
        this.log(message, MessageSeverity.DEBUG_DETAIL, component, subcomponent);
    }

    /**
     * Logs a DEBUG_OVERVIEW severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    public debugOverview(message: string,
                         component?: string, subcomponent?: string): void {
        this.log(message, MessageSeverity.DEBUG_OVERVIEW, component, subcomponent);
    }

    /**
     * Logs a WARNING severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    public warning(message: string,
                   component?: string, subcomponent?: string): void {
        this.log(message, MessageSeverity.WARNING, component, subcomponent);
    }

    /**
     * Logs an ERROR severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    public error(message: string,
                 component?: string, subcomponent?: string): void {
        this.log(message, MessageSeverity.ERROR, component, subcomponent);
    }

    /**
     * Sets connection logger configuration.
     * @param loggerSettings
     */
    public setLoggerConfiguration(loggerSettings: ILoggerSettings) {
        this.loggerSettings = loggerSettings;
    }

    /**
     * Calculates the list of executable actions available in the current context.
     *
     * @param uri - document uri.
     * @param position - optional position in the document.
     * If not provided, the last reported by positionChanged method will be used.
     * @param target - option target argument.
     *
     * "TARGET_RAML_EDITOR_NODE" and "TARGET_RAML_TREE_VIEWER_NODE" are potential values
     * for actions based on the editor state and tree viewer state.
     * "TARGET_RAML_EDITOR_NODE" is default.
     */
    public onCalculateEditorContextActions(listener: (uri: string,
                                                      position?: number)
                                           => Promise<IExecutableAction[]>): void {

        this.calculateEditorContextActionsListeners.push(listener);
    }

    /**
     * Adds a listener for specific action execution.
     * If action has UI, causes a consequent displayActionUI call.
     * @param uri - document uri
     * @param action - action to execute.
     * @param position - optional position in the document.
     * If not provided, the last reported by positionChanged method will be used.
     */
    public onExecuteContextAction(listener: (uri: string, actionId: string,
                                             position?: number)
                                  => Promise<IChangedDocument[]>): void {

        this.executeContextActionListeners.push(listener);
    }

    /**
     * Adds a listener to display action UI.
     * @param uiDisplayRequest - display request
     * @return final UI state.
     */
    public displayActionUI(uiDisplayRequest: IUIDisplayRequest): Promise<any> {
        return this.sendWithResponse({
            type : "DISPLAY_ACTION_UI",
            payload : uiDisplayRequest
        });
    }

    public CALCULATE_ACTIONS(payload: {uri: string, position?: number}): Promise<IExecutableAction[]> {
        if (!this.calculateEditorContextActionsListeners) {
            return Promise.resolve([]);
        }

        return this.calculateEditorContextActionsListeners[0](payload.uri, payload.position);
    }

    public EXECUTE_ACTION(payload: {uri: string, actionId: string,
                   position?: number}): Promise<IChangedDocument[]> {

        this.debugDetail("Called",
            "ProxyServerConnection", "EXECUTE_ACTION");

        if (!this.executeContextActionListeners) {
            return Promise.resolve([]);
        }

        this.debugDetail("Before execution",
            "ProxyServerConnection", "EXECUTE_ACTION");

        try {
            const result = this.executeContextActionListeners[0](payload.uri, payload.actionId,
                payload.position);
            return result;
        } catch (Error) {
            this.debugDetail("Failed listener execution: " + Error.message,
                "ProxyServerConnection", "EXECUTE_ACTION");
        }
    }
}
