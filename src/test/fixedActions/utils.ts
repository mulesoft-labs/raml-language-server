import path = require("path");
import assert = require("assert");
import {
    parseFileSync,
    Marker, ParseResult
} from "./markerParser";

import {
    getNodeClientConnection,
    ILocation
} from "../../index";

export function testOpenDeclaration(testFileRelativePath: string, done: any, ):void{

    const fullFilePath = getOpenDeclarationFullPath(testFileRelativePath);

    const parseResult = parseFileSync(fullFilePath, [
        {
            markerSign: "\\*",
            typeName: "SOURCE"
        },
        {
            markerSign: "\\!",
            typeName: "TARGET"
        }
    ]);

    if (!parseResult) {
        done(new Error("Can not parse file " + fullFilePath));
        return;
    }

    callOpenDeclaration(fullFilePath, parseResult, (result, error) => {
        console.log("HERE111: " + JSON.stringify(result))
        if (error) {
            done(error);

            return;
        }

        try {
            assert(compareOpenDeclaration(fullFilePath, parseResult, result));
            done();
        } catch (exception) {
            done(exception);
        }
    });
}

function callOpenDeclaration(apiPath: string, parseResult: ParseResult,
                             callback: (result: ILocation[], error: any) => void): void {

    const content = parseResult.getStrippedText();

    const position = parseResult.getMarkerPosition("SOURCE");

    const connection = getNodeClientConnection();

    // connection.setLoggerConfiguration({
    //     allowedComponents: [
    //         "EditorManager",
    //         "ParseDocumentRunnable",
    //         "ASTManager",
    //         "FixedActionsManager",
    //         "MessageDispatcher:NodeProcessServerConnection"
    //     ],
    //     maxMessageLength: 5000
    // });

    connection.documentOpened({
        uri: apiPath,
        text: content
    });

    connection.documentChanged({
        uri: apiPath,
        text: content
    });

    connection.openDeclaration(apiPath, position).then((result) => {
        connection.documentClosed(apiPath);
        callback(result, null);
    }, (err) => {
        callback(null, err);
    });
}

function compareOpenDeclaration(apiPath: string, parseResult: ParseResult, locations: ILocation[]): boolean {
    const targetPosition = parseResult.getMarkerPosition("TARGET");
    if (!targetPosition) {

        console.log("Can not determine target position")
        return false;
    }

    const modifiedTargetPosition = targetPosition +
        parseResult.getStrippedText().length - parseResult.getOriginalText().length;

    if (!locations || locations.length !== 1) {

        console.log("Expected to have a single location")
        return false;
    }

    if (locations[0].range.start > modifiedTargetPosition
        || locations[0].range.end < modifiedTargetPosition) {

        console.log("Modified location of " + modifiedTargetPosition +
            " does not fit into the recieved range of [" + locations[0].range.start +
            ":" + locations[0].range.end + "]");

        return false;
    }

    return true;
}

function getOpenDeclarationFullPath(originalPath: string): string {
    return path.resolve(__dirname, "../../../src/test/data/fixedActions/openDeclaration"
        + originalPath).replace(/\\/g, "/");
}