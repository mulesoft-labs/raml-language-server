//This module provides RAML module structure

import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

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
                              astManagerModule : IASTManagerModule) : IListeningModule {

    return new DetailsManager(connection, astManagerModule);
}



/**
 * Generates node key
 * @param node
 * @returns {any}
 */
export function keyProvider(node: hl.IParseResult) : string {
    if (!node) return null;
    if (node && !node.parent()) return node.name();
    else return node.name() + " :: " + keyProvider(node.parent());
}

export function initialize() {

    ramlOutline.initialize();
    ramlOutline.setKeyProvider(<any>keyProvider);
}

initialize();

class ASTProvider implements ramlOutline.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule,
                private logger: ILogger) {
    }

    getASTRoot() {
        this.logger.debug("Asked for AST", "ASTProvider", "getASTRoot")
        let ast = <any> this.astManagerModule.getCurrentAST(this.uri);

        this.logger.debugDetail("AST found: " + (ast?"true":"false"), "ASTProvider", "getASTRoot")

        return ast;
    }

    getSelectedNode() {
        return this.getASTRoot();
    }
}

class DetailsManager {

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule) {
    }

    listen() {
        this.connection.onDocumentDetails((uri, position)=>{
            return this.getDetails(uri, position);
        })
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

        return this.calculateDetails(uri, position).then(calculated=>{

            this.connection.debug("Calculation result is not null:" + (calculated != null ? "true" : "false"), "DetailsManager",
                "getDetails");

            return calculated;

        }).catch(error=>{
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