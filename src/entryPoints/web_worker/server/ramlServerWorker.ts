import {
    ProtocolMessage,
    MessageToClientType
} from '../../common/protocol'

import {
    AbstractServerConnection
} from '../../common/server/abstractServer'

import {
    Server
} from '../../../server/core/server'

declare function postMessage(message);

class WebWorkerServerConnection extends AbstractServerConnection {

    constructor() {
        super("WebServerConnection")
    }

    sendMessage (message : ProtocolMessage<MessageToClientType>) : void {
        postMessage(message);
    }
}

let connection = new WebWorkerServerConnection();

let server = new Server(connection);
server.listen();

self.addEventListener('message', function(e) {
    connection.handleRecievedMessage(e.data);
}, false);