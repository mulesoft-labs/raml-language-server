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
    ILocation,
    ILoggerSettings,
    DetailsItemJSON,
    IDetailsReport
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
    ILocation,
    ILoggerSettings,
    DetailsItemJSON,
    IDetailsReport
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
    onDocumentCompletion(listener: (uri : string, position: number)=>Promise<Suggestion[]>)

    /**
     * Adds a listener to document structure request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentStructure(listener: (uri : string)=>Promise<{[categoryName:string] : StructureNodeJSON}>)

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

    /**
     * Marks occurrences of a symbol under the cursor in the current document.
     * @param listener
     */
    onMarkOccurrences(listener: (uri: string, position: number) => IRange[])

    /**
     * Finds the set of document (and non-document files) edits to perform the requested rename.
     * @param listener
     */
    onRename(listener: (uri: string, position: number, newName: string) => IChangedDocument[])

    /**
     * Sets connection logger configuration.
     * @param loggerSettings
     */
    setLoggerConfiguration(loggerSettings: ILoggerSettings)

    /**
     * Returns whether path/url exists.
     * @param fullPath
     */
    exists(path: string): Promise<boolean>

    /**
     * Returns directory content list.
     * @param fullPath
     */
    readDir(path: string): Promise<string[]>

    /**
     * Returns whether path/url represents a directory
     * @param path
     */
    isDirectory(path: string): Promise<boolean>

    /**
     * File contents by full path/url.
     * @param fullPath
     */
    content(fullPath:string):Promise<string>

    /**
     * Adds a listener to document details request. Must notify listeners in order of registration.
     * @param listener
     */
    onDocumentDetails(listener: (uri : string, position: number)=>Promise<DetailsItemJSON>)

    /**
     * Adds a listener to document cursor position change notification.
     * Must notify listeners in order of registration.
     * @param listener
     */
    onChangePosition(listener: (uri: string, position: number)=>void);

    /**
     * Reports new calculated details when available.
     * @param report - details report.
     */
    detailsAvailable(report: IDetailsReport);
}