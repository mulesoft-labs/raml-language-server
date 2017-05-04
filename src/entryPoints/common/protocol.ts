export type MessageToClientType =
    "VALIDATION_REPORT" |
    "STRUCTURE_REPORT" |
    "EXISTS" |
    "READ_DIR" |
    "IS_DIRECTORY" |
    "CONTENT";

export type MessageToServerType =
    "OPEN_DOCUMENT" |
    "CHANGE_DOCUMENT" |
    "CLOSE_DOCUMENT" |
    "GET_STRUCTURE" |
    "GET_SUGGESTIONS" |
    "OPEN_DECLARATION" |
    "FIND_REFERENCES" |
    "MARK_OCCURRENCES"|
    "RENAME" |
    "SET_LOGGER_CONFIGURATION";

export interface ProtocolMessage<MessageType extends MessageToClientType | MessageToServerType> {
    type : MessageType
    payload : any,
    id? : string
    errorMessage? : string
}
