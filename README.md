A Language Server that exposes smart [RAML](http://raml.org/) language support for various IDEs
using the new [Language Server Protocol standard] (https://github.com/Microsoft/language-server-protocol).

(Work in Progress)

# Architecture

This project exposes the [RAML 1.0 JS parser](https://github.com/raml-org/raml-js-parser-2)
as a [Language Server](https://github.com/Microsoft/language-server-protocol) using the [Node.js SDK](https://github.com/Microsoft/vscode-languageserver-node).

# Features

Most of the features available in the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) and [VSCode Extensions](https://code.visualstudio.com/docs/extensions/overview) have already been developed and battle tested in the [API Workbench](http://apiworkbench.com/) Atom Package. This includes advanced IDE features such as incremental compilation, project level symbol-table support and contextual completion support.

Even though there are some design and API level differences, porting the API Workbench functionality should be straightforward.
Here is an initial list of overlapping features between the API Workbench and VSCode/LSP (see [relevant protocol documentation](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#initialize-request)).


| VSCode/LSP Feature | Notes |
|--------------------|-------|
|Document Syncronization|Yes, API Workbench has full, optimized incremental parsing support|
|Hover Support|Yes|
|Completion Support| Yes, with additional information (resolveProvider=true)|
|Signature Help|Not relevant|
|Code Lens|?|
|Goto Definition|Yes|
|Find References|Yes|
|Document Formatting|Yes, but the approaches differ. This needs to be reviewed closely|
|Document Highlight|Yes|
|Document Level Symbols|Yes!|
|Workspace Level Symbols|Yes!|
|Code Actions|Multiple refactoring "commands" available|
|Rename|Yes. We have full support for renaming symbols, declarations and documents|

# FAQ
Q: Should the scope of this project be extended to developing both a Language Server and a VSCode Extension that uses it?
A: Most likely yes
