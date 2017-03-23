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
    IRange
} from '../../../common/typeInterfaces'

import rp=require("raml-1-parser")
import search = rp.search;
import lowLevel=rp.ll;
import hl=rp.hl;

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
        // this.connection.onRename((uri: string, position: number) => {
        //     return this.rename(uri, position);
        // })
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

}