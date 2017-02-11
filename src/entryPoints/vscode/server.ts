/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    IPCMessageReader, IPCMessageWriter,
    createConnection, IConnection, TextDocumentSyncKind,
    TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
    InitializeParams, InitializeResult, TextDocumentPositionParams,
    CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

import {
    ProxyServerConnection
} from './serverConnection'

import {
    Server
} from '../../server/core/server'

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
    workspaceRoot = params.rootPath;
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: TextDocumentSyncKind.Full,
            documentSymbolProvider: true,
            // Tell the client that the server support code complete
            completionProvider: {
                resolveProvider: false
            }
        }
    }
});

let proxyConnection = new ProxyServerConnection(connection);

let server = new Server(proxyConnection);

server.listen();
proxyConnection.listen();
connection.listen();

// The settings interface describe the server relevant settings part
interface Settings {
    languageServerExample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
    maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
// connection.onDidChangeConfiguration((change) => {
//     let settings = <Settings>change.settings;
//     maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
//     // Revalidate any open text documents
//     documents.all().forEach(validateTextDocument);
// });

// function validateTextDocument(textDocument: TextDocument): void {
//     let diagnostics: Diagnostic[] = [];
//     let lines = textDocument.getText().split(/\r?\n/g);
//     let problems = 0;
//     for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
//         let line = lines[i];
//         let index = line.indexOf('typescript');
//         if (index >= 0) {
//             problems++;
//             diagnostics.push({
//                 severity: DiagnosticSeverity.Warning,
//                 range: {
//                     start: { line: i, character: index},
//                     end: { line: i, character: index + 10 }
//                 },
//                 message: `${line.substr(index, 10)} should be spelled TypeScript111`,
//                 source: 'ex'
//             });
//         }
//     }
//     // Send the computed diagnostics to VSCode.
//     connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }

