import URI = require("urijs")
import path = require("path")

/**
 * Returns path from uri. If URI string is not a well-formed URI, but just an FS path, returns that path.
 * @param uri
 */
export function pathFromURI(uri: string) {
    return (new URI(uri)).path()
}

/**
 * Returns whether URI has HTTP protocol.
 * If URI string is not a well-formed URI, but just an FS path, returns false
 * @param uri
 */
export function isHTTPUri(uri : string) {
    let protocol =  (new URI(uri)).protocol();
    return "http" == protocol || "HTTP" == protocol;
}

export function isFILEUri(uri : string) {
    let protocol =  (new URI(uri)).protocol();
    return "file" == protocol || "FILE" == protocol;
}

export function extName(uri : string) {
    return path.extname(pathFromURI(uri));
}

/**
 * If original format is well-formed FILE uri, and toTransform is simple path,
 * transforms toTransform to well-formed file uri
 * @param originalUri
 * @param toTransform
 */
export function transformUriToOriginalFormat(originalUri: string, toTransform: string) {
    if (isFILEUri(originalUri) && !isFILEUri(toTransform) && !isHTTPUri(toTransform)) {
        return (new URI(toTransform)).protocol("file").toString();
    }

    return toTransform;
}