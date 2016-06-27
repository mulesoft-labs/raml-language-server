# RAML Language Server (Work in Progress)

A Language Server that exposes smart [RAML](http://raml.org/) language support for various IDEs
using the new [Language Server Protocol standard] (https://github.com/Microsoft/language-server-protocol).

## Architecture

This project exposes the [RAML 1.0 JS parser](https://github.com/raml-org/raml-js-parser-2)
as a [Language Server](https://github.com/Microsoft/language-server-protocol) using the [Node.js SDK](https://github.com/Microsoft/vscode-languageserver-node).

![Architecture diagram](https://github.com/raml-org/raml-language-server/blob/documentation/images/arch.png)

## Features

Most of the features available in the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) and [VSCode Extensions](https://code.visualstudio.com/docs/extensions/overview) have already been developed and battle tested in the [API Workbench](http://apiworkbench.com/) Atom Package. This includes advanced IDE features such as incremental compilation, project level symbol-table support and contextual completion support.

We are currently working on extracting these features as stand-alone components that can be used to implement the LSP server.

## FAQ

**Q: Should the scope of this project be extended to developing a full-blown VSCode Extension?**

A: Most likely yes
