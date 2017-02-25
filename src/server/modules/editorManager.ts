import {
    IServerConnection
} from '../core/connections'

import {
    IOpenedDocument,
    IChangedDocument
} from '../../common/typeInterfaces'

import {
    IAbstractTextEditor,
    IEditorTextBuffer,
    IPoint,
    IRange
} from './commonInterfaces'

export interface IEditorManagerModule {
    listen() : void;
    getEditor(uri : string) : IAbstractTextEditor;
}

export function createManager(connection : IServerConnection) : IEditorManagerModule {
    return new EditorManager(connection);
}

class TextBufferInfo implements IEditorTextBuffer {
    //TODO add border checks

    private text = "";
    private lineLengths: number[];

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
        //TODO
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

class TextEditorInfo implements IAbstractTextEditor{

    private buffer : TextBufferInfo;

    constructor(private uri : string, text : string) {
        this.buffer = new TextBufferInfo();
        this.buffer.setText(text);
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


}

class EditorManager implements IEditorManagerModule {

    private uriToEditor : {[uri:string] : TextEditorInfo} = {};

    constructor(private connection : IServerConnection){
    }

    listen() : void {
        this.connection.onOpenDocument(
            (document: IOpenedDocument)=>{this.onOpenDocument(document)}
        );

        this.connection.onChangeDocument(
            (document : IChangedDocument)=>{this.onChangeDocument(document)}
        );

        this.connection.onCloseDocument(
            (uri : string)=>{this.onCloseDocument(uri)}
        );
    }

    getEditor(uri : string) : IAbstractTextEditor {
        return this.uriToEditor[uri];
    }

    onOpenDocument(document: IOpenedDocument) : void {
        this.uriToEditor[document.uri] = new TextEditorInfo(document.uri, document.text)
    }

    onChangeDocument(document : IChangedDocument) : void {

        this.connection.debug("Document is changed",
            "EditorManager", "onChangeDocument");

        this.uriToEditor[document.uri] = new TextEditorInfo(document.uri, document.text)
    }

    onCloseDocument(uri : string) : void {
        delete this.uriToEditor[uri];
    }


}