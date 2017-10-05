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
    IServerModule
} from "../../modules/commonInterfaces";

import utils = require("../../../common/utils");
import fixedActionCommon = require("./fixedActionsCommon");
import openDeclarationsModule = require("./openDeclarationAction");

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule)
                        : IServerModule {

    return new MarkOccurrencesActionModule(connection, astManagerModule, editorManagerModule);
}

class MarkOccurrencesActionModule implements IServerModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    public launch() {
        this.connection.onMarkOccurrences((uri: string, position: number) => {
            return this.markOccurrences(uri, position);
        });
    }

    /**
     * Returns unique module name.
     */
    public getModuleName(): string {
        return "MARK_OCCURRENCES_ACTION";
    }

    public markOccurrences(uri: string, position: number): Promise<IRange[]> {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "markOccurrences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "markOccurrences");

        if (utils.extName(uri) !== ".raml") {
            return Promise.resolve([]);
        }

        return this.astManagerModule.forceGetCurrentAST(uri).then((ast) => {

            this.connection.debugDetail("Found AST: " + (ast ? "true" : false),
                "FixedActionsManager", "markOccurrences");

            if (!ast) {
                return [];
            }

            const unit = ast.lowLevel().unit();

            // TODO both search and declaration unit filtering is better to be moved directly to the search module
            // in order to save CPU by not checking external units and just be flagged here

            const node = ast.findElementAtOffset(position);
            if (!node) {
                return [];
            }

            // this.connection.debugDetail("Found node: \n" + node.printDetails(),
            //     "FixedActionsManager", "markOccurrences");

            const name = node.attrValue("name");
            const type = node.attrValue("type");
            if (!name && !type) {
                return [];
            }

            const findUsagesResult = search.findUsages(unit, position);

            this.connection.debugDetail("Found usages: " + (findUsagesResult ? "true" : false),
                "FixedActionsManager", "markOccurrences");

            let unfiltered: ILocation[] = [];

            if (findUsagesResult && findUsagesResult.results) {

                this.connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
                    "FixedActionsManager", "markOccurrences");

                unfiltered = unfiltered.concat(findUsagesResult.results.map((parseResult) => {
                    return fixedActionCommon.lowLevelNodeToLocation(uri, parseResult.lowLevel(),
                        this.editorManagerModule, this.connection, true);
                }));
            }

            return openDeclarationsModule.createManager(
                this.connection, this.astManagerModule, this.editorManagerModule
            ).openDeclaration(uri, position).then((declarations) => {

                this.connection.debugDetail("Number of found declarations: " + declarations.length,
                    "FixedActionsManager", "markOccurrences");

                if (declarations) {
                    unfiltered = unfiltered.concat(declarations);
                }

                let result: IRange[] = [];

                result = unfiltered.filter((location) => {
                    return location.uri === uri;
                }).filter((location) => {
                    // excluding any mentions of whatever is located at the position itself
                    // as its not what user is interested with
                    return location.range.start > position || location.range.end < position;
                }).map((location) => {
                    return location.range;
                });

                this.connection.debugDetail("Found occurrences result: " + JSON.stringify(result),
                    "FixedActionsManager", "markOccurrences");

                return result;
            });

        });

    }
}
