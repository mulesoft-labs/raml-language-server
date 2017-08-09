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

    ramlActions.intializeStandardActions();
}

class ASTProvider implements ramlActions.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule,
                private logger: ILogger, private position: number) {
    }

    getASTRoot() {

        let result =  <any> this.astManagerModule.getCurrentAST(this.uri);

        this.logger.debugDetail(
            "Got AST from AST provider: " + (result?"true":"false"),
            "CustomActionsManager", "ASTProvider#getASTRoot")

        return result;
    }

    getSelectedNode() {
        let root = this.getASTRoot();
        if (!root) return null;

        return root.findElementAtOffset(this.position);
    }

    /**
     * Gets current AST root asynchronously.
     * Can return null.
     */
    getASTRootAsync() {
        return Promise.resolve(this.getASTRoot())
    }

    /**
     * Gets current AST node asynchronously
     * Can return null.
     */
    getSelectedNodeAsync() {
        return Promise.resolve(this.getSelectedNode())
    }
}

class CollectingDocumentChangeExecutor implements ramlActions.IDocumentChangeExecutor {
    private changes: IChangedDocument[] = [];

    constructor(private logger: ILogger) {
    }

    changeDocument(change: IChangedDocument): Promise<void> {

        this.logger.debugDetail("Registering document change for document " + change.uri +
            ", text is:\n" + change.text,
            "CustomActionsManager", "CollectingDocumentChangeExecutor#changeDocument")

        this.changes.push(change);

        return Promise.resolve(null);
    }

    public getChanges() {
        return this.changes;
    }
}

class ASTModifier implements ramlActions.IASTModifier {

    constructor(private uri: string,
                private changeExecutor: CollectingDocumentChangeExecutor) {}

    deleteNode(node: hl.IParseResult) {

        var parent = node.parent();
        if (parent) {
            parent.remove(<any>node);
            parent.resetChildren();
        }
    }

    updateText(node: lowLevel.ILowLevelASTNode) {
        let newText = node.unit().contents();

        this.changeExecutor.changeDocument({
            uri: this.uri,
            text: newText,
        })
    }
}

initialize();


class CustomActionsManager {

    private changeExecutor = null;

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
        private editorManager: IEditorManagerModule) {

        this.changeExecutor = new CollectingDocumentChangeExecutor(connection);
    }

    listen() {
        this.connection.onCalculateEditorContextActions(
            (uri, position?)=>{
                return this.calculateEditorActions(uri, position);
            }
        )

        this.connection.onExecuteContextAction(
            (uri, actionId, position?)=>{
                this.connection.debug("onExecuteContextAction for uri " + uri,
                    "CustomActionsManager",
                    "calculateEditorActions");

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

    private initializeActionsFramework(uri: string, position: number) {

        ramlActions.setEditorProvider(
            new EditorProvider(this.editorManager, uri));

        ramlActions.setASTProvider(new ASTProvider(uri, this.astManagerModule,
            this.connection, position));

        this.changeExecutor = new CollectingDocumentChangeExecutor(this.connection);

        ramlActions.setASTModifier(new ASTModifier(uri, this.changeExecutor))

        ramlActions.setDocumentChangeExecutor(this.changeExecutor);

        this.editorManager.setDocumentChangeExecutor(this.changeExecutor);
    }

    calculateEditorActions(uri: string, position?: number):
        Promise<IExecutableAction[]> {

        this.connection.debug("Requested actions for uri " + uri
            + " and position " + position, "CustomActionsManager",
            "calculateEditorActions");

        if (!position) {
            position = this.editorManager.getEditor(uri).getCursorPosition();
        }

        let connection = this.connection;

        return this.astManagerModule.forceGetCurrentAST(uri).then(ast=>{

            this.initializeActionsFramework(uri, position);

            connection.debugDetail("Starting to calculate actions",
                "CustomActionsManager", "calculateEditorActions");

            let actions = ramlActions.calculateCurrentActions("TARGET_RAML_EDITOR_NODE");

            connection.debugDetail("Calculated actions: " + actions?actions.length.toString():"0",
                "CustomActionsManager", "calculateEditorActions");

            return actions.map(action=>{
                return {
                    id: action.id,

                    name : action.name,

                    target : action.target,

                    category : action.category,

                    label : action.label
                }
            })
        })
    }

    executeAction(uri : string, actionId: string,
        position?: number): Promise<IChangedDocument[]> {

        this.connection.debug("Requested action execution for uri " + uri
            + " and position " + position + " and action" + actionId,
            "CustomActionsManager", "executeAction");

        if (!position) {
            position = this.editorManager.getEditor(uri).getCursorPosition();
        }

        let connection = this.connection;

        let editorManager = this.editorManager;

        return this.astManagerModule.forceGetCurrentAST(uri)
            .then(ast=>{

            this.initializeActionsFramework(uri, position);

            ramlActions.setExternalUIDisplayExecutor(
                (externalDisplay: ramlActions.IExternalUIDisplay)=>{

                connection.debugDetail("Requested to display UI for action ID " + actionId,
                    "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");

                let action = ramlActions.findActionById(actionId);

                connection.debugDetail("Action found: " + action?"true":"false",
                    "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");

                return (initialUIState?: any)=>{

                    connection.debugDetail("Requested to display UI for action, git UI state",
                        "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");

                    let uiCode = externalDisplay.createUICode(initialUIState);

                    connection.debugDetail("UI code generated: " + uiCode?"true":"false",
                        "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");

                    connection.debugDetail("Requesting client for UI code display.",
                        "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");

                    return connection.displayActionUI({

                        action: action,

                        uiCode: uiCode,

                        initialUIState: initialUIState
                    }).then(finalUIState=>{
                        connection.debugDetail(
                            "Client answered with fina UI state for action " + actionId +
                            " , got final UI state: " + finalUIState?"true":"false",
                            "CustomActionsManager", "executeAction#setExternalUIDisplayExecutor");
                    })
                }

            })

            connection.debugDetail("Starting to execute action " + actionId,
                "CustomActionsManager", "executeAction");

            ramlActions.executeAction(actionId);

            connection.debugDetail("Finished to execute action " + actionId,
                "CustomActionsManager", "executeAction");

            editorManager.setDocumentChangeExecutor(null);

            let changes = this.changeExecutor.getChanges();

            connection.debugDetail("Collected changes: " + changes?changes.length.toString():"0",
                "CustomActionsManager", "executeAction");

            return changes;

        }).catch(error=>{
            editorManager.setDocumentChangeExecutor(null);
            throw error;
        })
    }
}