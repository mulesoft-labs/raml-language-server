import outline = require("raml-outline")
import suggestions = require("raml-suggestions")

/**
 * Structure node JSON representation.
 */
export type StructureNodeJSON = outline.StructureNodeJSON;

/**
 * Code completion suggestion
 */
export type Suggestion = suggestions.Suggestion;

export interface IValidationIssueRange {
    start: number
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
    range: IValidationIssueRange
    trace: IValidationIssue[]
}

export interface IValidationReport {
    /**
     * This is the "point of view" uri, actual reported unit paths are located
     * in the particular issues.
     */
    pointOfViewUri : string

    /**
     * Validation issues.
     */
    issues: IValidationIssue[]
}

export interface IOpenedDocument {
    /**
     * Document URI
     */
    uri: string;

    /**
     * Document content
     */
    text?: string;
}

export interface IChangedDocument {
    /**
     * Document URI
     */
    uri: string;

    /**
     * Document content
     */
    text?: string;

    //TODO add an alternative to describe the changes as a set of edits
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