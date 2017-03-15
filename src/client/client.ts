import {
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    ILogger,
    ILocation,
    IRange
} from "../common/typeInterfaces";

export {
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    ILogger,
    ILocation,
    IRange
} from '../common/typeInterfaces'

export interface IClientConnection extends ILogger {

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
     * Instead of calling getStructure to get immediate structure report for the document,
     * this method allows to listen to the new structure reports when those are available.
     * @param listener
     */
    onStructureReport(listener : (report:IStructureReport)=>void);

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

    /**
     * Requests server for the positions of the declaration of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    openDeclaration(uri: string, position: number) : Promise<ILocation[]>

    /**
     * Requests server for the positions of the references of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    findReferences(uri: string, position: number) : Promise<ILocation[]>

    /**
     * Requests server for the positions of the references of the element defined
     * at the given document position.
     * @param uri - document uri
     * @param position - position in the document
     */
    markOccurrencesReferences(uri: string, position: number) : Promise<IRange[]>
}