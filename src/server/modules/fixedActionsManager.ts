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

        this.connection.onFindReferences((uri:string,position:number)=>{
            return this.findReferences(uri, position);
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
            let location = this.lowLevelNodeToLocation(uri, (<hl.IParseResult>decl).lowLevel());
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

    private lowLevelNodeToLocation(originalUri: string, node:lowLevel.ILowLevelASTNode,
        completeReference=false) : ILocation {
        this.connection.debugDetail("Converting low level node to location",
            "FixedActionsManager", "lowLevelNodeToLocation");

        let unitNodePath = node.unit().absolutePath();

        let editor = this.editorManagerModule.getEditor(unitNodePath);
        this.connection.debugDetail("Editor found: " + (editor?"true":"false"),
            "FixedActionsManager", "lowLevelNodeToLocation");

        let transformedPath = utils.transformUriToOriginalFormat(originalUri, unitNodePath)
        this.connection.debugDetail("Transformed path: " + transformedPath,
            "FixedActionsManager", "lowLevelNodeToLocation");

        if (!editor) {
            editor = this.editorManagerModule.getEditor(transformedPath);
        }
        this.connection.debugDetail("Editor found from transfromed path: " + (editor?"true":"false"),
            "FixedActionsManager", "lowLevelNodeToLocation");

        if (!editor || completeReference) {
            return {
                uri: transformedPath,
                range: {
                    start: node.start(),
                    end: node.end()
                }
            }
        }

        this.connection.debugDetail("Initial declaration positions: [" + node.start() + ":" + node.end() + "]",
            "FixedActionsManager", "lowLevelNodeToLocation");

        let buffer = editor.getBuffer();
        this.connection.debugDetail("buffer found: " + (buffer?"true":"false"),
            "FixedActionsManager", "lowLevelNodeToLocation");

        var p1 = buffer.positionForCharacterIndex(node.start());
        this.connection.debugDetail("p1 found: " + (p1?"true":"false"),
            "FixedActionsManager", "lowLevelNodeToLocation");

        var p2 = buffer.positionForCharacterIndex(node.end());
        this.connection.debugDetail("p2 found: " + (p2?"true":"false"),
            "FixedActionsManager", "lowLevelNodeToLocation");

        p2.column = p1.column + node.key()?node.key().length:0;
        p2.row = p1.row;

        this.connection.debugDetail("Transformed p1: [" + p1.row + ":" + p1.column + "]",
            "FixedActionsManager", "lowLevelNodeToLocation");

        this.connection.debugDetail("Transformed p2: [" + p2.row + ":" + p2.column + "]",
            "FixedActionsManager", "lowLevelNodeToLocation");

        let resultStart = editor.getBuffer().characterIndexForPosition(p1);
        let resultEnd = editor.getBuffer().characterIndexForPosition(p2);

        this.connection.debugDetail("Transformed declaration positions: [" + resultStart + ":" + resultEnd + "]",
            "FixedActionsManager", "lowLevelNodeToLocation");

        return {
            uri: transformedPath,
            range: {
                start: resultStart,
                end: resultEnd
            }
        }
    }

    // private renameRAMLElement() {
    //     var ed = getActiveEditor();
    //     var quickFixes:QuickFix[] = [];
    //     if (ed) {
    //         if (path.extname(ed.getPath()) == '.raml') {
    //             var request = {editor: ed, bufferPosition: ed.getCursorBufferPosition()};
    //             var node = provider.getAstNode(request, false);
    //             if (!node) {
    //                 return;
    //             }
    //             var offset = request.editor.getBuffer().characterIndexForPosition(request.bufferPosition);
    //             var kind = search.determineCompletionKind(ed.getBuffer().getText(), offset);
    //             if (kind == search.LocationKind.VALUE_COMPLETION) {
    //                 var hlnode = <hl.IHighLevelNode>node;
    //
    //                 var attr = _.find(hlnode.attrs(), x=>x.lowLevel().start() < offset && x.lowLevel().end() >= offset && !x.property().getAdapter(services.RAMLPropertyService).isKey());
    //                 if (attr) {
    //                     if (attr.value()) {
    //                         var p:hl.IProperty = attr.property();
    //                         //FIXME INFRASTRUCTURE NEEDED
    //                         var v = attr.value();
    //                         var targets = search.referenceTargets(p,hlnode);
    //                         var t:hl.IHighLevelNode = _.find(targets, x=>x.name() == attr.value())
    //                         if (t) {
    //                             UI.prompt("New name for " + attr.value(), newVal=> {
    //                                 findUsagesImpl((n, r)=> {
    //                                     //todo update nodes
    //                                     r.reverse().forEach(x=> {
    //                                         var ua = x;
    //                                         ua.asAttr().setValue(newVal)
    //                                     })
    //                                     n.attr(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId()).setValue(newVal);
    //                                     var ed = getActiveEditor();
    //                                     ed.getBuffer().setText(n.lowLevel().unit().contents());
    //
    //                                 })
    //                             }, attr.value());
    //                         }
    //                     }
    //                     //console.log(attr.value());
    //                 }
    //             }
    //             if (kind == search.LocationKind.KEY_COMPLETION || kind == search.LocationKind.SEQUENCE_KEY_COPLETION) {
    //                 var hlnode = <hl.IHighLevelNode>node;
    //
    //                         UI.prompt("New name for " + hlnode.name(), newVal=> {
    //                             findUsagesImpl((n, r)=> {
    //                                 var oldValue = n.attrValue(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId())
    //
    //                                 //todo update nodes
    //                                 r.reverse().forEach(x=> {
    //                                     var ua = x;
    //
    //                                     renameInProperty(ua.asAttr(), oldValue, newVal)
    //                                 })
    //                                 n.attr(n.definition().getAdapter(services.RAMLService).getKeyProp().nameId()).setValue(newVal);
    //                                 var ed = getActiveEditor();
    //                                 ed.getBuffer().setText(n.lowLevel().unit().contents());
    //
    //                             })
    //                         }, hlnode.name());
    //             }
    //         }
    //     }
    // }
    //
    // private renameInProperty(property : hl.IAttribute, contentToReplace : string, replaceWith : string) {
    //     var oldPropertyValue = property.value();
    //     if (typeof oldPropertyValue == 'string') {
    //
    //         var oldPropertyStringValue = <string> oldPropertyValue;
    //
    //         var newPropertyStringValue = oldPropertyStringValue.replace(contentToReplace, replaceWith)
    //         property.setValue(newPropertyStringValue)
    //         if (oldPropertyStringValue.indexOf(contentToReplace) == -1) {
    //             if (property.name().indexOf(contentToReplace)!=-1){
    //                 var newValue = (<string>property.name()).replace(contentToReplace, replaceWith);
    //                 property.setKey(newValue);
    //             }
    //         }
    //         return;
    //     } else if (oldPropertyValue && (typeof oldPropertyValue ==="object")) {
    //         var structuredValue = <hl.IStructuredValue> oldPropertyValue;
    //
    //         var oldPropertyStringValue = structuredValue.valueName();
    //         if (oldPropertyStringValue.indexOf(contentToReplace) != -1) {
    //             var convertedHighLevel = structuredValue.toHighLevel();
    //
    //             if(convertedHighLevel) {
    //                 var found=false;
    //                 if (convertedHighLevel.definition().isAnnotationType()){
    //                     var prop=this.getKey((<def.AnnotationType>convertedHighLevel.definition()),structuredValue.lowLevel())
    //                     prop.setValue("("+replaceWith+")");
    //                     return;
    //                 }
    //                 convertedHighLevel.attrs().forEach(attribute => {
    //                     if(attribute.property().getAdapter(services.RAMLPropertyService).isKey()) {
    //                         var oldValue = attribute.value();
    //                         if (typeof oldValue == 'string') {
    //                             found=true;
    //                             var newValue = (<string>oldValue).replace(contentToReplace, replaceWith);
    //                             attribute.setValue(newValue);
    //                         }
    //                     }
    //                 })
    //
    //                 return;
    //             }
    //             //var lowLevelNode = structuredValue.lowLevel();
    //             //if ((<any>lowLevelNode).yamlNode) {
    //             //    var yamlNode : yaml.YAMLNode = (<any>lowLevelNode).yamlNode();
    //             //    if(yamlNode.kind == yaml.Kind.MAPPING) {
    //             //        var key = (<yaml.YAMLMapping>yamlNode).key
    //             //        if (key && key.value && key.value.indexOf(contentToReplace) != -1){
    //             //            oldPropertyStringValue = key.value
    //             //            var newStringValue = oldPropertyStringValue.replace(contentToReplace, replaceWith);
    //             //            key.value = newStringValue;
    //             //            return;
    //             //        }
    //             //    }
    //             //}
    //
    //
    //         }
    //     }
    //
    //     //default case
    //     property.setValue(replaceWith)
    // }
    //
    // private getKey(t: def.AnnotationType,n:lowLevel.ILowLevelASTNode){
    //     var up=new def.UserDefinedProp("name", null);
    //     //up.withDomain(this);
    //     up.withRange(this.universe().type(universes.Universe10.StringType.name));
    //     up.withFromParentKey(true);
    //     var node=t.getAdapter(services.RAMLService).getDeclaringNode();
    //     //node:ll.ILowLevelASTNode, parent:hl.IHighLevelNode, private _def:hl.IValueTypeDefinition, private _prop:hl.IProperty, private fromKey:boolean = false
    //     return stubs.createASTPropImpl(n,node,up.range(),up,true);
    //     //rs.push(up);
    // }

    findReferences(uri:string,position:number): ILocation[] {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "findReferences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "findReferences");

        if (utils.extName(uri) != '.raml') return [];

        let ast = this.astManagerModule.getCurrentAST(uri);

        this.connection.debugDetail("Found AST: " + (ast?"true":false),
            "FixedActionsManager", "findReferences");

        if (!ast) return [];

        let unit = ast.lowLevel().unit();

        var findUsagesResult = search.findUsages(unit, position);

        this.connection.debugDetail("Found usages: " + (findUsagesResult?"true":false),
            "FixedActionsManager", "findReferences");

        if (!findUsagesResult || !findUsagesResult.results) return [];
        this.connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
            "FixedActionsManager", "findReferences");

        return findUsagesResult.results.map(parseResult=>{
            return this.lowLevelNodeToLocation(uri, parseResult.lowLevel(), true)
        })
    }
}