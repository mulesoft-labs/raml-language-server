import {
    IServerConnection
} from "./connections";

import {
    IDisposableModule,
    isDisposableModule,
    IServerModule
} from "../modules/commonInterfaces";

import EditorManagerModule = require("../modules/editorManager");

import ASTManagerModule = require("../modules/astManager");

import ValidationManagerModule = require("../modules/validationManager");

import StructureManagerModule = require("../modules/structureManager");

import CompletionManagerModule = require("../modules/completionManager");

import FixedActionsManagerModule = require("../modules/fixedActionsManager");

import DetailsManagerModule = require("../modules/detailsManager");

import CustomActionsManagerModule = require("../modules/customActionsManager");
import {undefined} from "vscode-languageserver/lib/utils/is";

export class Server {

    /**
     * Map from module name to module.
     */
    private modules: {[moduleName: string]: IServerModule} = {};

    /**
     * Map from module name to its enablement state.
     */
    private modulesEnablementState: {[moduleName: string]: boolean} = {}

    constructor(private connection: IServerConnection) {

        const editorManagerModule = EditorManagerModule.createManager(connection);
        this.registerModule(editorManagerModule);

        const astManagerModule = ASTManagerModule.createManager(connection,
            editorManagerModule);
        this.registerModule(astManagerModule);

        this.registerModule(ValidationManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.registerModule(StructureManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.registerModule(DetailsManagerModule.createManager(connection,
            astManagerModule, editorManagerModule), false);

        this.registerModule(CompletionManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.registerModule(FixedActionsManagerModule.createManager(connection,
            astManagerModule, editorManagerModule));

        this.registerModule(CustomActionsManagerModule.createManager(connection,
            astManagerModule, editorManagerModule), false);
    }

    public registerModule(module: IServerModule, defaultEnablementState = true): void {
        const moduleName = module.getModuleName();

        if (!moduleName) {
            this.connection.error("No name for module!", "server", "registerModule");
        }

        this.modules[moduleName] = module;
        this.modulesEnablementState[moduleName] = defaultEnablementState;
    }

    public enableModule(moduleName: string): void {
        if (this.modulesEnablementState[moduleName]) {
            return;
        }

        const module = this.modules[moduleName];
        if (!module) {
            this.connection.error("Cant not enable unknown module " + moduleName,
                "server", "enableModule");
        }

        module.launch();
        this.modulesEnablementState[moduleName] = true;
    }

    public disableModule(moduleName: string): void {
        if (!this.modulesEnablementState[moduleName]) {
            return;
        }

        const module = this.modules[moduleName];
        if (!module) {
            this.connection.error("Cant not enable unknown module " + moduleName,
                "server", "disableModule");
        }

        if (isDisposableModule(module)) {
            module.dispose();
        } else {
            this.connection.warning("Attempt to disable non-disposable module " + moduleName,
                "server", "disableModule");
        }

        this.modulesEnablementState[moduleName] = true;
    }

    public listen(): void {

        this.connection.onSetServerConfiguration((configuration) => {
            if (!configuration.modulesConfiguration) {
                return;
            }

            if (configuration.modulesConfiguration.enableCustomActionsModule != null) {

                const customActionsModuleID = "CUSTOM_ACTIONS_MANAGER";

                this.connection.debug("Changing module enablement of " + customActionsModuleID +
                    " to " + configuration.modulesConfiguration.enableCustomActionsModule,
                    "server", "onSetServerConfiguration");

                this.enableModule(customActionsModuleID);

            }
            if (configuration.modulesConfiguration.enableDetailsModule != null) {

                const detailsModuleID = "DETAILS_MANAGER";

                this.connection.debug("Changing module enablement of " + detailsModuleID +
                    " to " + configuration.modulesConfiguration.enableDetailsModule,
                    "server", "onSetServerConfiguration");

                this.enableModule(detailsModuleID);

            }
        })

        for (const moduleName in this.modules) {
            if (this.modules.hasOwnProperty(moduleName)) {
                if (this.modulesEnablementState[moduleName]) {
                    this.modules[moduleName].launch();
                }
            }
        }
    }

}
