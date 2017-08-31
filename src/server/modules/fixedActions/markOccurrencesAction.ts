// This module provides a fixed action for finding occurrences of RAML node

import {
    IServerConnection
} from "../../core/connections";

import {
    IASTManagerModule
} from "../astManager";

import {
    IEditorManagerModule
} from "../editorManager";

import {
    ILocation,
    IRange
} from "../../../common/typeInterfaces";

import rp= require("raml-1-parser");
import search = rp.search;
import lowLevel= rp.ll;
import hl= rp.hl;

import {
    IListeningModule
} from "../../modules/commonInterfaces";

import utils = require("../../../common/utils");
import fixedActionCommon = require("./fixedActionsCommon");
import openDeclarationsModule = require("./openDeclarationAction");

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule)
                        : IListeningModule {

    return new MarkOccurrencesActionModule(connection, astManagerModule, editorManagerModule);
}

class MarkOccurrencesActionModule implements IListeningModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    public listen() {
        this.connection.onMarkOccurrences((uri: string, position: number) => {
            return this.markOccurrences(uri, position);
        });
    }

    public markOccurrences(uri: string, position: number): IRange[] {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "markOccurrences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "markOccurrences");

        if (utils.extName(uri) !== ".raml") {
            return [];
        }

        const ast = this.astManagerModule.getCurrentAST(uri);

        this.connection.debugDetail("Found AST: " + (ast ? "true" : false),
            "FixedActionsManager", "markOccurrences");

        if (!ast) {
            return [];
        }

        const unit = ast.lowLevel().unit();

        // TODO both search and declaration unit filtering is better to be moved directly to the search module
        // in order to save CPU by not checking external units and just be flagged here
        const findUsagesResult = search.findUsages(unit, position);

        this.connection.debugDetail("Found usages: " + (findUsagesResult ? "true" : false),
            "FixedActionsManager", "markOccurrences");

        let unfiltered: ILocation[] = [];
        let result: IRange[] = [];
        if (findUsagesResult && findUsagesResult.results) {

            this.connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
                "FixedActionsManager", "markOccurrences");

            unfiltered = unfiltered.concat(findUsagesResult.results.map((parseResult) => {
                return fixedActionCommon.lowLevelNodeToLocation(uri, parseResult.lowLevel(),
                    this.editorManagerModule, this.connection, true);
            }));
        }

        const declarations = openDeclarationsModule.createManager(
            this.connection, this.astManagerModule, this.editorManagerModule
        ).openDeclaration(uri, position);

        if (declarations) {
            unfiltered = unfiltered.concat(declarations);
        }

        result = unfiltered.filter((location) => {
            return location.uri === uri;
        }).filter((location) => {
            // excluding any mentions of whatever is located at the position itself
            // as its not what user is interested with
            return location.range.start > position || location.range.end < position;
        }).map((location) => {
            return location.range;
        });

        return result;
    }
}
