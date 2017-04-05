import clientTypeInterfaces = require("../../client/typeInterfaces")
import commonTypeInterfaces = require("../../common/typeInterfaces")
import {
    applyDocumentEdits
} from '../../common/textEditProcessor'

export class VersionedDocument {

    constructor(private uri : string, private version : number, private text : string) {
        this.text = text;
    }

    /**
     * Gets document text
     * @returns {string}
     */
    getText() : string {
        return this.text;
    }

    /**
     * Gets document uri.
     */
    getUri() {
        return this.uri;
    }

    /**
     * Returns document version, if any.
     */
    getVersion() : number {
        return this.version;
    }
}

export class VersionedDocumentManager {

    /**
     * Stores a mapping from document uri to a sorted list of versioned documents.
     *
     * @type {{}}
     */
    private documents : {[uri:string] : VersionedDocument[]} = {};

    constructor(private maxStoredVersions=1){
    }

    /**
     * Gets latest version of the document by uri, or null if unknown
     * @param uri
     */
    public getLatestDocumentVersion(uri: string) : number {

        let latestDocument = this.getLatestDocument(uri);
        if (!latestDocument) return null;

        return latestDocument.getVersion();
    }

    public getLatestDocument(uri: string) : VersionedDocument {
        let versionedDocuments = this.documents[uri];

        if (!versionedDocuments) return null;

        return versionedDocuments[0];
    }

    /**
     * Registers opened client document. Returns null if such a document is already registered,
     * or the newly registered document in common format.
     * @param proposal
     */
    public registerOpenedDocument(proposal : clientTypeInterfaces.IOpenedDocument) :
        commonTypeInterfaces.IOpenedDocument {

        let versionedDocuments = this.documents[proposal.uri];

        if (versionedDocuments) {

            return {
                uri: proposal.uri,
                text: proposal.text,
                version: 0
            };

        } else {
            let newDocument = new VersionedDocument(proposal.uri, 0, proposal.text);
            this.documents[proposal.uri] = [newDocument];

            return {
                uri: proposal.uri,
                text: proposal.text,
                version: 0
            }
        }
    }

    /**
     * Registers changed client document. Returns null if such a document is already registered,
     * or the newly registered document in common format.
     * @param proposal
     */
    public registerChangedDocument(proposal : clientTypeInterfaces.IChangedDocument) :
        commonTypeInterfaces.IChangedDocument {
        let versionedDocuments = this.documents[proposal.uri];

        if (versionedDocuments) {

            if (proposal.text == null) return {
                uri: proposal.uri,
                text: proposal.text,
                version: 0
            };

            let latestDocument = versionedDocuments[0];
            let latestText = latestDocument.getText();

            let newText = proposal.text;
            if (newText == null && proposal.textEdits && latestText !== null) {
                newText = applyDocumentEdits(latestText, proposal.textEdits)
            }

            if (newText == null) return null;

            if (newText == latestText) return null;

            let newDocument = new VersionedDocument(proposal.uri,
                latestDocument.getVersion() + 1, newText);

            this.documents[proposal.uri] = [newDocument];

            return {
                uri: newDocument.getUri(),
                text: newDocument.getText(),
                version: newDocument.getVersion()
            }
        } else {

            let newDocument = new VersionedDocument(proposal.uri, 0, proposal.text);
            this.documents[proposal.uri] = [newDocument];

            return {
                uri: proposal.uri,
                text: proposal.text,
                version: 0
            }
        }
    }

    /**
     * Unregisters all document versions by uri.
     * @param uri
     */
    public unregisterDocument(uri: string) : void {
        delete this.documents[uri];
    }
}