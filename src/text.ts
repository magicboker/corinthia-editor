// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import DOM = require("./dom");
import Geometry = require("./geometry");
import Paragraph = require("./paragraph");
import Position = require("./position");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

export class ParagraphInfo {

    constructor(public node: Node, public startOffset: number, public endOffset: number,
                public runs: Run[], public text: string) {
    }
}

export class Run {

    constructor(public node: Node, public start: number, public end: number) {
    }

}

// In this code, we represent a paragraph by its first and last node. Normally, this will be
// the first and last child of a paragraph-level element (e.g. p or h1), but this scheme also
// represent a sequence of inline nodes between two paragraph or container nodes, e.g.
//
// <p>...</p> Some <i>inline</i> nodes <p>...</p>

export interface ParagraphBoundaries {
    node: Node;
    startOffset: number;
    endOffset: number;
}

export function findParagraphBoundaries(pos: Position): ParagraphBoundaries {
    pos.assertValid();
    let startOffset = pos.offset;
    let endOffset = pos.offset;
    let node = pos.node;

    while (Types.isInlineNode(node)) {
        startOffset = Traversal.nodeOffset(node);
        endOffset = Traversal.nodeOffset(node)+1;
        node = node.parentNode;
    }

    if (!(node instanceof Element))
        throw new Error("Not an element node: "+Util.nodeString(node));

    while ((startOffset > 0) && Types.isInlineNode(node.childNodes[startOffset-1]))
        startOffset--;
    while ((endOffset < node.childNodes.length) && Types.isInlineNode(node.childNodes[endOffset]))
        endOffset++;

    return { node: node, startOffset: startOffset, endOffset: endOffset };
}

export function analyseParagraph(pos: Position): ParagraphInfo {
    let initial = pos.node;
    let strings = new Array();
    let runs = new Array();
    let offset = 0;

    let boundaries = findParagraphBoundaries(pos);
    if (boundaries == null)
        return null;

    for (let off = boundaries.startOffset; off < boundaries.endOffset; off++)
        recurse(boundaries.node.childNodes[off]);

    let text = strings.join("");

    return new ParagraphInfo(boundaries.node,boundaries.startOffset,boundaries.endOffset,runs,text);

    function recurse(node: Node): void {
        if (node instanceof Text) {
            strings.push(node.nodeValue);
            let start = offset;
            let end = offset + node.nodeValue.length;
            runs.push(new Run(node,start,end));
            offset += node.nodeValue.length;
        }
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function posAbove(pos: Position, cursorRect?: ClientRect, cursorX?: number): Position {
    if (cursorX == null)
        cursorX = pos.targetX;
    pos = Position.closestMatchBackwards(pos,Position.okForMovement);
    if (cursorRect == null) {
        cursorRect = Geometry.rectAtPos(pos);
        if (cursorRect == null)
            return null;
    }

    if (cursorX == null) {
        cursorX = cursorRect.left;
    }

    while (true) {
        pos = Position.closestMatchBackwards(pos,Position.okForMovement);
        if (pos == null)
            return null;

        let paragraph = analyseParagraph(pos);
        if (paragraph == null)
            return null;

        let rects = Paragraph.getRunOrFallbackRects(paragraph,pos);

        rects = rects.filter(function (rect) {
            return (rect.bottom <= cursorRect.top);
        });



        var bottom = findLowestBottom(rects); // use var here due to reference from function below

        rects = rects.filter(function (rect) { return (rect.bottom == bottom); });

        // Scroll previous line into view, if necessary
        let top = findHighestTop(rects);
        if (top < 0) {
            let offset = -top;
            window.scrollBy(0,-offset);
            rects = offsetRects(rects,0,offset);
        }

        for (let i = 0; i < rects.length; i++) {
            if ((cursorX >= rects[i].left) && (cursorX <= rects[i].right)) {
                let newPos = Geometry.positionAtPoint(cursorX,rects[i].top + rects[i].height/2);
                if (newPos != null) {
                    newPos = Position.closestMatchBackwards(newPos,Position.okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }
        }

        let rightMost = findRightMostRect(rects);
        if (rightMost != null) {
            let newPos = Geometry.positionAtPoint(rightMost.right,rightMost.top + rightMost.height/2);
            if (newPos != null) {
                newPos = Position.closestMatchBackwards(newPos,Position.okForInsertion);
                newPos.targetX = cursorX;
                return newPos;
            }
        }


        pos = new Position(paragraph.node,paragraph.startOffset);
        pos = pos.prevMatch(Position.okForMovement);
    }
}

function findHighestTop(rects: ClientRect[]): number {
    let top: number = null;
    for (let i = 0; i < rects.length; i++) {
        if ((top == null) || (top > rects[i].top))
            top = rects[i].top;
    }
    return top;
}

function findLowestBottom(rects: ClientRect[]): number {
    let bottom: number = null;
    for (let i = 0; i < rects.length; i++) {
        if ((bottom == null) || (bottom < rects[i].bottom))
            bottom = rects[i].bottom;
    }
    return bottom;
}

function findRightMostRect(rects: ClientRect[]): ClientRect {
    let rightMost: ClientRect = null;
    for (let i = 0; i < rects.length; i++) {
        if ((rightMost == null) || (rightMost.right < rects[i].right))
            rightMost = rects[i];
    }
    return rightMost;
}

function offsetRects(rects: ClientRect[], offsetX: number, offsetY: number): ClientRect[] {
    let result: ClientRect[] = [];
    for (let i = 0; i < rects.length; i++) {
        result.push({ top: rects[i].top + offsetY,
                      bottom: rects[i].bottom + offsetY,
                      left: rects[i].left + offsetX,
                      right: rects[i].right + offsetX,
                      width: rects[i].width,
                      height: rects[i].height });
    }
    return result;
}

export function posBelow(pos: Position, cursorRect?: ClientRect, cursorX?: number): Position {
    if (cursorX == null)
        cursorX = pos.targetX;
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    if (cursorRect == null) {
        cursorRect = Geometry.rectAtPos(pos);
        if (cursorRect == null)
            return null;
    }

    if (cursorX == null) {
        cursorX = cursorRect.left;
    }


    while (true) {
        pos = Position.closestMatchForwards(pos,Position.okForMovement);
        if (pos == null)
            return null;

        let paragraph = analyseParagraph(pos);
        if (paragraph == null)
            return null;

        let rects = Paragraph.getRunOrFallbackRects(paragraph,pos);

        rects = rects.filter(function (rect) {
            return (rect.top >= cursorRect.bottom);
        });

        var top = findHighestTop(rects); // use var here due to reference from function below

        rects = rects.filter(function (rect) { return (rect.top == top); });

        // Scroll next line into view, if necessary
        let bottom = findLowestBottom(rects);
        if (bottom > window.innerHeight) {
            let offset = window.innerHeight - bottom;
            window.scrollBy(0,-offset);
            rects = offsetRects(rects,0,offset);
        }

        for (let i = 0; i < rects.length; i++) {
            if ((cursorX >= rects[i].left) && (cursorX <= rects[i].right)) {
                let newPos = Geometry.positionAtPoint(cursorX,rects[i].top + rects[i].height/2);
                if (newPos != null) {
                    newPos = Position.closestMatchForwards(newPos,Position.okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }
        }

        let rightMost = findRightMostRect(rects);
        if (rightMost != null) {
            let newPos = Geometry.positionAtPoint(rightMost.right,rightMost.top + rightMost.height/2);
            if (newPos != null) {
                newPos = Position.closestMatchForwards(newPos,Position.okForInsertion);
                newPos.targetX = cursorX;
                return newPos;
            }
        }

        pos = new Position(paragraph.node,paragraph.endOffset);
        pos = pos.nextMatch(Position.okForMovement);
    }
}

export function closestPosBackwards(pos: Position): Position {
    if (Traversal.isNonWhitespaceTextNode(pos.node))
        return pos;
    let node: Node;
    if ((pos.node instanceof Element) && (pos.offset > 0)) {
        node = pos.node.childNodes[pos.offset-1];
        while (node.lastChild != null)
            node = node.lastChild;
    }
    else {
        node = pos.node;
    }
    while ((node != null) && (node != document.body) && !Traversal.isNonWhitespaceTextNode(node))
        node = Traversal.prevNode(node);

    if ((node == null) || (node == document.body))
        return null;
    else
        return new Position(node,node.nodeValue.length);
}

export function closestPosForwards(pos: Position): Position {
    if (Traversal.isNonWhitespaceTextNode(pos.node))
        return pos;
    let node: Node;
    if ((pos.node instanceof Element) && (pos.offset < pos.node.childNodes.length)) {
        node = pos.node.childNodes[pos.offset];
        while (node.firstChild != null)
            node = node.firstChild;
    }
    else {
        node = Traversal.nextNodeAfter(pos.node);
    }
    while ((node != null) && !Traversal.isNonWhitespaceTextNode(node)) {
        let old = Util.nodeString(node);
        node = Traversal.nextNode(node);
    }

    if (node == null)
        return null;
    else
        return new Position(node,0);
}

export function closestPosInDirection(pos: Position, direction: string): Position {
    if ((direction == "forward") ||
        (direction == "right") ||
        (direction == "down")) {
        return closestPosForwards(pos);
    }
    else {
        return closestPosBackwards(pos);
    }
}

function toStartOfParagraph(pos: Position): Position {
    pos = Position.closestMatchBackwards(pos,Position.okForMovement);
    if (pos == null)
        return null;
    let paragraph = analyseParagraph(pos);
    if (paragraph == null)
        return null;

    let newPos = new Position(paragraph.node,paragraph.startOffset);
    return Position.closestMatchForwards(newPos,Position.okForMovement);
}

function toEndOfParagraph(pos: Position): Position {
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    if (pos == null)
        return null;
    let paragraph = analyseParagraph(pos);
    if (paragraph == null)
        return null;

    let newPos = new Position(paragraph.node,paragraph.endOffset);
    return Position.closestMatchBackwards(newPos,Position.okForMovement);
}

function toStartOfLine(pos: Position): Position {
    let posRect = Geometry.rectAtPos(pos);
    if (posRect == null) {
        pos = closestPosBackwards(pos);
        posRect = Geometry.rectAtPos(pos);
        if (posRect == null) {
            return null;
        }
    }

    while (true) {
        let check = pos.prevMatch(Position.okForMovement);
        let checkRect = Geometry.rectAtPos(check); // handles check == null case
        if (checkRect == null)
            return pos;
        if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
            return pos;
        pos = check;
    }
}

function toEndOfLine(pos: Position): Position {
    let posRect = Geometry.rectAtPos(pos);
    if (posRect == null) {
        pos = closestPosForwards(pos);
        posRect = Geometry.rectAtPos(pos);
        if (posRect == null) {
            return null;
        }
    }

    while (true) {
        let check = pos.nextMatch(Position.okForMovement);
        let checkRect = Geometry.rectAtPos(check); // handles check == null case
        if (checkRect == null)
            return pos;
        if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
            return pos;
        pos = check;
    }
}

export function toStartOfBoundary(pos: Position, boundary: string): Position {
    if (boundary == "paragraph")
        return toStartOfParagraph(pos);
    else if (boundary == "line")
        return toStartOfLine(pos);
    else
        throw new Error("Unsupported boundary: "+boundary);
}

export function toEndOfBoundary(pos: Position, boundary: string): Position {
    if (boundary == "paragraph")
        return toEndOfParagraph(pos);
    else if (boundary == "line")
        return toEndOfLine(pos);
    else
        throw new Error("Unsupported boundary: "+boundary);
}
