import {
    IServerConnection
} from './connections'

import {
    IRange,
    IValidationIssue,
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    StructureCategories,
    Suggestion,
    MessageSeverity,
    ILocation
} from '../../common/typeInterfaces'

import utils = require("../../common/utils")

export abstract class AbstractServerConnection {

    protected openDocumentListeners : {(document: IOpenedDocument):void}[] = [];
    protected changeDocumentListeners : {(document: IChangedDocument):void}[] = [];
    protected closeDocumentListeners : {(string):void}[] = [];
    protected documentStructureListeners : {(uri : string):{[categoryName:string] : StructureNodeJSON}}[] = [];
    protected documentCompletionListeners : {(uri : string, position: number):Suggestion[]}[] = [];
    protected openDeclarationListeners : {(uri : string, position: number):ILocation[]}[] = [];
    protected findreferencesListeners : {(uri : string, position: number):ILocation[]}[] = [];
    protected markOccurrencesListeners : {(uri : string, position: number):IRange[]}[] = [];

    /**
     * Adds a listener to document open notification. Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDocument(listener: (document: IOpenedDocument)=>void) {
        this.openDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document change notification. Must notify listeners in order of registration.
     * @param listener
     */
    onChangeDocument(listener: (document : IChangedDocument)=>void) {
        this.changeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document close notification. Must notify listeners in order of registration.
     * @param listener
     */
    onCloseDocument(listener: (uri : string)=>void) {
        this.closeDocumentListeners.push(listener);
    }

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentStructure(listener: (uri : string)=>{[categoryName:string] : StructureNodeJSON}) {
        this.documentStructureListeners.push(listener);
    }

    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentCompletion(listener: (uri : string, position: number)=>Suggestion[]) {
        this.documentCompletionListeners.push(listener);
    }

    /**
     * Adds a listener to document open declaration request.  Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDeclaration(listener: (uri: string, position: number) => ILocation[]){
        this.openDeclarationListeners.push(listener);
    }

    /**
     * Adds a listener to document find references request.  Must notify listeners in order of registration.
     * @param listener
     */
    onFindReferences(listener: (uri: string, position: number) => ILocation[]){
        this.findreferencesListeners.push(listener);
    }

    /**
     * Reports new calculated structure when available.
     * @param report - structure report.
     */
    structureAvailable(report: IStructureReport) {
        //we dont need it
    }

    /**
     * Marks occurrences of a symbol under the cursor in the current document.
     * @param listener
     */
    onMarkOccurrences(listener: (uri: string, position: number) => IRange[]) {
        this.markOccurrencesListeners.push(listener);
    }
}