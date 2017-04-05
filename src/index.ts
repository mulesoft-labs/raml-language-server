import {
    IClientConnection
} from './client/client'

export {
    IClientConnection
} from './client/client'

export {
    IValidationReport,
    IOpenedDocument,
    IChangedDocument,
    StructureNodeJSON,
    Suggestion,
    StructureCategories,
    ITextEdit
} from './common/typeInterfaces'

import {
    getConnection
} from './entryPoints/node/launch'

/**
 * Launches node entry point (separate node server process) and returns client connection.
 * @return {IClientConnection}
 */
export function getNodeClientConnection() : IClientConnection {
    return getConnection();
}

export import textEditProcessor = require("./common/textEditProcessor")