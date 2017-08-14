import childProcess = require("child_process");

import path = require("path");

import {
    IClientConnection,
    MessageSeverity
} from '../../../client/client'

import {
    NodeProcessClientConnection
} from './client'

let clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

function launch() : IClientConnection {

    // let serverProcess = (<any>childProcess).fork(
    //     path.resolve(__dirname, '../server/serverProcess.js'), ['--debug=6010'], {
    //     silent: true
    // });

    let serverProcess = (<any>childProcess).fork(
        path.resolve(__dirname, '../server/serverProcess.js'), [], {
            silent: true
        });

    let clientConnection = new NodeProcessClientConnection(serverProcess);

    // clientConnection.setLoggerConfiguration({
    //     // allowedComponents: [
    //     //     "CompletionManagerModule"
    //     // ],
    //     maxSeverity: MessageSeverity.ERROR,
    //     maxMessageLength: 50
    // });

    clientConnection.setLoggerConfiguration({
        allowedComponents: [
            "MessageDispatcher:NodeProcessServerConnection",
            "NodeProcessClientConnection",
            "NodeProcessServerConnection",
            "CustomActionsManager",
            "EditorManager"
        ],
        maxSeverity: MessageSeverity.DEBUG_DETAIL,
        maxMessageLength: 5000
    });

    return clientConnection;
}



