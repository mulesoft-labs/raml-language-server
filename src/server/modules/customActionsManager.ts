//This module provides RAML module structure

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
    IValidationIssue,
    DetailsItemJSON,
    ILogger,
    IExecutableAction,
    IUIDisplayRequest,
    IChangedDocument
} from '../../common/typeInterfaces'

import {
    IListeningModule
} from './commonInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
import utils = rp.utils;
import ramlActions = require("raml-actions")

let universes=rp.universes;

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : IListeningModule {

    return new CustomActionsManager(connection, astManagerModule, editorManagerModule);
}

class EditorProvider implements ramlActions.IEditorProvider {

    constructor(private editorManagerModule: IEditorManagerModule,
        private uri: string){}

    getCurrentEditor() {
        return this.editorManagerModule.getEditor(this.uri);
    }
}

export function initialize() {

    // ramlActions.setASTProvider()
    // ramlActions.setASTModifier()
    // ramlActions.setExternalUIDisplayExecutor()
    // ramlActions.setDocumentChangeExecutor()
}

initialize();


class CustomActionsManager {

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
        private editorManager: IEditorManagerModule) {
    }

    listen() {
        this.connection.onCalculateEditorContextActions(
            (uri, position?)=>{
                return this.calculateEditorActions(uri, position);
            }
        )

        this.connection.onExecuteContextAction(
            (uri, actionId, position?)=>{
                return this.executeAction(uri, actionId, position)
            }
        )
    }

    vsCodeUriToParserUri(vsCodeUri : string) : string {
        if (vsCodeUri.indexOf("file://") == 0) {
            return vsCodeUri.substring(7);
        }

        return vsCodeUri;
    }

    private initializeActionsFramework(uri: string) {

        ramlActions.setEditorProvider(
            new EditorProvider(this.editorManager, uri));
    }

    calculateEditorActions(uri: string, position?: number):
        Promise<IExecutableAction[]> {

        this.connection.debug("Requested actions for uri " + uri
            + " and position " + position, "CustomActionsManager",
            "calculateEditorActions");

        return this.astManagerModule.forceGetCurrentAST(uri).then(ast=>{

            this.initializeActionsFramework(uri);

            return ramlActions.calculateCurrentActions("TARGET_RAML_EDITOR_NODE");
        })
    }

    executeAction(uri : string, actionId: string,
        position?: number): Promise<IChangedDocument[]> {

        this.connection.debug("Requested action execution for uri " + uri
            + " and position " + position + " and action" + actionId,
            "CustomActionsManager", "executeAction");

        return this.astManagerModule.forceGetCurrentAST(uri)
            .then(ast=>{

            this.initializeActionsFramework(uri);

            return ramlActions.executeAction(actionId);

        }).catch(error=>{
            throw error;
        })
    }
}