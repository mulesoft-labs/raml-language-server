import clientInterfaces = require("../../../client/client")
import commonInterfaces = require("../../../common/typeInterfaces")

import {
    ProtocolMessage,
    MessageToServerType
} from '../../common/protocol'

import {
    AbstractClientConnection
} from '../../common/client/abstractClient'

export interface IWorker {

    postMessage(message: any): void

    onmessage : {(event:any) : void}

    terminate() : void
}

export class RAMLClientConnection extends AbstractClientConnection
    implements clientInterfaces.IClientConnection {

    constructor(private worker : IWorker){
        super("NodeProcessClientConnection");

        worker.onmessage = (event)=>{
            this.handleRecievedMessage(event.data)
        }
    }

    stop() : void {
        this.worker.terminate();
    }

    sendMessage (message : ProtocolMessage<MessageToServerType>) : void {

        this.worker.postMessage(message);
    }
}

