import {
    ILogger,
    MessageSeverity
} from '../../common/typeInterfaces'

export type MessageToClientType =
    "VALIDATION_REPORT" |
    "STRUCTURE_REPORT";

export type MessageToServerType =
    "OPEN_DOCUMENT" |
    "CHANGE_DOCUMENT" |
    "CLOSE_DOCUMENT" |
    "GET_STRUCTURE" |
    "GET_SUGGESTIONS" |
    "OPEN_DECLARATION" |
    "FIND_REFERENCES";

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

export abstract class MessageDispatcher<MessageType extends MessageToClientType | MessageToServerType>
    implements ILogger {
    private callBacks : {[messageId : string] : CallBackHandle<any>} = {};

    constructor(private name: string) {}

    /**
     * Sends message to the counterpart.
     * @param message
     */
    abstract sendMessage
        (message : ProtocolMessage<MessageType>) : void;

    /**
     * Logs a message
     * @param message - message text
     * @param severity - message severity
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract log(message:string, severity: MessageSeverity,
        component?: string, subcomponent?: string) : void

    /**
     * Logs a DEBUG severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract debug(message:string,
          component?: string, subcomponent?: string) : void;

    /**
     * Logs a DEBUG_DETAIL severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract debugDetail(message:string,
                component?: string, subcomponent?: string) : void;

    /**
     * Logs a DEBUG_OVERVIEW severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract debugOverview(message:string,
                  component?: string, subcomponent?: string) : void;

    /**
     * Logs a WARNING severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract warning(message:string,
            component?: string, subcomponent?: string) : void;

    /**
     * Logs an ERROR severity message.
     * @param message - message text
     * @param component - component name
     * @param subcomponent - sub-component name
     */
    abstract error(message:string,
          component?: string, subcomponent?: string) : void;

    /**
     * Sends message to the counterpart
     * @param message
     */
    public send(message : ProtocolMessage<MessageType>) : void {
        this.debug("Sending message of type: " + message.type, "MessageDispatcher: " + this.name, "send");
        this.sendMessage(message);
    }

    /**
     * Sends message to the counterpart and hooks for response.
     * When response comes back, calls the appropriate handler method.
     * @param message
     * @return promise, which will contain the result returned by the counterpart
     */
    public sendWithResponse<ResultType>(message : ProtocolMessage<MessageType>) : Promise<ResultType> {
        this.debug("Sending message with response of type: " + message.type, "MessageDispatcher: " + this.name, "sendWithResonse");
        return new Promise((resolve : (value?: ResultType) => void, reject: (error?: any) => void)=>{

            message.id = shortid.generate();
            this.callBacks[message.id] = {
                resolve : resolve,
                reject : reject
            }

            this.sendMessage(message);
        })
    }

    protected handleCommunicationError(error : Error, originalMessage : ProtocolMessage<MessageType>) {
        this.error("Error on message handler execution: " + Error);

        if (originalMessage.id) {
            this.send({
                type: originalMessage.type,
                payload: {},
                id: originalMessage.id,
                errorMessage: error.message
            })
        }
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
        this.debug("Recieved message of type: " + message.type + " and id: " + message.id,
            "MessageDispatcher: " + this.name, "handleRecievedMessage");

        if (message.id && this.callBacks[message.id]) {
            this.debugDetail("MessageDispatcher:handleRecievedMessage Message callback found",
                "MessageDispatcher:" + this.name, "handleRecievedMessage");
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
            this.debugDetail("Looking for method " + message.type,
                "MessageDispatcher:" + this.name, "handleRecievedMessage")
            let method = this[<string>message.type];
            if (!method) {
                this.debugDetail("Method NOT found: " + message.type,
                    "MessageDispatcher+" + this.name, "handleRecievedMessage")
                return;
            } else {
                this.debugDetail("Method found: " + message.type,
                    "MessageDispatcher:" + this.name, "handleRecievedMessage")
            }

            if (typeof(method) != "function") return;

            //if this is not a response, just a direct message, lets call a handler
            let result = null;

            try {
                result = method.call(this,message.payload);
            } catch (error) {
                this.handleCommunicationError(error, message)
                return;
            }

            this.debugDetail("Called method " + message.type + " result is: " + result,
                "MessageDispatcher:" + this.name, "handleRecievedMessage");

            //if we've got some result and message has ID, so the answer is expected
            if (result && message.id) {
                if (result && (<any>result).then && (<any>result).catch) {
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