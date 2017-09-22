// This manager handles fixed actions as opposed to dynamic context-depended actions

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
    IServerModule
} from "./commonInterfaces";

import findReferencesModule = require("./fixedActions/findReferencesAction");
import markOccurrencesModule = require("./fixedActions/markOccurrencesAction");
import openDeclarationModule = require("./fixedActions/openDeclarationAction");
import renameModule = require("./fixedActions/renameAction");

import fixedActionsCommon = require("./fixedActions/fixedActionsCommon");

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule): IServerModule {

    return new FixedActionsManager(connection, astManagerModule, editorManagerModule);
}

class FixedActionsManager implements IServerModule {

    private subModules: IServerModule[] = [];

    constructor(
        private connection: IServerConnection,
        private astManagerModule: IASTManagerModule,
        private editorManagerModule: IEditorManagerModule) {

        this.subModules.push(openDeclarationModule.createManager(
            this.connection, this.astManagerModule, this.editorManagerModule
        ));

        this.subModules.push(findReferencesModule.createManager(
            this.connection, this.astManagerModule, this.editorManagerModule
        ));

        this.subModules.push(markOccurrencesModule.createManager(
            this.connection, this.astManagerModule, this.editorManagerModule
        ));

        this.subModules.push(renameModule.createManager(
            this.connection, this.astManagerModule, this.editorManagerModule
        ));
    }

    public launch() {
        this.subModules.forEach((subModule) => subModule.launch());
    }

    /**
     * Returns unique module name.
     */
    public getModuleName(): string {
        return "FIXED_ACTIONS_MANAGER";
    }
}
