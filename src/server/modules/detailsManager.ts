// This module provides RAML module structure

import {
    IServerConnection
} from "../core/connections";

import {
    IASTManagerModule
} from "./astManager";

import {
    IEditorManagerModule
} from "./editorManager";

import {
    DetailsItemJSON,
    ILogger,
    IValidationIssue
} from "../../common/typeInterfaces";

import {
    IDisposableModule,
    IServerModule
} from "./commonInterfaces";

import rp= require("raml-1-parser");
import lowLevel= rp.ll;
import hl= rp.hl;
import utils = rp.utils;
import ramlOutline = require("raml-outline");
import outlineManagerCommons = require("./outlineManagerCommons");

const universes = rp.universes;

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule): IDisposableModule {

    return new DetailsManager(connection, astManagerModule, editorManagerModule);
}

export function initialize() {
    outlineManagerCommons.initialize();
}

initialize();

class DetailsManager implements IDisposableModule {

    /**
     * Whether direct calculation is on.
     * @type {boolean}
     */
    private calculatingDetailsOnDirectRequest = false;

    private onDocumentDetailsListener;
    private onNewASTAvailableListener;
    private onChangePositionListener;

    /**
     * Remembering positions for opened documents.
     * @type {{}}
     */
    private uriToPositions: {[uri: string]: number} = {};

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManager: IEditorManagerModule) {
    }

    public launch() {

        this.onDocumentDetailsListener = (uri, position) => {
            return this.getDetails(uri, position);
        };
        this.connection.onDocumentDetails(this.onDocumentDetailsListener);

        this.onNewASTAvailableListener = (uri: string, version: number, ast: hl.IHighLevelNode) => {

            this.connection.debug("Got new AST report for uri " + uri,
                "DetailsManager", "listen");

            this.calculateAndSendDetailsReport(uri, version);
        };
        this.astManagerModule.onNewASTAvailable(this.onNewASTAvailableListener);

        this.onChangePositionListener = (uri, position) => {

            this.connection.debug("Got new position report for uri " + uri + " : " + position,
                "DetailsManager", "listen");

            this.uriToPositions[uri] = position;

            const editor = this.editorManager.getEditor(uri);

            if (!editor) {
                return;
            }
            const version = editor.getVersion();

            this.calculateAndSendDetailsReport(uri, version);
        };
        this.connection.onChangePosition(this.onChangePositionListener);
    }

    public dispose(): void {
        this.connection.onDocumentDetails(this.onDocumentDetailsListener, true);
        this.astManagerModule.onNewASTAvailable(this.onNewASTAvailableListener, true);
        this.connection.onChangePosition(this.onChangePositionListener, true);
    }

    /**
     * Returns unique module name.
     */
    public getModuleName(): string {
        return "DETAILS_MANAGER";
    }

    public vsCodeUriToParserUri(vsCodeUri: string): string {
        if (vsCodeUri.indexOf("file://") === 0) {
            return vsCodeUri.substring(7);
        }

        return vsCodeUri;
    }

    public getDetails(uri: string, position: number): Promise<DetailsItemJSON> {
        this.connection.debug("Requested details for uri " + uri + " and position " + position, "DetailsManager",
            "getDetails");

        this.calculatingDetailsOnDirectRequest = true;

        return this.calculateDetails(uri, position).then((calculated) => {

            this.connection.debug("Calculation result is not null:" +
                (calculated != null ? "true" : "false"), "DetailsManager",
                "getDetails");

            this.calculatingDetailsOnDirectRequest = false;

            return calculated;

        }).catch((error) => {
            this.calculatingDetailsOnDirectRequest = false;
            throw error;
        });
    }

    public calculateDetails(uri: string, position: number): Promise<DetailsItemJSON> {

        this.connection.debug("Called for uri: " + uri,
            "DetailsManager", "calculateDetails");

        // Forcing current AST to exist
        return this.astManagerModule.forceGetCurrentAST(uri).then((currentAST) => {

            outlineManagerCommons.setOutlineASTProvider(uri, this.astManagerModule,
                                                        this.editorManager, this.connection);

            const result = ramlOutline.getDetailsJSON(position);

            this.connection.debug("Calculation result is not null:" +
                (result != null ? "true" : "false"), "DetailsManager",
                "calculateDetails");

            if (result) {
                this.connection.debugDetail("Calculation result: "
                    + JSON.stringify(result, null, 2), "DetailsManager", "calculateDetails");
            }

            return result;
        });
    }

    private calculateAndSendDetailsReport(uri: string, version: number) {

        // we do not want reporting while performing the calculation
        if (this.calculatingDetailsOnDirectRequest) {
            return;
        }

        this.connection.debug("Calculating details", "DetailsManager",
            "calculateAndSendDetailsReport");

        const knownPosition = this.uriToPositions[uri];
        this.connection.debug("Found position: " + knownPosition, "DetailsManager",
            "calculateAndSendDetailsReport");

        if (knownPosition != null) {
            this.calculateDetails(uri, knownPosition).then((detailsForUri) => {
                this.connection.debug("Calculation result is not null:" +
                    (detailsForUri != null ? "true" : "false"), "DetailsManager",
                    "calculateAndSendDetailsReport");

                if (detailsForUri) {
                    this.connection.detailsAvailable({
                        uri,
                        position: knownPosition,
                        version,
                        details: detailsForUri
                    });
                }
            });
        }
    }
}
