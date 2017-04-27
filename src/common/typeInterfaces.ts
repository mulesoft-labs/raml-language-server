import outline = require("raml-outline")
import suggestions = require("raml-suggestions")

export {
    MessageSeverity,
    ILoggerSettings,
    ILogger
} from './logger'

/**
 * Structure node JSON representation.
 */
export type StructureNodeJSON = outline.StructureNodeJSON;

/**
 * Code completion suggestion
 */
export type Suggestion = suggestions.Suggestion;

/**
 * Range in the document.
 */
export interface IRange {

    /**
     * Range start position, counting from 0
     */
    start: number

    /**
     * Range end position, counting from 0
     */
    end: number
}

export interface IValidationIssue {
    /**
     * Error code
     */
    code : string

    /**
     * Error type.
     */
    type: string

    /**
     * To be renamed to uri.
     */
    filePath: string

    text: string
    range: IRange
    trace: IValidationIssue[]
}

export interface IValidationReport {
    /**
     * This is the "point of view" uri, actual reported unit paths are located
     * in the particular issues.
     */
    pointOfViewUri : string;

    /**
     * Optional document version of the point of view.
     */
    version?: number;

    /**
     * Validation issues.
     */
    issues: IValidationIssue[];
}

export interface IStructureReport {
    /**
     * Document uri.
     */
    uri : string;

    /**
     * Optional document version.
     */
    version?: number;

    /**
     * Document structure.
     */
    structure: {[categoryName:string] : StructureNodeJSON};
}

export interface IOpenedDocument {
    /**
     * Document URI
     */
    uri: string;

    /**
     * Optional document version.
     */
    version?: number;

    /**
     * Document content
     */
    text?: string;
}

export interface ITextEdit {
    /**
     * Range to replace. Range start==end==0 => insert into the beginning of the document,
     * start==end==document end => insert into the end of the document
     */
    range : IRange,

    /**
     * Text to replace given range with.
     */
    text: string
}

export interface IChangedDocument {
    /**
     * Document URI
     */
    uri: string;

    /**
     * Optional document version.
     */
    version?: number;

    /**
     * Document content
     */
    text?: string;

    /**
     * Optional set of text edits instead of complete text replacement.
     * Is only taken into account if text is null.
     */
    textEdits? : ITextEdit[];
}

export enum StructureCategories {
    ResourcesCategory = <any>"Resources",
    SchemasAndTypesCategory = <any>"Schemas & Types",
    ResourceTypesAndTraitsCategory = <any>"Resource Types & Traits",
    OtherCategory = <any>"Other"
}

//TODO rename from currently used atom icons to something more meaningful/universal
export enum Icons {
    ARROW_SMALL_LEFT = <any>"ARROW_SMALL_LEFT",
    PRIMITIVE_SQUARE = <any>"PRIMITIVE_SQUARE",
    PRIMITIVE_DOT = <any>"PRIMITIVE_DOT",
    FILE_SUBMODULE = <any>"FILE_SUBMODULE",
    TAG = <any>"TAG",
    FILE_BINARY = <any>"FILE_BINARY",
    BOOK = <any>"BOOK"
}

//TODO rename from currently used atom styles to something more meaningful/universal
export enum TextStyles {
    NORMAL = <any>"NORMAL",
    HIGHLIGHT = <any>"HIGHLIGHT",
    WARNING = <any>"WARNING",
    SUCCESS = <any>"SUCCESS"
}

/**
 * Range in a particular document
 */
export interface ILocation {

    /**
     * Document uri
     */
    uri : string;

    /**
     * Optional document version.
     */
    version?: number;

    /**
     * Range in the document.
     */
    range: IRange
}