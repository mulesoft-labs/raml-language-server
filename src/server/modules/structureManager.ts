import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

import {
    IValidationIssue,
    StructureNodeJSON,
    Icons,
    TextStyles,
    StructureCategories,
    ILogger
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
import utils = rp.utils;
import ramlOutline =require('raml-outline')
let universes=rp.universes;





export interface IStructureManagerModule {
    listen() : void;
}

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule) : IStructureManagerModule {

    return new StructureManager(connection, astManagerModule);
}



/**
 * Generates node key
 * @param node
 * @returns {any}
 */
export function keyProvider(node: hl.IParseResult) : string {
    if (!node) return null;
    if (node && !node.parent()) return node.name();
    else return node.name() + " :: " + keyProvider(node.parent());
}

var prohibit={
    resources:true,
    schemas:true,
    types:true,
    resourceTypes:true,
    traits:true
}

export function isResource(p: hl.IHighLevelNode) {
    return (p.definition().key()===universes.Universe08.Resource||p.definition().key()===universes.Universe10.Resource);
}

export function isOther(p: hl.IHighLevelNode) {
    if (p.property()){
        var nm=p.property().nameId();
        if (prohibit[nm]){
            return false;
        }
    }
    return true;
}
export function isResourceTypeOrTrait(p: hl.IHighLevelNode) {
    var pc=p.definition().key();

    return (pc ===universes.Universe08.ResourceType
    ||pc===universes.Universe10.ResourceType||
    pc === universes.Universe08.Trait
    ||
    pc===universes.Universe10.Trait);
}

export function isSchemaOrType(p: hl.IHighLevelNode) {

    if (p.parent() && p.parent().parent() == null) {
        var property = p.property();

        return property.nameId() == universes.Universe10.LibraryBase.properties.types.name ||
            property.nameId() == universes.Universe10.LibraryBase.properties.schemas.name ||
            property.nameId() == universes.Universe08.Api.properties.schemas.name;
    }

    return false;
}


function createCategories() : void {
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.ResourcesCategory], <any>isResource);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.SchemasAndTypesCategory], <any>isSchemaOrType);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.ResourceTypesAndTraitsCategory], <any>isResourceTypeOrTrait);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.OtherCategory], <any>isOther);
}

function createDecorations() : void {
    ramlOutline.addDecoration(ramlOutline.NodeType.ATTRIBUTE, {
        icon: Icons[Icons.ARROW_SMALL_LEFT],
        textStyle: TextStyles[TextStyles.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.RESOURCE, {
        icon: Icons[Icons.PRIMITIVE_SQUARE],
        textStyle: TextStyles[TextStyles.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.METHOD, {
        icon: Icons[Icons.PRIMITIVE_DOT],
        textStyle: TextStyles[TextStyles.WARNING]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.SECURITY_SCHEME, {
        icon: Icons[Icons.FILE_SUBMODULE],
        textStyle: TextStyles[TextStyles.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.ANNOTATION_DECLARATION, {
        icon: Icons[Icons.TAG],
        textStyle: TextStyles[TextStyles.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.TYPE_DECLARATION, {
        icon: Icons[Icons.FILE_BINARY],
        textStyle: TextStyles[TextStyles.SUCCESS]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.DOCUMENTATION_ITEM, {
        icon: Icons[Icons.BOOK],
        textStyle: TextStyles[TextStyles.NORMAL]
    });
}

export function initialize() {

    ramlOutline.initialize();
    ramlOutline.setKeyProvider(<any>keyProvider);

    createCategories();

    createDecorations();
}

initialize();

class ASTProvider implements ramlOutline.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule,
        private logger: ILogger) {
    }

    getASTRoot() {
        this.logger.debug("Asked for AST", "ASTProvider", "getASTRoot")
        let ast = <any> this.astManagerModule.forceGetCurrentAST(this.uri);

        this.logger.debugDetail("AST found: " + (ast?"true":"false"), "ASTProvider", "getASTRoot")

        return ast;
    }

    getSelectedNode() {
        return this.getASTRoot();
    }
}

class StructureManager {

    private calculatingStructureOnDirectRequest = false;

    private cachedStructures: {[uri:string] : {[categoryName:string] : StructureNodeJSON}} = {};

    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule) {
    }

    listen() {
        this.connection.onDocumentStructure(uri=>{
            return this.getStructure(uri);
        })

        this.astManagerModule.onNewASTAvailable((uri, ast)=>{

            //we do not want reporting while performing the calculation
            if (this.calculatingStructureOnDirectRequest) return;

            this.connection.debug("Calculating structure due to new AST available", "StructureManager",
                "listen");

            let structureForUri = this.calculateStructure(uri);

            this.connection.debug("Calculation result is not null:" + (structureForUri!=null?"true":"false"), "StructureManager",
                "listen");

            if (structureForUri) {
                this.cachedStructures[uri] = structureForUri;

                this.connection.structureAvailable({
                    uri: uri,
                    structure: structureForUri
                })
            }
        })

        this.connection.onCloseDocument(uri=>delete this.cachedStructures[uri]);
    }

    vsCodeUriToParserUri(vsCodeUri : string) : string {
        if (vsCodeUri.indexOf("file://") == 0) {
            return vsCodeUri.substring(7);
        }

        return vsCodeUri;
    }

    getStructure(uri : string): {[categoryName:string] : StructureNodeJSON} {
        try {
            this.calculatingStructureOnDirectRequest = true;

            this.connection.debug("Requested structure for uri " + uri, "StructureManager",
                "getStructure");

            let cached = this.cachedStructures[uri];

            this.connection.debug("Found cached structure: " + (cached ? "true" : "false"), "StructureManager",
                "getStructure");

            if (cached) return cached;

            this.connection.debug("Calculating structure due to getStructure request and no cached version found", "StructureManager",
                "getStructure");

            let calculated = this.calculateStructure(uri);
            this.connection.debug("Calculation result is not null:" + (calculated != null ? "true" : "false"), "StructureManager",
                "getStructure");

            this.cachedStructures[uri] = calculated;

            return calculated;

        } finally {
            this.calculatingStructureOnDirectRequest = false;
        }
    }

    calculateStructure(uri : string): {[categoryName:string] : StructureNodeJSON} {

        this.connection.debug("Called for uri: " + uri,
            "StructureManager", "calculateStructure");

        ramlOutline.setASTProvider(new ASTProvider(uri, this.astManagerModule, this.connection));

        let result = ramlOutline.getStructureForAllCategories();

        if (result) {
            for (let categoryName in result) {
                let categoryJSON = result[categoryName];
                if (categoryJSON) {
                    this.connection.debugDetail("Structure for category " + categoryName +"\n"
                        + JSON.stringify(categoryJSON, null, 2), "StructureManager", "calculateStructure")
                }
            }
        }

        this.connection.debug("Calculation result is not null:" + (result!=null?"true":"false"), "StructureManager",
            "calculateStructure");

        return result;
    }
}