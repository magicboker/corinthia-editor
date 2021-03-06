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

import Clipboard = require("./clipboard");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Outline = require("./outline");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Selection = require("./selection");
import Traversal = require("./traversal");
import UndoManager = require("./undo");
import Util = require("./util");

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("./externalapi");
export type FigureProperties = ExternallyVisibleTypes.FigureProperties;
export type FigureGeometry = ExternallyVisibleTypes.FigureGeometry;

// public
export function insertFigure(filename: string, width: string, numbered: boolean, caption: string): void {
    UndoManager.newGroup("Insert figure");

    let figure = DOM.createElement(document,"FIGURE");
    let img = DOM.createElement(document,"IMG");
    DOM.setAttribute(img,"src",encodeURI(filename));
    DOM.setStyleProperties(img,{"width": width});
    DOM.appendChild(figure,img);

    if ((caption != null) && (caption != "")) {
        let figcaption = DOM.createElement(document,"FIGCAPTION");
        DOM.appendChild(figcaption,DOM.createTextNode(document,caption));
        DOM.appendChild(figure,figcaption);
    }

    Clipboard.pasteNodes([figure]);

    // Now that the figure has been inserted into the DOM tree, the outline code will
    // have noticed it and added an id attribute, as well as a caption giving the
    // table number.
    Outline.setNumbered(figure.getAttribute("id"),numbered);

    // Place the cursor directly after the figure
    let offset = Traversal.nodeOffset(figure);
    let pos = new Position(figure.parentNode,offset);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    Selection.set(pos.node,pos.offset,pos.node,pos.offset);

    PostponedActions.add(UndoManager.newGroup);
}

export function getSelectedFigureId(): string {
    let element = Cursor.getAdjacentElementWithType(ElementTypes.HTML_FIGURE);
    return element ? element.getAttribute("id") : null;
}

// public
export function getProperties(itemId: string): FigureProperties {
    let figure = document.getElementById(itemId);
    if (figure == null)
        return null;
    let rect = figure.getBoundingClientRect();
    let result: FigureProperties = { width: null, src: null };

    let img = Traversal.firstDescendantOfType(figure,ElementTypes.HTML_IMG);
    if (img != null) {
        result.src = decodeURI(img.getAttribute("src"));
        result.width = img.style.width;

        if ((result.width == null) || (result.width == ""))
            result.width = DOM.getAttribute(img,"width");
    }
    return result;
}

// public
export function setProperties(itemId: string, width: string, src: string): void {
    let figure = document.getElementById(itemId);
    if (figure == null)
        return null;
    let img = Traversal.firstDescendantOfType(figure,ElementTypes.HTML_IMG);
    if (img != null) {
        if (src == null)
            DOM.removeAttribute(img,"src");
        else
            DOM.setAttribute(img,"src",encodeURI(src));

        DOM.setStyleProperties(img,{"width": width});
        if (img.getAttribute("style") == "")
            DOM.removeAttribute(img,"style");
        Selection.update();
    }
}

// public
export function getGeometry(itemId: string): FigureGeometry {
    let figure = document.getElementById(itemId);
    if ((figure == null) || (figure.parentNode == null))
        return null;
    let img = Traversal.firstDescendantOfType(figure,ElementTypes.HTML_IMG);
    if (img == null)
        return null;
    let parent = figure.parentNode;
    let parentElement: HTMLElement = null;
    if (parent instanceof HTMLElement)
        parentElement = parent;
    else
        throw new Error("Figure parent is not a HTMLElement");

    let figcaption = Traversal.firstChildOfType(figure,ElementTypes.HTML_FIGCAPTION);

    return {
        contentRect: Util.absElementRect(img),
        fullRect: Util.absElementRect(figure),
        parentRect: Util.absElementRect(parentElement),
        hasCaption: (figcaption != null)
    };
}
