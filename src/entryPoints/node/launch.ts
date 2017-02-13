import childProcess = require("child_process");

import path = require("path");

import {
    IClientConnection,
    IValidationReport,
    IOpenedDocument,
    StructureNodeJSON,
    Suggestion
} from '../../client/client'

import {
    MessageDispatcher,
    ProtocolMessage,
    MessageToServerType
} from './protocol'
import {IChangedDocument} from "../../common/typeInterfaces";


let clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

function launch() : IClientConnection {

    let serverProcess = (<any>childProcess).fork(path.resolve(__dirname, './serverProcess.js'), [], {
        silent: true
    });

    return new NodeProcessClientConnection(serverProcess);
}

class NodeProcessClientConnection extends MessageDispatcher<MessageToServerType> implements IClientConnection {

    private validationReportListeners : {(report:IValidationReport):void}[] = [];

    constructor(private serverProcess : childProcess.ChildProcess){
        super();

        serverProcess.on('message', (serverMessage: ProtocolMessage<MessageToServerType>) => {
            this.handleRecievedMessage(serverMessage);
        });

        serverProcess.stdout.on('data', data => {
            this.log("Validation process stdout: " + data.toString());
        });

        serverProcess.stderr.on('data', data => {
            this.log("Validation process stderr: " + data.toString());
        });

        serverProcess.on('close', function (code) {
            this.log('Validation process exited with code ' + code);
        });
    }

    stop() : void {
        this.serverProcess.kill();
    }

    onValidationReport(listener : (report:IValidationReport)=>void) {
        this.validationReportListeners.push(listener);
    }

    documentOpened(document: IOpenedDocument) : void {
        this.send({
            type : "OPEN_DOCUMENT",
            payload : document
        })
    }

    documentChanged(document: IChangedDocument) : void {
        this.send({
            type : "CHANGE_DOCUMENT",
            payload : document
        })
    }

    documentClosed(uri : string) : void {
        this.send({
            type : "CLOSE_DOCUMENT",
            payload : uri
        })
    }

    getStructure(uri: string) : Promise<{[categoryName:string] : StructureNodeJSON}> {

        return this.sendWithResponse({
            type : "GET_STRUCTURE",
            payload : uri
        });
    }

    getSuggestions(uri: string, position: number) : Promise<Suggestion[]> {
        return this.sendWithResponse({
            type : "GET_SUGGESTIONS",
            payload : {
                uri : uri,
                position: position
            }
        });
    }

    VALIDATION_REPORT(report : IValidationReport) : void {
        for (let listener of this.validationReportListeners) {
            listener(report);
        }
    }

    sendMessage
        (message : ProtocolMessage<MessageToServerType>) : void {

        this.serverProcess.send(message);
    }

    log(message : string) : void {
        console.log(message);
    }
}

