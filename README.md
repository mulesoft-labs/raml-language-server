# RAML Language Server

A Language Server that exposes smart [RAML](http://raml.org/) language support for various IDEs
using the new [Language Server Protocol standard](https://github.com/Microsoft/language-server-protocol).

## Status

Currently, the RAML Language Server is in beta. 

## Architecture

This project exposes not only the [RAML JS parser](https://github.com/raml-org/raml-js-parser-2) but also functionalities that are currently part of the [API Workbench](http://apiworkbench.com/) Atom package as a [Language Server](https://github.com/Microsoft/language-server-protocol).

RAML Server joins all the services and provides them as an interface with maximum simplicity. No RAML parser AST goes out from the LSP server. The LSP server has the full control of when and how RAML is parsed. The clients should not care about these details.

The supported clients are divided into the following types based on the way the client launches the server and the environment in which the server is executed. We add supporting code for each type of launch/environment that handles only the details of launch/transport. No business logic for handling RAML is included.

**Node-based** 

This type of launch expects the client and the server to be running in node.js. An example is the API Workbench.

**Web worker-based** 

This type of launch expects the client to be running in the browser, and the server to be running in web worker. An example might be any web editor.

**MS LSP** 

This type of launch expects the client to be running in an unknown environment, which supports MS LSP, and the server to be running in node.js. Consequently, it is possible to support many current IDEs. Note: each additional LSP client requires its own code, but that code is thin.

![Modules](images/Modules.png)

No client module directly depends on the service modules or parser modules. The only point of connection for the clients is the server itself.

The server module contains the following major parts:

* Server connection and server modules - this part is pure business logic, which either contains a direct implementation of RAML-related functionality or a communicator to the related RAML service module.
* An implementation of three types of launching, for each type of the client this server supports. Clients should not implement their own code for launching external node processes, for example. It should be easy to launch the server.
* An implementation of the protocol for the client to communicate to the server. Each protocol implementation contains two parts: a client interface and a mechanism to transfer client interface calls/messages to the server and back. In case the MS LSP client interface is not needed, initially and until we exceed current LSP support, we assume clients already support protocol features that we support at the server part.

## Features and modules

Most of the features available in the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) and [VSCode Extensions](https://code.visualstudio.com/docs/extensions/overview) have already been developed and battle-tested in the [API Workbench](http://apiworkbench.com/) Atom package.

We are currently working on extracting these features as stand-alone components that can be used to implement the LSP server.

There are a number of server modules, each providing a feature and, supposedly, binding on one or more client connection methods.

The current list of modules, which is going to expand is:
* Editor Manager - handles RAML documents, their contents, conversion of absolute positions to lines and columns etc.
* AST Manager - provides AST data to other modules, both on-demand and notification-based.
* Validation Manager - handles RAML validation reports.
* Structure Manager - handles RAML structure requests.
* Completion Manager - handles RAML suggestions.
* Fixed Actions Manager - central point to register fixed actions sub-modules.
    * Find References Action - provides the respective fixed action.
    * Open Declaration Action - provides the respective fixed action.
    * Mark Occurrences Action - provides the respective fixed action.
    * Rename Action - provides the respective fixed action.

Modules are located in `src/server/modules` folder and its subfolders.

## Code highlights

### Node-based client

An interface for this client is custom and simple. It contains a single method per major functionality feature.

For example, a client can notify the server that a document was opened by calling a method:
```js
/**
 * Notifies the server that document is opened.
 * @param document
 */
documentOpened(document: IOpenedDocument);
```
Where `IOpenedDocument` has only two fields: document URI and document text.

A client can get notified about new validation reports from the server by adding a listener:

```js
/**
 * Adds a listener for validation report coming from the server.
 * @param listener
 */
onValidationReport(listener : (report:IValidationReport)=>void);
```

A client can find references by calling:

```js
/**
 * Requests server for the positions of the references of the element defined
 * at the given document position.
 * @param uri - document uri
 * @param position - position in the document
 */
findReferences(uri: string, position: number) : Promise<ILocation[]>
```

It is possible that future development might include the addition of new fields to some data interfaces, but the simplicity should be preserved.

Note the an emitter of an event can be both client and server. For example, the client does not ask server for a validation report, instead the server notifies the client that the new report is ready when the server has time to parse RAML and collection validation data. The server decides when and how to parse RAML and update IDE-related data. The client can either subscribe to events, or ask for immediate/fast (but potentially outdated) results stored at the server.

The server implements node-based launching, a transport that transfers client/server calls via node messages and provides a single simple method, which launches the server and returns an instance of a client connection.

In the current implementation prototype, the client interface is located in `src/client/client.ts` file `IClientConnection` interface, the launching interface is located in `src/index.ts` `getNodeClientConnection()` method, and the launching implementation is located in `src/entryPoints/node` folder.

### Web worker-based client

This type of client uses the same client interface as node-based client for unification.

Launching should handle web-worker related functionality and contain a simple method to launch the worker and return the client connection. All transport should be handled by this type of launching and hidden from the client.

This is also the place where the “universal” server data-like structure is converted to this particular client’s terms like outline if needed.

This client will be located in `src/entryPoints/web` when it is implemented.

### MS LSP client

This type of client has no client interface because this is something handled by the standard LSP clients, at least until we decide to extend what MS LSP currently provides.

Launching is represented by the proper LSP config, assumiing the client simply adds raml-language-client to the dependencies list and refers to it as a server module. For non-node clients, launching can be more difficult.

Communication is handled by the server part by converting MS LSP server calls/data to/from server interface calls/data. This is also the place where the “universal” server data-like structure is converted to this particular client’s terms like symbols if needed.

In the current implementation prototype, the launching implementation is located in `src/entryPoints/vscode` folder.

### Server interface

The server interface is represented by the server connection. The server business logic communicates with the server interface to provide its functionality to the clients. It resembles the client interface for node-based clients, as shown in the following examples.

Getting knowledge about the document being opened:

```js
/**
 * Adds a listener to document open notification. Must notify listeners in order of registration.
 * @param listener
 */
onOpenDocument(listener: (document: IOpenedDocument)=>void);
```

Notifying the client about a new validation report:

```js
/**
 * Reports latest validation results
 * @param report
 */
validated(report:IValidationReport) : void;
```

Finding the references by the client request and letting the client know the results:

```js
/**
 * Adds a listener to document find references request.  Must notify listeners in order of registration.
 * @param listener
 */
onFindReferences(listener: (uri: string, position: number) => ILocation[])
```

In the current implementation prototype, the server interface is located in `src/server/core/connections.ts`. The file `IServerConnection` interface, implementation is located in `src/server/core` folder.

## Contribution

If you are interested in contributing some code to this project, thanks! Please first [read and accept the Contributors Agreement](https://api-notebook.anypoint.mulesoft.com/notebooks#bc1cf75a0284268407e4).

To discuss this project, please use its [github issues](https://github.com/raml-org/raml-js-parser-2/issues) or the [RAML forum](http://forums.raml.org/).
