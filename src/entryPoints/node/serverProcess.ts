
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
    ILocation
} from '../../server/core/connections'

import {
    Server
} from '../../server/core/server'

import {
    MessageDispatcher,
    ProtocolMessage,
    MessageToServerType, MessageToClientType
} from './protocol'

class NodeProcessServerConnection extends MessageDispatcher<MessageToClientType> implements IServerConnection {

    private openDocumentListeners : {(document: IOpenedDocument):void}[] = [];
    private changeDocumentListeners : {(document: IChangedDocument):void}[] = [];
    private closeDocumentListeners : {(string):void}[] = [];
    private documentStructureListeners : {(uri : string):{[categoryName:string] : StructureNodeJSON}}[] = [];
    private documentCompletionListeners : {(uri : string, position: number):Suggestion[]}[] = [];
    private openDeclarationListeners : {(uri : string, position: number):ILocation[]}[] = [];
    private findReferencesListeners : {(uri : string, position: number):ILocation[]}[] = [];

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
     * Reports latest validation results
     * @param report
     */
    validated(report:IValidationReport) : void {
        this.send({
            type : "VALIDATION_REPORT",
            payload : report
        })
    }

    sendMessage (message : ProtocolMessage<MessageToClientType>) : void {
        process.send(message);
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
    GET_STRUCTURE(uri : string) : {[categoryName:string] : StructureNodeJSON} {
        if (this.documentStructureListeners.length == 0)
            return {};

        return this.documentStructureListeners[0](uri);
    }

    /**
     * Handler of GET_SUGGESTIONS message.
     * @param uri - document uri
     * @param position - offset in the document starting from 0
     * @constructor
     */
    GET_SUGGESTIONS(payload:{uri : string, position: number}) : Suggestion[] {
        if (this.documentCompletionListeners.length == 0)
            return [];

        let result = [];
        for (let listener of this.documentCompletionListeners) {
            result = result.concat(listener(payload.uri, payload.position));
        }

        return result;
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

let connection = new NodeProcessServerConnection();

let server = new Server(connection);
server.listen();

process.on('message', (data: ProtocolMessage<MessageToClientType>) => {
    connection.handleRecievedMessage(data);
});