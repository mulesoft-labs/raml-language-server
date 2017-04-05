import childProcess = require("child_process");

import path = require("path");

import {
    IClientConnection
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

    return new NodeProcessClientConnection(serverProcess);
}



