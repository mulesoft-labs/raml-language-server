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
    IDisposableModule
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
                        : IDisposableModule {

    return new FindReferencesActionModule(connection, astManagerModule, editorManagerModule);
}

class FindReferencesActionModule implements IDisposableModule {

    private onFindReferencesListener;

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    public launch() {

        this.onFindReferencesListener = (uri: string, position: number) => {
            return this.findReferences(uri, position);
        }

        this.connection.onFindReferences(this.onFindReferencesListener);
    }

    public dispose(): void {
        this.connection.onFindReferences(this.onFindReferencesListener, true);
    }

    /**
     * Returns unique module name.
     */
    public getModuleName(): string {
        return "FIND_REFERENCES_ACTION";
    }

    public findReferences(uri: string, position: number): Promise<ILocation[]> {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "findReferences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "findReferences");

        if (utils.extName(uri) !== ".raml") {
            return Promise.resolve([]);
        }

        const connection = this.connection;

        return this.astManagerModule.forceGetCurrentAST(uri).then((ast) => {

            connection.debugDetail("Found AST: " + (ast ? "true" : false),
                "FixedActionsManager", "findReferences");

            if (!ast) {
                return [];
            }

            const unit = ast.lowLevel().unit();

            const findUsagesResult = search.findUsages(unit, position);

            connection.debugDetail("Found usages: " + (findUsagesResult ? "true" : false),
                "FixedActionsManager", "findReferences");

            if (!findUsagesResult || !findUsagesResult.results) {
                return [];
            }
            connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
                "FixedActionsManager", "findReferences");

            const result = findUsagesResult.results.map((parseResult) => {
                return fixedActionCommon.lowLevelNodeToLocation(uri, parseResult.lowLevel(),
                    this.editorManagerModule, connection, true);
            });

            connection.debugDetail("Usages are: " + JSON.stringify(result),
                "FixedActionsManager", "findReferences");

            return result;
        });
    }
}
