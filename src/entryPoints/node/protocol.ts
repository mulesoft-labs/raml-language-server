import {
    ILogger
} from '../../common/typeInterfaces'

export type MessageToClientType =
    "VALIDATION_REPORT";

export type MessageToServerType =
    "OPEN_DOCUMENT" |
    "CHANGE_DOCUMENT" |
    "CLOSE_DOCUMENT" |
    "GET_STRUCTURE" |
    "GET_SUGGESTIONS";

export interface ProtocolMessage<MessageType extends MessageToClientType | MessageToServerType> {
    type : MessageType
    payload : any,
    id? : string
    errorMessage? : string
}

let shortid = require('shortid');

interface CallBackHandle<ResultType> {
    resolve? : (value?: ResultType) => void
    reject?: (error?: any) => void
}

export abstract class MessageDispatcher<MessageType extends MessageToClientType | MessageToServerType> implements ILogger {
    private callBacks : {[messageId : string] : CallBackHandle<any>} = {};

    /**
     * Sends message to the counterpart.
     * @param message
     */
    abstract sendMessage
        (message : ProtocolMessage<MessageType>) : void;

    abstract log(message: string) : void;

    /**
     * Sends message to the counterpart
     * @param message
     */
    public send(message : ProtocolMessage<MessageType>) : void {
        this.log("MessageDispatcher:send Sending message of type: " + message.type);
        this.sendMessage(message);
    }

    /**
     * Sends message to the counterpart and hooks for response.
     * When response comes back, calls the appropriate handler method.
     * @param message
     * @return promise, which will contain the result returned by the counterpart
     */
    public sendWithResponse<ResultType>(message : ProtocolMessage<MessageType>) : Promise<ResultType> {
        this.log("MessageDispatcher:sendWithResonse Sending message with response of type: " + message.type);
        return new Promise((resolve : (value?: ResultType) => void, reject: (error?: any) => void)=>{

            message.id = shortid.generate();
            this.callBacks[message.id] = {
                resolve : resolve,
                reject : reject
            }

        })
    }

    /**
     * Finds a method in the current instance named as message type and calls it with
     * the message payload as an argument.
     *
     * If message assumes an answer, sends the results backwards.
     *
     * Is designed to be called by subclasses.
     * @param message
     */
    public handleRecievedMessage(message : ProtocolMessage<MessageType>) {
        this.log("MessageDispatcher:handleRecievedMessage Recieved message of type: " + message.type + " and id: " + message.id);

        if (message.id && this.callBacks[message.id]) {
            this.log("MessageDispatcher:handleRecievedMessage Message callback found");
            //this is a response for a request sent earlier
            //lets find its resolve/error and call it

            let callBackHandle =  this.callBacks[message.id];

            try {

                if (message.errorMessage && callBackHandle) {

                    callBackHandle.reject(new Error(message.errorMessage));
                } else {

                    callBackHandle.resolve(message.payload);
                }
            } finally {
                delete this.callBacks[message.id];
            }
        } else {
            this.log("MessageDispatcher:handleRecievedMessage Looking for method " + message.type)
            let method = this[<string>message.type];
            if (!method) {
                this.log("MessageDispatcher:handleRecievedMessage Method NOT found: " + message.type)
                return;
            } else {
                this.log("MessageDispatcher:handleRecievedMessage Method found: " + message.type)
            }

            if (typeof(method) != "function") return;

            //if this is not a response, just a direct message, lets call a handler
            var result = method.call(this,message.payload);
            this.log("MessageDispatcher:handleRecievedMessage Called method " + message.type + " result is: " + result);

            //if we've got some result and message has ID, so the answer is expected
            if (result != null && message.id) {
                if ((<any>result).then && (<any>result).catch) {
                    //TODO more precise instanceof

                    //looks like a promise, lets send the answer when its ready
                    <any>result.then(
                        (result)=>{
                            this.send({
                                type: message.type,
                                payload: result,
                                id: message.id
                            })
                        },
                        (error)=>{
                            this.send({
                                type: message.type,
                                payload: {},
                                id: message.id,
                                errorMessage: error.message
                            })
                        });
                } else {
                    //sending back immediatelly
                    let responseMessage = {
                        type: message.type,
                        payload: result,
                        id: message.id
                    };
                    this.sendMessage(responseMessage);
                }
            }
        }

    }
}