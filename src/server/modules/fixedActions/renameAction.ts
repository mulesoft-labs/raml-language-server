//This module provides a fixed action for renaming RAML node

import {
    IServerConnection
} from '../../core/connections'

import {
    IASTManagerModule
} from '../astManager'

import {
    IEditorManagerModule
} from '../editorManager'

import {
    ILocation,
    IRange,
    IChangedDocument
} from '../../../common/typeInterfaces'

import parserApi=require("raml-1-parser")
import search = parserApi.search;
import lowLevel=parserApi.ll;
import hl=parserApi.hl;
import universes=parserApi.universes;
import def=parserApi.ds;
import stubs=parserApi.stubs;

import utils = require("../../../common/utils")
import fixedActionCommon = require("./fixedActionsCommon")

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule,
                              editorManagerModule: IEditorManagerModule)
                        : fixedActionCommon.IFixedActionsManagerSubModule {

    return new RenameActionModule(connection, astManagerModule, editorManagerModule);
}

class RenameActionModule implements fixedActionCommon.IFixedActionsManagerSubModule {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule,
                private editorManagerModule: IEditorManagerModule) {
    }

    listen() {
        this.connection.onRename((uri: string, position: number, newName: string) => {
            return this.rename(uri, position, newName);
        })
    }

    private rename(uri: string, position: number, newName: string) : IChangedDocument[] {
        this.connection.debug("Called for uri: " + uri,
            "RenameActionModule", "rename");


        var editor = this.editorManagerModule.getEditor(uri);
        this.connection.debugDetail("Got editor: " + (editor?"true":"false"),
            "RenameActionModule", "rename");

        if (!editor) return [];

        var node = this.getAstNode(uri, editor.getText(), position, false);

        this.connection.debugDetail("Got node: " + (node?"true":"false"),
            "RenameActionModule", "rename");

        if (!node) {
            return [];
        }

        var kind = search.determineCompletionKind(editor.getText(), position);

        this.connection.debugDetail("Determined completion kind: " + kind,
            "RenameActionModule", "rename");

        if (kind == search.LocationKind.VALUE_COMPLETION) {
            var hlnode = <hl.IHighLevelNode>node;

            var attr = null;
            for (let attribute of hlnode.attrs()) {
                if (attribute.lowLevel().start() < position
                    && attribute.lowLevel().end() >= position
                    && !attribute.property().getAdapter(def.RAMLPropertyService).isKey()) {

                    this.connection.debugDetail("Found attribute: " + attribute.name() +
                        " its key property is: " + attribute.property().getAdapter(def.RAMLPropertyService).isKey(),
                        "RenameActionModule", "rename");
                    attr = attribute;
                    break;
                }
            }

            this.connection.debugDetail("Found attribute: " + (attr?"true":"false"),
                "RenameActionModule", "rename");

            if (attr) {
                this.connection.debugDetail("Current attribute name is: " + attr.name(),
                    "RenameActionModule", "rename");

                this.connection.debugDetail("Current attribute value is: " + attr.value(),
                    "RenameActionModule", "rename");

                if (attr.value()) {
                    var p:hl.IProperty = attr.property();

                    var v = attr.value();
                    var targets = search.referenceTargets(p,hlnode);
                    var t:hl.IHighLevelNode = null;
                    for (let target of targets) {
                        if (target.name() == attr.value()) {
                            t = target;
                            break;
                        }
                    }

                    if (t) {
                        this.connection.debugDetail("Found target: " + t.printDetails(),
                            "RenameActionModule", "rename");

                        let findUsagesResult = search.findUsages(node.lowLevel().unit(), position);
                        if (findUsagesResult) {
                            let usages = findUsagesResult.results;

                            usages.reverse().forEach(usageAttribute=> {

                                this.connection.debugDetail("Renaming usage attribute: "
                                    + usageAttribute.name() + " of node:\n"
                                    + usageAttribute.parent().printDetails(),
                                    "RenameActionModule", "rename");

                                usageAttribute.asAttr().setValue(newName)
                            })

                            t.attr(
                                hlnode.definition().getAdapter(def.RAMLService).getKeyProp().nameId()
                            ).setValue(newName);

                            return [{
                                uri: uri,
                                text: hlnode.lowLevel().unit().contents()
                            }];
                        }
                    }
                }
            }
        }
        if (kind == search.LocationKind.KEY_COMPLETION || kind == search.LocationKind.SEQUENCE_KEY_COPLETION) {
            var hlnode = <hl.IHighLevelNode>node;

            let findUsagesResult = search.findUsages(node.lowLevel().unit(), position);
            if (findUsagesResult) {
                var oldValue = hlnode.attrValue(
                    hlnode.definition().getAdapter(def.RAMLService).getKeyProp().nameId())

                //todo update nodes
                findUsagesResult.results.reverse().forEach(x=> {
                    var ua = x;

                    this.renameInProperty(ua.asAttr(), oldValue, newName)
                })
                hlnode.attr(
                    hlnode.definition().getAdapter(def.RAMLService).getKeyProp().nameId()
                ).setValue(newName);

                return [{
                    uri: uri,
                    text: hlnode.lowLevel().unit().contents()
                }];
            }
        }

        return [];
    }

    private renameInProperty(property : hl.IAttribute, contentToReplace : string, replaceWith : string) {
        var oldPropertyValue = property.value();
        if (typeof oldPropertyValue == 'string') {

            var oldPropertyStringValue = <string> oldPropertyValue;

            var newPropertyStringValue = oldPropertyStringValue.replace(contentToReplace, replaceWith)
            property.setValue(newPropertyStringValue)
            if (oldPropertyStringValue.indexOf(contentToReplace) == -1) {
                if (property.name().indexOf(contentToReplace)!=-1){
                    var newValue = (<string>property.name()).replace(contentToReplace, replaceWith);
                    property.setKey(newValue);
                }
            }
            return;
        } else if (oldPropertyValue && (typeof oldPropertyValue ==="object")) {
            var structuredValue = <hl.IStructuredValue> oldPropertyValue;

            var oldPropertyStringValue = structuredValue.valueName();
            if (oldPropertyStringValue.indexOf(contentToReplace) != -1) {
                var convertedHighLevel = structuredValue.toHighLevel();

                if(convertedHighLevel) {
                    var found=false;
                    if (convertedHighLevel.definition().isAnnotationType()){
                        var prop=this.getKey((<def.AnnotationType>convertedHighLevel.definition()),structuredValue.lowLevel())
                        prop.setValue("("+replaceWith+")");
                        return;
                    }
                    convertedHighLevel.attrs().forEach(attribute => {
                        if(attribute.property().getAdapter(def.RAMLPropertyService).isKey()) {
                            var oldValue = attribute.value();
                            if (typeof oldValue == 'string') {
                                found=true;
                                var newValue = (<string>oldValue).replace(contentToReplace, replaceWith);
                                attribute.setValue(newValue);
                            }
                        }
                    })

                    return;
                }

            }
        }

        //default case
        property.setValue(replaceWith)
    }

    private getAstNode(uri: string, text : string, offset: number,
                       clearLastChar: boolean = true): parserApi.hl.IParseResult {
        let unitPath = utils.pathFromURI(uri);
        var newProjectId: string = utils.dirname(unitPath);

        var project = parserApi.project.createProject(newProjectId);

        var kind = search.determineCompletionKind(text, offset);

        if(kind === parserApi.search.LocationKind.KEY_COMPLETION && clearLastChar){
            text = text.substring(0, offset) + "k:" + text.substring(offset);
        }

        var unit = project.setCachedUnitContent(unitPath, text);

        var ast = <parserApi.hl.IHighLevelNode>unit.highLevel();

        var actualOffset = offset;

        for(var currentOffset = offset - 1; currentOffset >= 0; currentOffset--){
            var symbol = text[currentOffset];

            if(symbol === ' ' || symbol === '\t') {
                actualOffset = currentOffset - 1;

                continue;
            }

            break;
        }

        var astNode=ast.findElementAtOffset(actualOffset);

        if(astNode && search.isExampleNode(astNode)) {
            var exampleEnd = astNode.lowLevel().end();

            if(exampleEnd === actualOffset && text[exampleEnd] === '\n') {
                astNode = astNode.parent();
            }
        }

        return astNode;

        // let unitPath = utils.pathFromURI(uri);
        // var newProjectId: string = utils.dirname(unitPath);
        //
        // var project = parserApi.project.createProject(newProjectId);
        //
        // var kind = search.determineCompletionKind(text, offset);
        //
        // if(kind==search.LocationKind.KEY_COMPLETION&&clearLastChar){
        //     var pos=offset>0?offset-1:offset;
        //     for (var i=pos;i>0;i--){
        //         var c=text[i];
        //         if (c=='\r'||c=='\n'){
        //             break;
        //         }
        //         else{
        //             if (c==' '||c=='\t'){
        //                 ilevel++;
        //             }
        //         }
        //     }
        //     var oldOfffset=offset;
        //
        //     text=text.substring(0,oldOfffset)+"k:"+text.substring(oldOfffset);
        // }
        //
        // var ilevel=0;
        //
        // var unit = project.setCachedUnitContent(unitPath, text);
        //
        // var ast=unit.highLevel();
        // var cm=offset;
        // for (var pm=offset-1;pm>=0;pm--){
        //     var c=text[pm];
        //     if (c==' '||c=='\t'){
        //         cm=pm-1;
        //         continue;
        //     }
        //     break;
        // }
        // var astNode=ast.findElementAtOffset(cm);
        // this.connection.debugDetail("Found current ast node: " + astNode.printDetails(),
        //     "RenameActionModule", "getAstNode");
        //
        // if (astNode&&astNode.parent()==null){
        //     if (ilevel>0&&kind==search.LocationKind.KEY_COMPLETION) {
        //
        //         var attr=null;
        //         for (let currentAttribute of astNode.attrs()){
        //
        //             var at=<any>attr;
        //             if (at.lowLevel().start()<offset&&at.lowLevel().end()>=offset&&
        //                 !at.property().isKey()) {
        //
        //                 attr = currentAttribute;
        //                 break;
        //             }
        //         }
        //
        //         if (!attr) {
        //             return null;
        //         }
        //     }
        //     //check if we are on correct indentation level
        // }
        //
        // return astNode;
    }

    private getKey(t: def.AnnotationType,n:lowLevel.ILowLevelASTNode){
        var up=new def.UserDefinedProp("name", null);

        let ramlService : def.RAMLService = t.getAdapter(def.RAMLService)

        up.withRange(ramlService.universe().type(universes.Universe10.StringType.name));
        up.withFromParentKey(true);
        var node=ramlService.getDeclaringNode();
        //node:ll.ILowLevelASTNode, parent:hl.IHighLevelNode, private _def:hl.IValueTypeDefinition, private _prop:hl.IProperty, private fromKey:boolean = false
        return stubs.createASTPropImpl(n,node,up.range(),up,true);
        //rs.push(up);
    }

}