// import {
//     IClientConnection,
//     MessageSeverity
// } from '../../../client/client'
//
// import {
//     RAMLClientConnection
// } from './client'
//
// var clientConnection = null;
//
// export function getConnection() : IClientConnection {
//     if (!clientConnection) clientConnection = launch();
//
//     return clientConnection;
// }
//
// export function launch(workerFilePath = "./worker.bundle.js") : IClientConnection {
//
//     let worker = new Worker(workerFilePath);
//
//     clientConnection = new RAMLClientConnection(worker);
//
//     clientConnection.setLoggerConfiguration({
//         // allowedComponents: [
//         //     "CompletionManagerModule"
//         // ],
//         maxSeverity: MessageSeverity.ERROR,
//         maxMessageLength: 50
//     });
//
//     return clientConnection;
// }


import {
    IClientConnection,
    MessageSeverity
} from '../../../client/client'

import {
    RAMLClientConnection
} from './client'

var clientConnection = null;

export function getConnection() : IClientConnection {
    if (!clientConnection) clientConnection = launch();

    return clientConnection;
}

function loadExternalJSAsWorker( url ) {
    var ajax = new XMLHttpRequest();
    ajax.open( 'GET', url, false ); // <-- the 'false' makes it synchronous
    let worker = null;
    ajax.onreadystatechange = function () {
        var script = ajax.response || ajax.responseText;
        if (ajax.readyState === 4) {
            switch( ajax.status) {
                case 200:
                    worker = new Worker(URL.createObjectURL(new Blob([script.toString()], {type: 'text/javascript'})));
                default:
                    console.log("ERROR: script not loaded: ", url);
            }
        }
    };
    ajax.send(null);

    return worker;
}

export function launch(workerFilePath = "./worker.bundle.js") : IClientConnection {

    let worker = loadExternalJSAsWorker(workerFilePath)
    //let worker = new Worker(workerFilePath);

    clientConnection = new RAMLClientConnection(worker);

    // clientConnection.setLoggerConfiguration({
    //     // allowedComponents: [
    //     //     "CompletionManagerModule"
    //     // ],
    //     maxSeverity: MessageSeverity.ERROR,
    //     maxMessageLength: 50
    // });

    return clientConnection;
}
