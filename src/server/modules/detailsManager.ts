//This module provides RAML module structure

import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

import {
    IEditorManagerModule
} from './editorManager'

import {
    IValidationIssue,
    DetailsItemJSON,
    ILogger
} from '../../common/typeInterfaces'

import {
    IListeningModule
} from './commonInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
import utils = rp.utils;
import ramlOutline =require('raml-outline')
import outlineManagerCommons = require('./outlineManagerCommons')

let universes=rp.universes;

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : IListeningModule {

    return new DetailsManager(connection, astManagerModule, editorManagerModule);
}

export function initialize() {
    outlineManagerCommons.initialize();
}

initialize();


class DetailsManager {

    /**
     * Whether direct calculation is on.
     * @type {boolean}
     */
    private calculatingDetailsOnDirectRequest = false;

    /**
     * Remembering positions for opened documents.
     * @type {{}}
     */
    private uriToPositions : {[uri:string]:number} = {}

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
        private editorManager: IEditorManagerModule) {
    }

    listen() {
        this.connection.onDocumentDetails((uri, position)=>{
            return this.getDetails(uri, position);
        })

        this.astManagerModule.onNewASTAvailable((uri: string, version:number, ast: hl.IHighLevelNode)=>{

            this.calculateAndSendDetailsReport(uri, version);
        })

        this.connection.onChangePosition((uri, position)=>{

            this.uriToPositions[uri] = position;

            let editor = this.editorManager.getEditor(uri);

            if (!editor) return;
            let version = editor.getVersion();

            this.calculateAndSendDetailsReport(uri, version);
        })
    }

    private calculateAndSendDetailsReport(uri: string, version: number) {

        //we do not want reporting while performing the calculation
        if (this.calculatingDetailsOnDirectRequest) return;

        this.connection.debug("Calculating structure due to new AST available", "StructureManager",
            "listen");

        let knownPosition = this.uriToPositions[uri];
        if (knownPosition != null) {
            this.calculateDetails(uri, knownPosition).then(detailsForUri=>{
                this.connection.debug("Calculation result is not null:" + (detailsForUri!=null?"true":"false"), "DetailsManager",
                    "listen");

                if (detailsForUri) {
                    this.connection.detailsAvailable({
                        uri: uri,
                        position: knownPosition,
                        version: version,
                        details: detailsForUri
                    })
                }
            })
        }
    }

    vsCodeUriToParserUri(vsCodeUri : string) : string {
        if (vsCodeUri.indexOf("file://") == 0) {
            return vsCodeUri.substring(7);
        }

        return vsCodeUri;
    }

    getDetails(uri : string, position: number): Promise<DetailsItemJSON> {
        this.connection.debug("Requested details for uri " + uri + " and position " + position, "DetailsManager",
            "getDetails");

        this.calculatingDetailsOnDirectRequest = true;

        return this.calculateDetails(uri, position).then(calculated=>{

            this.connection.debug("Calculation result is not null:" + (calculated != null ? "true" : "false"), "DetailsManager",
                "getDetails");

            this.calculatingDetailsOnDirectRequest = false;

            return calculated;

        }).catch(error=>{
            this.calculatingDetailsOnDirectRequest = false;
            throw error;
        })
    }

    calculateDetails(uri : string, position: number): Promise<DetailsItemJSON> {

        this.connection.debug("Called for uri: " + uri,
            "DetailsManager", "calculateDetails");

        //Forcing current AST to exist
        return this.astManagerModule.forceGetCurrentAST(uri).then(currentAST=>{

            outlineManagerCommons.setOutlineASTProvider(uri, this.astManagerModule, this.connection);

            let result = ramlOutline.getDetailsJSON(position);

            this.connection.debug("Calculation result is not null:" + (result!=null?"true":"false"), "DetailsManager",
                "calculateDetails");

            if (result) {
                this.connection.debugDetail("Calculation result: "
                    + JSON.stringify(result, null, 2), "DetailsManager", "calculateDetails")
            }

            return result;
        })
    }
}