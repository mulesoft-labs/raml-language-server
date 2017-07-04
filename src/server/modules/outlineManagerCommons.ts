import ramlOutline =require('raml-outline')

import {
    IASTManagerModule
} from './astManager'

import {
    ILogger
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import hl=rp.hl;

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

/**
 * Initializes module.
 */
export function initialize() {

    ramlOutline.initialize();
    ramlOutline.setKeyProvider(<any>keyProvider);
}

initialize();

/**
 * AST provider for outline.
 */
class ASTProvider implements ramlOutline.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule,
                private logger: ILogger) {
    }

    getASTRoot() {
        this.logger.debug("Asked for AST", "ASTProvider", "getASTRoot")
        let ast = <any> this.astManagerModule.getCurrentAST(this.uri);

        this.logger.debugDetail("AST found: " + (ast?"true":"false"), "ASTProvider", "getASTRoot")

        return ast;
    }

    getSelectedNode() {
        return null;
    }
}

/**
 * Sets AST provider for outline
 * @param uri
 * @param astManagerModule
 * @param logger
 */
export function setOutlineASTProvider(uri: string, astManagerModule: IASTManagerModule, logger: ILogger) {
    ramlOutline.setASTProvider(new ASTProvider(uri, astManagerModule, logger));
}