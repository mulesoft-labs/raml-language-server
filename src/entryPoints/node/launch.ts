import childProcess = require("child_process");

import path = require("path");

import {
    IClientConnection,
    MessageSeverity
} from '../../client/client'

import {
    NodeProcessClientConnection
} from './client'

let clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

function launch() : IClientConnection {

    let serverProcess = (<any>childProcess).fork(path.resolve(__dirname, './serverProcess.js'), [], {
        silent: true
    });

    let clientConnection = new NodeProcessClientConnection(serverProcess);

    clientConnection.setLoggerConfiguration({
        // allowedComponents: [
        //     "ParseDocumentRunnable",
        //     "MessageDispatcher:NodeProcessServerConnection",
        //     "Reconciler",
        //     "StructureManager"
        // ],
        maxSeverity: MessageSeverity.ERROR,
        maxMessageLength: 60
    });

    return clientConnection;
}



