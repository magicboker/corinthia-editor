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

import DOM = require("../src/dom");
import ElementTypes = require("../src/elementTypes");
import Formatting = require("../src/formatting");
import Types = require("../src/types");
import UndoManager = require("../src/undo");

export interface Options {
    keepSelectionHighlights?: boolean;
    preserveCase?: boolean;
    showNamespaceDetails?: boolean;
    separateLines?: boolean;
}

export function getHTML(root: Node, options?: Options): string {
    let copy: Node;
    UndoManager.disableWhileExecuting(function() {
        if (options == null)
            options = new Object();
        copy = DOM.cloneNode(root,true);
        if (!options.keepSelectionHighlights)
            removeSelectionSpans(copy);
        for (let body = copy.firstChild; body != null; body = body.nextSibling) {
            if (body instanceof HTMLBodyElement) {
                DOM.removeAttribute(body,"style");
                DOM.removeAttribute(body,"contentEditable");
            }
        }
    });

    let output: string[] = [];
    prettyPrint(output,options,copy,"");
    return output.join("");
}

function removeSelectionSpans(root: Node): void {
    let checkMerge = new Array();
    recurse(root);

    for (let i = 0; i < checkMerge.length; i++) {
        if (checkMerge[i].parentNode != null) { // if not already merged
            Formatting.mergeWithNeighbours(checkMerge[i],[]);
        }
    }

    function recurse(node: Node): void {
        if (Types.isSelectionHighlight(node)) {
            checkMerge.push(node.firstChild);
            checkMerge.push(node.lastChild);
            DOM.removeNodeButKeepChildren(node);
        }
        else {
            let next: Node;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

function entityFix(str: string): string {
    return str.replace(/\u00a0/g,"&nbsp;");
}

function singleDescendents(node: Node): boolean {
    let count = 0;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child instanceof Text) && (textNodeDisplayValue(child).length == 0))
            continue;
        count++;
        if (count > 1)
            return false;
        if (!singleDescendents(child))
            return false;
    }
    return true;
}

function sortCSSProperties(value: string): string {
    // Make sure the CSS properties on the "style" attribute appear in a consistent order
    let items = value.trim().split(/\s*;\s*/);
    if ((items.length > 0) && (items[items.length-1] == ""))
        items.length--;
    items.sort();
    return items.join("; ");
}

function attributeString(options: Options, node: Element): string {
    // Make sure the attributes appear in a consistent order
    let names = new Array();
    for (let i = 0; i < node.attributes.length; i++) {
        names.push(node.attributes[i].nodeName);
    }
    names.sort();
    let str = "";
    for (let i = 0; i < names.length; i++) {
        let name = names[i];

        let value = node.getAttribute(name);
        if (name == "style")
            value = sortCSSProperties(value);
        let attr = node.getAttributeNode(name);
        if (options.showNamespaceDetails) {
            if ((attr.namespaceURI != null) || (attr.prefix != null))
                name = "{"+attr.namespaceURI+","+attr.prefix+","+attr.localName+"}"+name;
        }
        str += " "+name+"=\""+value+"\"";
    }
    return str;
}

function textNodeDisplayValue(node: Text): string {
    let value = entityFix(node.nodeValue);
    let parent = node.parentNode;
    if ((parent != null) &&
        (parent instanceof HTMLElement) &&
        (parent.getAttribute("xml:space") != "preserve"))
        value = value.trim();
    return value;
}

function prettyPrintOneLine(output: string[], options: Options, node: Node): void {
    if ((node instanceof HTMLElement) && (node.nodeName != "SCRIPT")) {
        let name = options.preserveCase ? node.nodeName : node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            output.push("<" + name + attributeString(options,node) + "/>");
        }
        else {
            output.push("<" + name + attributeString(options,node) + ">");
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                prettyPrintOneLine(output,options,child);
            output.push("</" + name + ">");
        }
    }
    else if (node instanceof Text) {
        let value = textNodeDisplayValue(node);
        if (value.length > 0)
            output.push(value);
    }
    else if (node instanceof Comment) {
        output.push("<!--" + entityFix(node.nodeValue) + "-->\n");
    }
}

function isContainer(node: Node): boolean {
    switch (node._type) {
    case ElementTypes.HTML_BODY:
    case ElementTypes.HTML_SECTION:
    case ElementTypes.HTML_FIGURE:
    case ElementTypes.HTML_TABLE:
    case ElementTypes.HTML_TBODY:
    case ElementTypes.HTML_THEAD:
    case ElementTypes.HTML_TFOOT:
    case ElementTypes.HTML_TR:
    case ElementTypes.HTML_DIV:
    case ElementTypes.HTML_UL:
    case ElementTypes.HTML_OL:
    case ElementTypes.HTML_NAV:
    case ElementTypes.HTML_COLGROUP:
        return true;
    default:
        return false;
    }
}

function prettyPrint(output: string[], options: Options, node: Node, indent: string): void {
    if ((node instanceof Element) && (node.nodeName != "SCRIPT")) {
        let name = options.preserveCase ? node.nodeName : node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            output.push(indent + "<" + name + attributeString(options,node) + "/>\n");
        }
        else {
            if (node._type == ElementTypes.HTML_STYLE) {
                output.push(indent + "<" + name + attributeString(options,node) + ">\n");
                for (let child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrint(output,options,child,"");
                output.push(indent + "</" + name + ">\n");
            }
            else if (!options.separateLines && singleDescendents(node) && !isContainer(node)) {
                output.push(indent);
                prettyPrintOneLine(output,options,node);
                output.push("\n");
            }
            else {
                output.push(indent + "<" + name + attributeString(options,node) + ">\n");
                for (let child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrint(output,options,child,indent+"  ");
                output.push(indent + "</" + name + ">\n");
            }
        }
    }
    else if (node instanceof Text) {
        let value = textNodeDisplayValue(node);
//            let value = JSON.stringify(node.nodeValue);
        if (value.length > 0)
            output.push(indent + value + "\n");
    }
    else if (node instanceof Comment) {
        output.push(indent + "<!--" + entityFix(node.nodeValue) + "-->\n");
    }
}
