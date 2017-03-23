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
    IListeningModule
} from './commonInterfaces'

import openDeclarationModule = require("./fixedActions/openDeclarationAction")
import findReferencesModule = require("./fixedActions/findReferencesAction")
import markOccurrencesModule = require("./fixedActions/markOccurrencesAction")
import renameModule = require("./fixedActions/renameAction")

import fixedActionsCommon = require("./fixedActions/fixedActionsCommon")


export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : IListeningModule {

    return new FixedActionsManager(connection, astManagerModule, editorManagerModule);
}

class FixedActionsManager {

    private subModules : fixedActionsCommon.IFixedActionsManagerSubModule[] = []

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

    listen() {
        this.subModules.forEach(subModule=>subModule.listen());
    }
}