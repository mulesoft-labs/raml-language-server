import {
    IServerConnection
} from "./connections";

import {
    IListeningModule
} from "../modules/commonInterfaces";

import EditorManagerModule = require("../modules/editorManager");

import ASTManagerModule = require("../modules/astManager");

import ValidationManagerModule = require("../modules/validationManager");

import StructureManagerModule = require("../modules/structureManager");

import CompletionManagerModule = require("../modules/completionManager");

import FixedActionsManagerModule = require("../modules/fixedActionsManager");

import DetailsManagerModule = require("../modules/detailsManager");

import CustomActionsManagerModule = require("../modules/customActionsManager");

export class Server {

    private modules: IListeningModule[] = [];

    constructor(private connection: IServerConnection) {

        const editorManagerModule = EditorManagerModule.createManager(connection);
        this.modules.push(editorManagerModule);

        const astManagerModule = ASTManagerModule.createManager(connection,
            editorManagerModule);
        this.modules.push(astManagerModule);

        this.modules.push(ValidationManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.modules.push(StructureManagerModule.createManager(connection,
            astManagerModule));

        // this.modules.push(DetailsManagerModule.createManager(connection,
        //     astManagerModule, editorManagerModule));

        this.modules.push(CompletionManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.modules.push(FixedActionsManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.modules.push(CustomActionsManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));
    }

    public listen(): void {
        this.listenInternal();

        this.modules.forEach((module) => module.listen());
    }

    public listenInternal(): void {

    }

}
