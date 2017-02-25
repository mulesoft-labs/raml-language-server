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
    ILocation
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import search = rp.search;
import lowLevel=rp.ll;
import hl=rp.hl;
import utils = require("../../common/utils")

export interface IFixedActionsManagerModule {
    listen() : void;
}

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule) : IFixedActionsManagerModule {

    return new FixedActionsManager(connection, astManagerModule, editorManagerModule);
}

class FixedActionsManager {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
        private editorManagerModule: IEditorManagerModule) {
    }

    listen() {
        this.connection.onOpenDeclaration((uri:string,position:number)=>{
            return this.openDeclaration(uri, position);
        })
    }

    openDeclaration(uri:string,position:number): ILocation[] {

        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "openDeclaration");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "openDeclaration");

        if (utils.extName(uri) != '.raml') return [];

        let ast = this.astManagerModule.getCurrentAST(uri);

        this.connection.debugDetail("Found AST: " + (ast?"true":false),
            "FixedActionsManager", "openDeclaration");

        if (!ast) return [];

        let unit = ast.lowLevel().unit();

        var decl=search.findDeclaration(unit, position);

        this.connection.debugDetail("Found declaration: " + (decl?"true":false),
            "FixedActionsManager", "openDeclaration");

        if (!decl) return [];


        if(!(<any>decl).absolutePath){
            let location = this.openLowLevelNode(uri, (<hl.IParseResult>decl).lowLevel());
            if (!location) return [];

            return [location];
        } else {
            var absolutePath = (<lowLevel.ICompilationUnit>decl).absolutePath();

            if(utils.isHTTPUri(absolutePath)) {
                return [];
            }

            return [{
                uri: absolutePath,
                range: {
                    start: 0,
                    end: 0
                }
            }]
        }
    }

    private openLowLevelNode(originalUri: string, node:lowLevel.ILowLevelASTNode) : ILocation {
        this.connection.debugDetail("Opening low level node",
            "FixedActionsManager", "openLowLevelNode");

        let unitNodePath = node.unit().absolutePath();

        let editor = this.editorManagerModule.getEditor(unitNodePath);
        this.connection.debugDetail("Editor found: " + (editor?"true":"false"),
            "FixedActionsManager", "openLowLevelNode");

        let transformedPath = utils.transformUriToOriginalFormat(originalUri, unitNodePath)
        this.connection.debugDetail("Transformed path: " + transformedPath,
            "FixedActionsManager", "openLowLevelNode");

        if (!editor) {
            editor = this.editorManagerModule.getEditor(transformedPath);
        }
        this.connection.debugDetail("Editor found from transfromed path: " + (editor?"true":"false"),
            "FixedActionsManager", "openLowLevelNode");

        if (!editor) {
            return {
                uri: transformedPath,
                range: {
                    start: node.start(),
                    end: node.end()
                }
            }
        }

        this.connection.debugDetail("Initial declaration positions: [" + node.start() + ":" + node.end() + "]",
            "FixedActionsManager", "openLowLevelNode");

        let buffer = editor.getBuffer();
        this.connection.debugDetail("buffer found: " + (buffer?"true":"false"),
            "FixedActionsManager", "openLowLevelNode");

        var p1 = buffer.positionForCharacterIndex(node.start());
        this.connection.debugDetail("p1 found: " + (p1?"true":"false"),
            "FixedActionsManager", "openLowLevelNode");

        var p2 = buffer.positionForCharacterIndex(node.end());
        this.connection.debugDetail("p2 found: " + (p2?"true":"false"),
            "FixedActionsManager", "openLowLevelNode");

        p2.column = p1.column + node.key()?node.key().length:0;
        p2.row = p1.row;

        this.connection.debugDetail("Transformed p1: [" + p1.row + ":" + p1.column + "]",
            "FixedActionsManager", "openLowLevelNode");

        this.connection.debugDetail("Transformed p2: [" + p2.row + ":" + p2.column + "]",
            "FixedActionsManager", "openLowLevelNode");

        let resultStart = editor.getBuffer().characterIndexForPosition(p1);
        let resultEnd = editor.getBuffer().characterIndexForPosition(p2);

        this.connection.debugDetail("Transformed declaration positions: [" + resultStart + ":" + resultEnd + "]",
            "FixedActionsManager", "openLowLevelNode");

        return {
            uri: transformedPath,
            range: {
                start: resultStart,
                end: resultEnd
            }
        }
    };
}