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

class NodeProcessServerConnection extends AbstractServerConnection {

    constructor() {
        super("NodeProcessServerConnection")
    }

    sendMessage (message : ProtocolMessage<MessageToClientType>) : void {
        process.send(message);
    }
}

let connection = new NodeProcessServerConnection();

let server = new Server(connection);
server.listen();

process.on('message', (data: ProtocolMessage<MessageToClientType>) => {
    connection.handleRecievedMessage(data);
});