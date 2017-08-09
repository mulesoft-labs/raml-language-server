//This module handles contents of editors opened in IDE and provides this information to other modules

import {
    IServerConnection
} from '../core/connections'

import {
    IOpenedDocument,
    IChangedDocument,
    IDocumentChangeExecutor,
    ILogger
} from '../../common/typeInterfaces'

import {
    IAbstractTextEditor,
    IAbstractTextEditorWithCursor,
    IEditorTextBuffer,
    IPoint,
    IRange,
    IListeningModule
} from './commonInterfaces'

export interface IEditorManagerModule extends IListeningModule {
    listen() : void;
    getEditor(uri : string) : IAbstractTextEditorWithCursor;
    onChangeDocument(listener: (document : IChangedDocument)=>void);

    /**
     * Sets document change executor to use when editor buffer text modification
     * methods are being called.
     * @param executor
     */
    setDocumentChangeExecutor(executor : IDocumentChangeExecutor) : void;
}

export function createManager(connection : IServerConnection) : IEditorManagerModule {
    return new EditorManager(connection);
}

class TextBufferInfo implements IEditorTextBuffer {
    //TODO add border checks

    private text = "";
    private lineLengths: number[];

    constructor(private uri: string, private editorManager : EditorManager,
        private logger : ILogger) {
    }

    /**
     * Gets offset from the beginning of the document by the position
     * @param position
     */
    characterIndexForPosition(position:IPoint):number {
        let lineStartOffset = 0;

        for (let i = 0; i <= position.row - 1; i++) {
            lineStartOffset += this.lineLengths[i];
        }

        return lineStartOffset + position.column;
    }



    /**
     * Gets position by the offset from the beginning of the document.
     * @param offset
     */
    positionForCharacterIndex(offset:number):IPoint {
        var pos = offset;

        for(var i = 0 ; i < this.lineLengths.length; i++){
            var lineLength = this.lineLengths[i];
            if(pos < lineLength){
                return {
                    row: i,
                    column: pos
                }
            }
            pos -= lineLength;
        }
        if(pos==0){
            return {
                row: this.lineLengths.length-1,
                column: this.lineLengths[this.lineLengths.length-1]
            }
        }

        throw new Error(`Character position exceeds text length: ${offset} > + ${this.text.length}`);
    }

    /**
     * Gets a range for the row number.
     * @param row - row number
     * @param includeNewline - whether to include new line character(s).
     */
    rangeForRow(row:number, includeNewline?:boolean):IRange {
        let lineStartOffset = 0;

        for (let i = 0; i < row - 1; i++) {
            lineStartOffset += this.lineLengths[i];
        }

        let lineLength = this.lineLengths[row];

        let startPoint = {
            row : row,
            column : lineStartOffset
        }

        let endPoint = {
            row : row,
            column : lineStartOffset + lineLength
        }

        return {
            start: startPoint,
            end: endPoint
        }
    }

    /**
     * Gets text in range.
     * @param range
     */
    getTextInRange(range:IRange):string {
        let startOffset = this.characterIndexForPosition(range.start);
        let endOffset = this.characterIndexForPosition(range.end);

        return this.text.substring(startOffset, endOffset);
    }

    /**
     * Sets (replacing if needed) text in range
     * @param range - text range
     * @param text - text to set
     * @param normalizeLineEndings - whether to convert line endings to the ones standard for this document.
     */
    setTextInRange(range:IRange, text:string, normalizeLineEndings?:boolean):IRange {
        let startOffset = range?this.characterIndexForPosition(range.start) : 0;
        let endOffset = range?this.characterIndexForPosition(range.end):text.length;

        let startText = startOffset > 0 ? this.text.substring(0, startOffset) : "";
        let endText = endOffset < this.text.length ? this.text.substring(endOffset) : "";
        this.text = startText + text + endText;

        //reporting the change to the client, if possible.
        if (this.editorManager && this.editorManager.getDocumentChangeExecutor()) {
            this.editorManager.getDocumentChangeExecutor().changeDocument({

                uri: this.uri,

                text: this.text
            })
        } else {
            this.logger.error(
                "Can not report document change to the client as there is no executor",
            "EditorManager", "TextBufferInfo#setTextInRange")
        }

        return null;
    }

    /**
     * Returns buffer text.
     */
    getText(): string {
        return this.text;
    }

    /**
     * Gets buffer end.
     */
    getEndPosition():IPoint {
        return this.positionForCharacterIndex(this.text.length - 1)
    }

    public setText(text : string) : void {
        this.text = text!=null?text:"";
        this.initMapping();
    }

    initMapping(){

        this.lineLengths = [];

        var ind = 0;
        var l = this.text.length;
        for(var i = 0 ; i < l; i++){

            if(this.text.charAt(i)=='\r'){
                if(i < l-1 && this.text.charAt(i+1)=='\n'){
                    this.lineLengths.push(i-ind + 2);
                    ind = i+2;
                    i++;
                }
                else{
                    this.lineLengths.push(i-ind + 1);
                    ind = i+1;
                }
            }
            else if(this.text.charAt(i)=='\n'){
                this.lineLengths.push(i-ind + 1);
                ind = i+1;
            }
        }
        this.lineLengths.push(l-ind);
    }
}

class TextEditorInfo implements IAbstractTextEditorWithCursor {

    private buffer : TextBufferInfo;
    private cursorPosition: number;

    constructor(private uri : string, private version : number, text : string,
        editorManager : EditorManager, logger: ILogger) {

        this.buffer = new TextBufferInfo(uri, editorManager, logger);
        this.buffer.setText(text);
    }

    setCursorPosition(position) {
        this.cursorPosition = position;
    }

    /**
     * Returns current cursor position
     */
    getCursorBufferPosition() : IPoint {
        if (this.buffer == null || this.cursorPosition == null) return {
            row: 0,
            column: 0
        };

        return this.getBuffer().positionForCharacterIndex(this.cursorPosition);
    }

    /**
     * Returns current cursor position, integer, starting from 0
     */
    getCursorPosition(): number {
        if (!this.cursorPosition) return 0;

        return this.cursorPosition;
    }

    /**
     * Returns complete text of the document opened in the editor.
     */
    getText() : string {
        return this.buffer.getText();
    }

    /**
     * Gets text buffer for the editor.
     */
    getBuffer() : IEditorTextBuffer {
        return this.buffer;
    }

    /**
     * Gets file path.
     */
    getPath() {
        return this.uri;
    }

    /**
     * Sets editor text.
     * @param text
     */
    setText(text:string) {
        this.buffer.setText(text)
    }

    /**
     * Returns document version, if any.
     */
    getVersion() : number {
        return this.version;
    }
}

class EditorManager implements IEditorManagerModule {

    private uriToEditor : {[uri:string] : TextEditorInfo} = {};
    private documentChangeListeners: {(document : IChangedDocument):void}[] = []
    private documentChangeExecutor : IDocumentChangeExecutor = null;

    constructor(private connection : IServerConnection){
    }

    listen() : void {
        this.connection.onOpenDocument(
            (document: IOpenedDocument)=>{this.onOpenDocument(document)}
        );

        this.connection.onChangeDocument(
            (document : IChangedDocument)=>{this.documentWasChanged(document)}
        );

        this.connection.onChangePosition((uri, position)=>{
            let editor = this.getEditor(uri);
            if (!editor) return;

            (<TextEditorInfo> editor).setCursorPosition(position);
        })

        this.connection.onCloseDocument(
            (uri : string)=>{this.onCloseDocument(uri)}
        );
    }

    onChangeDocument(listener: (document : IChangedDocument)=>void) {
        this.documentChangeListeners.push(listener);
    }

    getEditor(uri : string) : IAbstractTextEditorWithCursor {
        return this.uriToEditor[uri];
    }

    onOpenDocument(document: IOpenedDocument) : void {
        this.uriToEditor[document.uri] =
            new TextEditorInfo(document.uri, document.version, document.text,
                this, this.connection)
    }

    /**
     * Sets document change executor to use when editor buffer text modification
     * methods are being called.
     * @param executor
     */
    setDocumentChangeExecutor(executor : IDocumentChangeExecutor) : void {
        this.documentChangeExecutor = executor;
    }

    getDocumentChangeExecutor() : IDocumentChangeExecutor {
        return this.documentChangeExecutor;
    }

    documentWasChanged(document : IChangedDocument) : void {

        this.connection.debug("Document is changed",
            "EditorManager", "onChangeDocument");
        this.connection.debugDetail(`Text is:\n ` + document.text, "EditorManager", "onChangeDocument");

        let current = this.uriToEditor[document.uri];
        if (current) {

            let currentVersion = current.getVersion();
            if (currentVersion && document.version && currentVersion == document.version) {
                this.connection.debugDetail("Version of the reported change is equal to the previous one",
                    "EditorManager", "onChangeDocument");
                return;
            }

            let currentText = current.getText();
            if (document.text == currentText) {
                this.connection.debugDetail("No changes detected", "EditorManager", "onChangeDocument");
                return;
            }
        }

        this.uriToEditor[document.uri] =
            new TextEditorInfo(document.uri, document.version, document.text,
                this, this.connection)
        for(let listener of this.documentChangeListeners) {
            listener(document);
        }
    }

    onCloseDocument(uri : string) : void {
        delete this.uriToEditor[uri];
    }


}