import {
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion
} from "../common/typeInterfaces";

export {
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion
} from '../common/typeInterfaces'

export interface IClientConnection {

    /**
     * Stops the server.
     */
    stop() : void;

    /**
     * Adds a listener for validation report coming from the server.
     * @param listener
     */
    onValidationReport(listener : (report:IValidationReport)=>void);

    /**
     * Notifies the server that document is opened.
     * @param document
     */
    documentOpened(document: IOpenedDocument);

    /**
     * Notified the server that document is closed.
     * @param uri
     */
    documentClosed(uri : string);

    /**
     * Notifies the server that document is changed.
     * @param document
     */
    documentChanged(document : IChangedDocument);

    /**
     * Requests server for the document structure.
     * @param uri
     */
    getStructure(uri: string) : Promise<{[categoryName:string] : StructureNodeJSON}>

    /**
     * Requests server for the suggestions.
     * @param uri - document uri
     * @param position - offset in the document, starting from 0
     */
    getSuggestions(uri: string, position: number) : Promise<Suggestion[]>
}