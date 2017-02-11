import {
    IValidationIssueRange,
    IValidationIssue,
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion
} from '../../common/typeInterfaces'

export {
    IValidationIssueRange,
    IValidationIssue,
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion
} from '../../common/typeInterfaces'

export interface IServerConnection {
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

    onDocumentStructure(listener: (uri : string)=>{[categoryName:string] : StructureNodeJSON})

    /**
     * Reports latest validation results
     * @param report
     */
    validated(report:IValidationReport) : void;

    log(message : string);
}