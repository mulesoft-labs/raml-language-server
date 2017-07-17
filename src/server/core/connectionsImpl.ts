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
    ILocation,
    DetailsItemJSON,
    IDetailsReport
} from '../../common/typeInterfaces'

import utils = require("../../common/utils")

export abstract class AbstractServerConnection {

    protected openDocumentListeners : {(document: IOpenedDocument):void}[] = [];
    protected changeDocumentListeners : {(document: IChangedDocument):void}[] = [];
    protected closeDocumentListeners : {(string):void}[] = [];
    protected documentStructureListeners : {(uri : string):Promise<{[categoryName:string] : StructureNodeJSON}>}[] = [];
    protected documentCompletionListeners : {(uri : string, position: number):Promise<Suggestion[]>}[] = [];
    protected openDeclarationListeners : {(uri : string, position: number):ILocation[]}[] = [];
    protected findreferencesListeners : {(uri : string, position: number):ILocation[]}[] = [];
    protected markOccurrencesListeners : {(uri : string, position: number):IRange[]}[] = [];
    protected renameListeners : {(uri : string, position: number, newName: string):IChangedDocument[]}[] = [];
    protected documentDetailsListeners : {(uri : string, position: number):Promise<DetailsItemJSON>}[] = [];
    private changePositionListeners: {(uri : string, position: number):void}[] = [];

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
    onDocumentStructure(listener: (uri : string)=>Promise<{[categoryName:string] : StructureNodeJSON}>) {
        this.documentStructureListeners.push(listener);
    }

    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentCompletion(listener: (uri : string, position: number)=>Promise<Suggestion[]>) {
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
     * Reports new calculated details when available.
     * @param report - details report.
     */
    detailsAvailable(report: IDetailsReport) {
        //we dont need it
    }


    /**
     * Marks occurrences of a symbol under the cursor in the current document.
     * @param listener
     */
    onMarkOccurrences(listener: (uri: string, position: number) => IRange[]) {
        this.markOccurrencesListeners.push(listener);
    }

    /**
     * Finds the set of document (and non-document files) edits to perform the requested rename.
     * @param listener
     */
    onRename(listener: (uri: string, position: number, newName: string) => IChangedDocument[]) {
        this.renameListeners.push(listener);
    }

    /**
     * Adds a listener to document details request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentDetails(listener: (uri : string, position: number)=>Promise<DetailsItemJSON>) {
        this.documentDetailsListeners.push(listener);
    }

    /**
     * Adds a listener to document cursor position change notification.
     * Must notify listeners in order of registration.
     * @param listener
     */
    onChangePosition(listener: (uri: string, position: number)=>void) {
        this.changePositionListeners.push(listener);
    }
}