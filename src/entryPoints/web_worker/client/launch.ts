import {
    IClientConnection,
    MessageSeverity
} from '../../../client/client'

import {
    RAMLClientConnection
} from './client'

let clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

export function launch(workerFilePath = "./worker.bundle.js") : IClientConnection {

    let worker = new Worker(workerFilePath);

    let clientConnection = new RAMLClientConnection(worker);

    clientConnection.setLoggerConfiguration({
        // allowedComponents: [
        //     "CompletionManagerModule"
        // ],
        maxSeverity: MessageSeverity.ERROR,
        maxMessageLength: 50
    });

    return clientConnection;
}
