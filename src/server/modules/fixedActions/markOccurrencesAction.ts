// This module provides a fixed action for finding occurrences of RAML node

import {
    IServerConnection
} from "../../core/connections";

import {
    IASTManagerModule
} from "../astManager";

import {
    IEditorManagerModule
} from "../editorManager";

import {
    ILocation,
    IRange
} from "../../../common/typeInterfaces";

import rp= require("raml-1-parser");
import search = rp.search;
import lowLevel= rp.ll;
import hl= rp.hl;

import {
    IDisposableModule
} from "../../modules/commonInterfaces";

import utils = require("../../../common/utils");
import fixedActionCommon = require("./fixedActionsCommon");
import openDeclarationsModule = require("./openDeclarationAction");

export function createManager(connection: IServerConnection,
                              astManagerModule: IASTManagerModule,
                              editorManagerModule: IEditorManagerModule)
                        : IDisposableModule {

    return new MarkOccurrencesActionModule(connection, astManagerModule, editorManagerModule);
}

class MarkOccurrencesActionModule implements IDisposableModule {

    private onMarkOccurrencesListener;

    constructor(private connection:IServerConnection, private astManagerModule:IASTManagerModule,
                private editorManagerModule:IEditorManagerModule) {
    }

    public launch() {

        this.onMarkOccurrencesListener = (uri:string, position:number) => {
            return this.markOccurrences(uri, position);
        }

        this.connection.onMarkOccurrences(this.onMarkOccurrencesListener);
    }

    public dispose():void {
        this.connection.onMarkOccurrences(this.onMarkOccurrencesListener, true);
    }

    /**
     * Returns unique module name.
     */
    public getModuleName():string {
        return "MARK_OCCURRENCES_ACTION";
    }

    public markOccurrences(uri:string, position:number):Promise<IRange[]> {
        this.connection.debug("Called for uri: " + uri,
            "FixedActionsManager", "markOccurrences");

        this.connection.debugDetail("Uri extname: " + utils.extName(uri),
            "FixedActionsManager", "markOccurrences");

        if (utils.extName(uri) !== ".raml") {
            return Promise.resolve([]);
        }

        return this.astManagerModule.forceGetCurrentAST(uri).then((ast) => {

            this.connection.debugDetail("Found AST: " + (ast ? "true" : false),
                "FixedActionsManager", "markOccurrences");

            if (!ast) {
                return [];
            }

            const unit = ast.lowLevel().unit();

            // TODO both search and declaration unit filtering is better to be moved directly to the search module
            // in order to save CPU by not checking external units and just be flagged here

            const node = ast.findElementAtOffset(position);
            if (!node) {
                return [];
            }

            // this.connection.debugDetail("Found node: \n" + node.printDetails(),
            //     "FixedActionsManager", "markOccurrences");

            var selectionValue: string = null;
            try {
                selectionValue = acceptNode(node, position, unit.contents());
            } catch(e) {
                this.connection.debugDetail("STAAAAACK: " + e.stack, "FixedActionsManager", "markOccurrences");
            }
            var selectionValue = acceptNode(node, position, unit.contents());

            if (!selectionValue) {
                this.connection.debugDetail("Filtering out node, returning",
                    "FixedActionsManager", "markOccurrences");

                this.connection.debugDetail("Node:\n" + node.printDetails(),
                    "FixedActionsManager", "markOccurrences");

                return [];
            }

            const findUsagesResult = search.findUsages(unit, position);

            this.connection.debugDetail("Found usages: " + (findUsagesResult ? "true" : false),
                "FixedActionsManager", "markOccurrences");

            let unfiltered:ILocation[] = [];

            if (findUsagesResult && findUsagesResult.results) {

                this.connection.debugDetail("Number of found usages: " + findUsagesResult.results.length,
                    "FixedActionsManager", "markOccurrences");

                unfiltered = unfiltered.concat(findUsagesResult.results.map((parseResult) => {
                    return fixedActionCommon.lowLevelNodeToLocation(uri, parseResult.lowLevel(),
                        this.editorManagerModule, this.connection, true);
                }));
            }

            const findUsagesLocations = unfiltered;

            return openDeclarationsModule.createManager(
                this.connection, this.astManagerModule, this.editorManagerModule
            ).openDeclaration(uri, position).then((declarations) => {

                this.connection.debugDetail("Number of found declarations: " + declarations.length,
                    "FixedActionsManager", "markOccurrences");

                let locations = findUsagesLocations;
                if (declarations) {
                    locations = locations.concat(declarations);
                }

                let result: IRange[] = [];

                this.connection.debugDetail("Unfiltered occurrences: " + JSON.stringify(locations),
                    "FixedActionsManager", "markOccurrences");

                result = locations.filter(location => {
                    return location.uri === uri;
                }).filter(location => {
                    // excluding any mentions of whatever is located at the position itself
                    // as its not what user is interested with
                    return location.range.start > position || location.range.end < position;
                }).map(location => {
                    return location.range;
                }).map(range => reduce(unit.contents(), selectionValue, range)).filter(range => range).filter(range => {
                    return range.start > position || range.end < position;
                });

                this.connection.debugDetail("Found occurrences result: " + JSON.stringify(result),
                    "FixedActionsManager", "markOccurrences");
                
                var filtered = [result[0]];
                
                result.forEach(range => {
                    for(var i = 0; i < filtered.length; i++) {
                        if(range.start === filtered[i].start && range.end === filtered[i].end) {
                            return;
                        }
                    }

                    filtered.push(range);
                });
                

                return filtered;
            });

        });

    }
}

function isLetter(value: string) {
    return /^[a-zA-Z0-9-]+$/.test(value);
}

function reduce(fullContent: string, selection: string, range: IRange): IRange {
    if(!fullContent || !fullContent.trim()) {
        return null;
    }

    if(!selection || !selection.trim()) {
        return null;
    }

    var actualIndex = fullContent.indexOf(selection, range.start);

    if(actualIndex < 0) {
        return null;
    }
    
    while(true) {
        var borders = fullContent.charAt(actualIndex - 1) + fullContent.charAt(actualIndex + selection.length);

        if(isLetter(borders.trim())) {
            actualIndex = fullContent.indexOf(selection, actualIndex + selection.length);

            if(actualIndex < 0) {
                return null;
            }
        } else {
            break;
        }
    }
    
    return {
        start: actualIndex,
        end: actualIndex + selection.length
    }
}

function findSelectionValues(node, name: string, position): string[] {
    var result = [];

    node.attributes(name).forEach(attr => {
        var toAdd = null;
        
        if(attr && attr.lowLevel() && attr.lowLevel().start() <= position && attr.lowLevel().end() >= position) {
            toAdd = attr.value && attr.value();
        }
        
        if(toAdd) {
            result.push(toAdd);
        }
    });
    
    if(node.attrValue(name)) {
        result.push(node.attrValue(name));
    }
    
    return handleStructuredValues(result);
}

function handleStructuredValues(values: any[]) {
    var result = [];

    values.forEach(value => {
        if(value.valueName) {
            result.push(value.valueName());
            
            result = result.concat(handleStructuredValues(value.children()));
            
            return;
        }

        result.push(value);
    })
    
    return result;
}

function isValidSelection(fullContent: string, selection: string, position: number): boolean {
    var startFrom = position - selection.length;

    startFrom = startFrom < 0 ? 0 : startFrom;
    
    var selectionStart = fullContent.indexOf(selection, startFrom);
    
    if(selectionStart < 0) {
        return false;
    }
    
    if(position < selectionStart) {
        return false;
    }
    
    if(position > selectionStart + selection.length + 1) {
        return false
    }
    
    return true;
}

function removeSquares(value: string): string {
    return value.split("(").join("").split(")").join("").trim();
}

function filterProposals(selections: string[]) {
    var result = [];

    selections.forEach(selection => {
        if(!selection) {
            return;
        }
        
        selection  = removeSquares(selection);

        if(selection.indexOf('|') > 0) {
            var unions = filterProposals(selection.split('|'));

            result = result.concat(unions);
            
            return;
        }

        var indexOfSquare = selection.indexOf("[");
        
        if(indexOfSquare > 0) {
            result.push(selection.substr(0, indexOfSquare));
        } else {
            result.push(selection);
        }
    })
    
    return result;
}

function findUnique(names: string[]) {
    var result = names[0];
    
    names.forEach(name => {
        if(name.length > result.length) {
            result = name;
        }
    })
    
    return result;
}

function findSelectionValue(node, name, position, content): string {
    var proposals = filterProposals(findSelectionValues(node, name, position)).map(proposal => proposal.trim());
    
    var valids = [];
    
    for(var i = 0; i < proposals.length; i++) {
        if(isValidSelection(content, proposals[i], position)) {
            valids.push(proposals[i]);
        }
    }
    
    if(valids.length === 0) {
        return null;
    }
    
    return findUnique(valids);
}

function acceptNode(node, position, content): string {
    var names = ["name", "type", "is", "securedBy", "schema"];

    for(var i = 0; i < names.length; i++) {
        var name = names[i];
        
        var selection = findSelectionValue(node, name, position, content);
        
        if(selection) {
            return selection;
        }
    }

    var parsedType = node.parsedType && node.parsedType();
    
    var customFacets = (parsedType.customFacets && parsedType.customFacets()) || [];

    for(var i = 0; i < customFacets.length; i++) {
        if(isValidSelection(content, customFacets[i].facetName(), position)) {
            return customFacets[i].facetName();
        }
    }
    
    return null;
}