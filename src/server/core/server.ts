import {
    IServerConnection
} from './connections'

import EditorManagerModule = require("../modules/editorManager")

import ASTManagerModule = require('../modules/astManager')

import ValidationManagerModule = require('../modules/validationManager')

import StructureManagerModule = require('../modules/structureManager')

import CompletionManagerModule = require('../modules/completionManager')

import FixedActionsManagerModule = require('../modules/fixedActionsManager')

export class Server {

    private astManagerModule : ASTManagerModule.IASTManagerModule;
    private editorManagerModule : EditorManagerModule.IEditorManagerModule;
    private validationManagerModule : ValidationManagerModule.IValidationManagerModule;
    private structureManagerModule : StructureManagerModule.IStructureManagerModule;
    private completionManagerModule : CompletionManagerModule.ICompletionManagerModule;
    private fixedActionsManagerModule : FixedActionsManagerModule.IFixedActionsManagerModule;

    constructor(private connection : IServerConnection){

        this.editorManagerModule = EditorManagerModule.createManager(connection);

        this.astManagerModule = ASTManagerModule.createManager(connection,
            this.editorManagerModule);

        this.validationManagerModule = ValidationManagerModule.createManager(connection,
            this.astManagerModule);

        this.structureManagerModule = StructureManagerModule.createManager(connection,
            this.astManagerModule);

        this.completionManagerModule = CompletionManagerModule.createManager(connection,
            this.astManagerModule, this.editorManagerModule);

        this.fixedActionsManagerModule = FixedActionsManagerModule.createManager(connection,
            this.astManagerModule, this.editorManagerModule);
    }

    listen() : void {
        this.listenInternal();

        this.editorManagerModule.listen();

        this.astManagerModule.listen();

        this.validationManagerModule.listen();

        this.structureManagerModule.listen();

        this.completionManagerModule.listen();

        this.fixedActionsManagerModule.listen();
    }

    listenInternal() : void {

    }

}