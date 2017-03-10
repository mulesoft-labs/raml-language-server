import {
    IRange,
    IValidationIssue,
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    ILogger,
    MessageSeverity,
    ILocation
} from '../../common/typeInterfaces'

export {
    IRange,
    IValidationIssue,
    IValidationReport,
    IStructureReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    ILogger,
    MessageSeverity,
    ILocation
} from '../../common/typeInterfaces'

export interface IServerConnection extends ILogger {
    /**
     * Adds a listener to document open notification. Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDocument(listener: (document: IOpenedDocument)=>void);

    /**
     * Adds a listener to document change notification. Must notify listeners in order of registration.
     * @param listener
     */
    onChangeDocument(listener: (document : IChangedDocument)=>void);

    /**
     * Adds a listener to document close notification. Must notify listeners in order of registration.
     * @param listener
     */
    onCloseDocument(listener: (uri : string)=>void);

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    /**
     * Adds a listener to document completion request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentCompletion(listener: (uri : string, position: number)=>Suggestion[])

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentStructure(listener: (uri : string)=>{[categoryName:string] : StructureNodeJSON})

    /**
     * Adds a listener to document open declaration request.  Must notify listeners in order of registration.
     * @param listener
     */
    onOpenDeclaration(listener: (uri: string, position: number) => ILocation[])

    /**
     * Adds a listener to document find references request.  Must notify listeners in order of registration.
     * @param listener
     */
    onFindReferences(listener: (uri: string, position: number) => ILocation[])

    /**
     * Reports latest validation results
     * @param report
     */
    validated(report:IValidationReport) : void;

    /**
     * Reports new calculated structure when available.
     * @param report - structure report.
     */
    structureAvailable(report: IStructureReport);
}