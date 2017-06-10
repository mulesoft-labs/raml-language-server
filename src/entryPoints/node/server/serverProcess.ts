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

import fs = require("fs")

class NodeProcessServerConnection extends AbstractServerConnection {

    constructor() {
        super("NodeProcessServerConnection")
    }

    sendMessage (message : ProtocolMessage<MessageToClientType>) : void {
        process.send(message);
    }

    /**
     * Returns whether path/url exists.
     * @param fullPath
     */
    exists(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.exists(path, (result) => {resolve(result)})
        });
    }

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDir(path: string): Promise<string[]> {
        return new Promise(resolve => {
            fs.readdir(path, (err, result) => {resolve(result)})
        });
    }

    /**
     * Returns whether path/url represents a directory
     * @param path
     */
    isDirectory(path: string): Promise<boolean> {
        return new Promise(resolve => {
            fs.stat(path, (err, stats) => {resolve(stats.isDirectory())})
        });
    }

    /**
     * File contents by full path/url.
     * @param path
     */
    content(path:string):Promise<string> {
        return new Promise(function(resolve, reject) {

            fs.readFile(path,(err,data)=>{
                if(err!=null){
                    return reject(err);
                }

                let content = data.toString();
                resolve(content);
            });
        });
    }
}

let connection = new NodeProcessServerConnection();

let server = new Server(connection);
server.listen();

process.on('message', (data: ProtocolMessage<MessageToClientType>) => {
    connection.handleRecievedMessage(data);
});