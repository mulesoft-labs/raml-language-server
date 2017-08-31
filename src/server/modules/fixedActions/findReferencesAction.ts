// This module provides a fixed action for finding references/usages of RAML node

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

import {
    IListeningModule
} from "../../modules/commonInterfaces";

import rp= require("raml-1-parser");
import search = rp.search;
import lowLevel= rp.ll;
import hl= rp.hl;

import utils = require("../../../common/utils");
import fixedActionCommon = require("./fixedActionsCommon");

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule)
                        : IListeningModule {

    return new FindReferencesActionModule(connection, astManagerModule, editorManagerModule);
}

class FindReferencesActionModule implements IListeningModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    public listen() {
        this.connection.onFindReferences((uri: string, position: number) => {
            return this.findReferences(uri, position);
        });
    }

    public findReferences(uri: string, position: number): ILocation[] {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "findReferences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "findReferences");

        if (utils.extName(uri) !== ".raml") {
            return [];
        }

        const ast = this.astManagerModule.getCurrentAST(uri);

        this.connection.debugDetail("Found AST: " + (ast ? "true" : false),
            "FixedActionsManager", "findReferences");

        if (!ast) {
            return [];
        }

        const unit = ast.lowLevel().unit();

        const findUsagesResult = search.findUsages(unit, position);

        this.connection.debugDetail("Found usages: " + (findUsagesResult ? "true" : false),
            "FixedActionsManager", "findReferences");

        if (!findUsagesResult || !findUsagesResult.results) {
            return [];
        }
        this.connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
            "FixedActionsManager", "findReferences");

        return findUsagesResult.results.map((parseResult) => {
            return fixedActionCommon.lowLevelNodeToLocation(uri, parseResult.lowLevel(),
                this.editorManagerModule, this.connection, true);
        });
    }
}
