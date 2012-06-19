// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Cursor_ensureCursorVisible;
var Cursor_positionCursor;
var Cursor_getCursorPosition;
var Cursor_moveLeft;
var Cursor_moveRight;
var Cursor_moveToStartOfDocument;
var Cursor_moveToEndOfDocument;
var Cursor_updateBRAtEndOfParagraph;
var Cursor_insertReference;
var Cursor_insertLink;
var Cursor_insertCharacter;
var Cursor_deleteCharacter;
var Cursor_enterPressed;
var Cursor_getPrecedingWord;
var Cursor_getAdjacentNodeWithName;
var Cursor_getLinkProperties;
var Cursor_setLinkProperties;
var Cursor_setReferenceTarget;
var Cursor_makeContainerInsertionPoint;

(function() {

    // public
    Cursor_ensureCursorVisible = trace(function ensureCursorVisible()
    {
        var rect = Selection_getCursorRect();
        if (rect != null) {
            var extraSpace = 4;

            var cursorTop = rect.top + window.scrollY - extraSpace;
            var cursorBottom = rect.top + rect.height + window.scrollY + extraSpace;

            var windowTop = window.scrollY;
            var windowBottom = window.scrollY + window.innerHeight;

            if (cursorTop < windowTop)
                window.scrollTo(window.scrollX,cursorTop);
            else if (cursorBottom > windowBottom)
                window.scrollTo(window.scrollX,cursorBottom - window.innerHeight);
        }
    });

    // public
    Cursor_positionCursor = trace(function positionCursor(x,y,wordBoundary)
    {
        if (UndoManager_groupType() != "Cursor movement")
            UndoManager_newGroup("Cursor movement");

        var result = null;
        var position = positionAtPoint(x,y);
        if (position == null)
            return null;

        if (DOM_upperName(position.node) == "FIGURE") {
            var prev = position.node.childNodes[position.offset-1];
            var next = position.node.childNodes[position.offset];
            if ((prev != null) && isImageNode(prev)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node)+1);
            }
            else if ((next != null) && isImageNode(next)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node));
            }
        }

        var node = position.closestActualNode();
        for (; node != null; node = node.parentNode) {
            if ((DOM_upperName(node) == "A") && (result == null)) {
                var href = node.getAttribute("href");
                if ((href != null) && (href.charAt(0) == "#")) {
                    if (isInTOC(node))
                        result = "intocreference-"+href.substring(1);
                    else
                        result = "inreference";
                }
                else {
                    result = "inlink";
                }
            }
            else if ((DOM_upperName(node) == "IMG") && (result == null)) {
                for (var anc = node; anc != document.body; anc = anc.parentNode) {
                    if (DOM_upperName(anc) == "FIGURE") {
                        result = "infigure";
                        break;
                    }
                }
            }
            else if (isAutoCorrectNode(node) && (result == null)) {
                result = "incorrection";
            }
        }

        var position = Position_closestMatchForwards(position,Position_okForMovement);
        if ((position != null) && isOpaqueNode(position.node))
            position = Position_nextMatch(position,Position_okForMovement);
        if (position == null)
            return false;

        var selectionRange = Selection_get();
        var samePosition = ((selectionRange != null) && selectionRange.isEmpty() &&
                            (position.node == selectionRange.start.node) &&
                            (position.offset == selectionRange.start.offset));
        if (samePosition && (result == null))
            result = "same";

        if (wordBoundary) {
            var startOfWord = Selection_posAtStartOfWord(position);
            var endOfWord = Selection_posAtEndOfWord(position);
            if ((startOfWord.node != position.node) || (startOfWord.node != position.node))
                throw new Error("Word boundary in different node");
            var distanceBefore = position.offset - startOfWord.offset;
            var distanceAfter = endOfWord.offset - position.offset;
            if (distanceBefore <= distanceAfter)
                position = startOfWord;
            else
                position = endOfWord;
        }

        Selection_set(position.node,position.offset,position.node,position.offset);
        Cursor_ensureCursorVisible();
        return result;
    });

    // public
    Cursor_getCursorPosition = trace(function getCursorPosition()
    {
        var rect = Selection_getCursorRect();
        if (rect == null)
            return null;

        var left = rect.left + window.scrollX;
        var top = rect.top + window.scrollY;
        var height = rect.height;
        return { x: left, y: top, width: 0, height: height };
    });

    // public
    Cursor_moveLeft = trace(function moveLeft()
    {
        var range = Selection_get();
        if (range == null)
            return;

        var pos = Position_prevMatch(range.start,Position_okForMovement);
        if (pos != null)
            Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    // public
    Cursor_moveRight = trace(function moveRight()
    {
        var range = Selection_get();
        if (range == null)
            return;

        var pos = Position_nextMatch(range.start,Position_okForMovement);
        if (pos != null)
            Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    Cursor_moveToStartOfDocument = trace(function moveToStartOfDocument()
    {
        var pos = new Position(document.body,0);
        pos = Position_closestMatchBackwards(pos,Position_okForMovement);
        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    Cursor_moveToEndOfDocument = trace(function moveToEndOfDocument()
    {
        var pos = new Position(document.body,document.body.childNodes.length);
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
    // a BR element as a child
    // public
    Cursor_updateBRAtEndOfParagraph = trace(function updateBRAtEndOfParagraph(node)
    {
        var paragraph = node;
        while ((paragraph != null) && !isParagraphNode(paragraph))
            paragraph = paragraph.parentNode;
        if (paragraph != null) {

            var br = null;
            for (var last = paragraph; last != null; last = last.lastChild) {

                var child = last;
                while ((child != null) && isWhitespaceTextNode(child))
                    child = child.previousSibling;

                if ((child != null) && (DOM_upperName(child) == "BR"))
                    br = child;
            }

            if (nodeHasContent(paragraph)) {
                // Paragraph has content: don't want BR at end
                if (br != null) {
                    DOM_deleteNode(br);
                }
            }
            else {
                // Paragraph consists only of whitespace: must have BR at end
                if (br == null) {
                    br = DOM_createElement(document,"BR");
                    DOM_appendChild(paragraph,br);
                }
            }
        }
    });

    // public
    Cursor_insertReference = trace(function insertReference(itemId)
    {
        var a = DOM_createElement(document,"A");
        DOM_setAttribute(a,"href","#"+itemId);
        Clipboard_pasteNodes([a]);
    });

    // public
    Cursor_insertLink = trace(function insertLink(text,url)
    {
        var a = DOM_createElement(document,"A");
        DOM_setAttribute(a,"href",url);
        DOM_appendChild(a,DOM_createTextNode(document,text));
        Clipboard_pasteNodes([a]);
    });

    var nbsp = String.fromCharCode(160);

    var spaceToNbsp = trace(function spaceToNbsp(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset > 0) &&
            (isWhitespaceString(node.nodeValue.charAt(offset-1)))) {
            // Insert first, to preserve any tracked positions
            DOM_insertCharacters(node,offset-1,nbsp);
            DOM_deleteCharacters(node,offset,offset+1);
        }
    });

    var nbspToSpace = trace(function nbspToSpace(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset > 0) &&
            (node.nodeValue.charAt(offset-1) == nbsp)) {
            // Insert first, to preserve any tracked positions
            DOM_insertCharacters(node,offset-1," ");
            DOM_deleteCharacters(node,offset,offset+1);
        }
    });

    var checkNbsp = trace(function insertFinished()
    {
        Selection_preserveWhileExecuting(function() {
            var selRange = Selection_get();
            if (selRange != null)
                nbspToSpace(selRange.end);
        });
    });

    // public
    Cursor_insertCharacter = trace(function insertCharacter(str,allowInvalidPos)
    {
        var firstInsertion = (UndoManager_groupType() != "Insert text");

        if (firstInsertion)
            UndoManager_newGroup("Insert text",checkNbsp);

        if (str == "-") {
            var preceding = Cursor_getPrecedingWord();
            if (preceding.match(/[0-9]\s*$/))
                str = String.fromCharCode(0x2013); // en dash
            else if (preceding.match(/\s+$/))
                str = String.fromCharCode(0x2014); // em dash
        }

        var selRange = Selection_get();
        if (selRange == null)
            return;

        if (!selRange.isEmpty()) {
            Selection_deleteContents();
            selRange = Selection_get();
        }
        var pos = selRange.start;
        if (!allowInvalidPos && !Position_okForMovement(pos,true))
            pos = Position_closestMatchForwards(selRange.start,Position_okForInsertion);
        var node = pos.node;
        var offset = pos.offset;

        if ((str == " ") &&
            !firstInsertion &&
            (node.nodeType == Node.TEXT_NODE) &&
            (offset > 0) &&
            (node.nodeValue.charAt(offset-1) == nbsp)) {

            if (!node.nodeValue.substring(0,offset).match(/\.\s+$/)) {
                DOM_deleteCharacters(node,offset-1,offset);
                DOM_insertCharacters(node,offset-1,".");
            }
        }

        if (isWhitespaceString(str) && (node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
            var prevChar = node.nodeValue.charAt(offset-1);
            if (isWhitespaceString(prevChar) || (prevChar == nbsp)) {
                Selection_update();
                Cursor_ensureCursorVisible();
                return;
            }
        }

        nbspToSpace(pos);

        if (node.nodeType == Node.ELEMENT_NODE) {
            var emptyTextNode = DOM_createTextNode(document,"");
            if (offset >= node.childNodes.length)
                DOM_appendChild(node,emptyTextNode);
            else
                DOM_insertBefore(node,emptyTextNode,node.childNodes[offset]);
            node = emptyTextNode;
            offset = 0;
        }

        if (str == " ")
            DOM_insertCharacters(node,offset,nbsp);
        else
            DOM_insertCharacters(node,offset,str);

        offset += str.length;
        Selection_set(node,offset,node,offset);
        Selection_get().trackWhileExecuting(function() {
            Cursor_updateBRAtEndOfParagraph(node);
        });

        Selection_update();
        Cursor_ensureCursorVisible();
    });

    // public
    Cursor_deleteCharacter = trace(function deleteCharacter()
    {
        if (UndoManager_groupType() != "Delete text")
            UndoManager_newGroup("Delete text",checkNbsp);

        var selRange = Selection_get();
        if (selRange == null)
            return;

        if (!selRange.isEmpty()) {
            Selection_deleteContents();
        }
        else {
            var currentPos = selRange.start;
            var prevPos = Position_prevMatch(currentPos,Position_okForMovement);
            if (prevPos != null) {
                var startBlock = firstBlockAncestor(prevPos.closestActualNode());
                var endBlock = firstBlockAncestor(selRange.end.closestActualNode());
                if ((startBlock != endBlock) &&
                    isParagraphNode(startBlock) && !nodeHasContent(startBlock)) {
                    DOM_deleteNode(startBlock);
                    Selection_set(selRange.end.node,selRange.end.offset,
                                  selRange.end.node,selRange.end.offset)
                }
                else {
                    Selection_deleteRangeContents(new Range(prevPos.node,prevPos.offset,
                                                            selRange.end.node,selRange.end.offset));
                }
            }
        }
        
        selRange = Selection_get();
        if (selRange != null)
            spaceToNbsp(selRange.end);
        Selection_update();
        Cursor_ensureCursorVisible();

        function firstBlockAncestor(node)
        {
            while (isInlineNode(node))
                node = node.parentNode;
            return node;
        }
    });

    // public
    Cursor_enterPressed = trace(function enterPressed()
    {
        UndoManager_newGroup("New paragraph");

        var selRange = Selection_get();
        if (selRange == null)
            return;

        selRange.trackWhileExecuting(function() {
            selRange.ensureRangeInlineNodesInParagraph();
            selRange.ensureRangeValidHierarchy();
            if (!selRange.isEmpty())
                Selection_deleteContents();
        });

        var pos = selRange.start;

        var detail = selRange.detail();
        if ((DOM_upperName(detail.startParent) == "OL") ||
            (DOM_upperName(detail.startParent) == "UL")) {
            var li = DOM_createElement(document,"LI");
            DOM_insertBefore(detail.startParent,li,detail.startChild);

            Selection_set(li,0,li,0);
            Cursor_ensureCursorVisible();
            return;
        }

        selRange.trackWhileExecuting(function() {

            // If we're directly in a container node, add a paragraph, so we have something to
            // split.
            if (enterPressedFilter(pos.node) || (pos.node == document.body)) {
                var p = DOM_createElement(document,"P");
                DOM_insertBefore(pos.node,p,pos.node.childNodes[pos.offset]);
                pos = new Position(p,0);
            }

            if (positionAtStartOfHeading(pos)) {
                var container = getContainerOrParagraph(pos.node);
                pos = Formatting_movePreceding(container,0,enterPressedFilter,true);
            }
            else if (pos.node.nodeType == Node.TEXT_NODE) {
                pos = Formatting_splitTextAfter(pos.node,pos.offset,enterPressedFilter,true);
            }
            else {
                pos = Formatting_moveFollowing(pos.node,pos.offset,enterPressedFilter,true);
            }
        });

        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        selRange = Selection_get();

        selRange.trackWhileExecuting(function() {
            if ((pos.node.nodeType == Node.TEXT_NODE) && (pos.node.nodeValue.length == 0)) {
                DOM_deleteNode(pos.node);
            }

            var detail = selRange.detail();

            // If a preceding paragraph has become empty as a result of enter being pressed
            // while the cursor was in it, then update the BR at the end of the paragraph
            var start = detail.startChild ? detail.startChild : detail.startParent;
            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                var prev = ancestor.previousSibling;
                if ((prev != null) && isParagraphNode(prev) && !nodeHasContent(prev)) {
                    DOM_deleteAllChildren(prev);
                    Cursor_updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((prev != null) && isListItemNode(prev) && !nodeHasContent(prev)) {
                    var next;
                    for (var child = prev.firstChild; child != null; child = next) {
                        next = child.nextSibling;
                        if (isWhitespaceTextNode(child))
                            DOM_deleteNode(child);
                        else
                            Cursor_updateBRAtEndOfParagraph(child);
                    }
                    break;
                }
            }

            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                if (isParagraphNode(ancestor) && isHeadingNode(ancestor)) {
                    ancestor = DOM_replaceElement(ancestor,"P");
                    DOM_removeAttribute(ancestor,"id");
                }

                if (isParagraphNode(ancestor) && !nodeHasContent(ancestor)) {
                    Cursor_updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((DOM_upperName(ancestor) == "LI") && !nodeHasContent(ancestor)) {
                    DOM_deleteAllChildren(ancestor);
                    break;
                }
            }

            Cursor_updateBRAtEndOfParagraph(selRange.singleNode());
        });

        Selection_set(selRange.start.node,selRange.start.offset,
                      selRange.end.node,selRange.end.offset);
        Cursor_ensureCursorVisible();

        function enterPressedFilter(node)
        {
            return (isContainerNode(node) && (DOM_upperName(node) != "LI"));
        }

        function getContainerOrParagraph(node)
        {
            while ((node != null) && isInlineNode(node))
                node = node.parentNode;
            return node;
        }

        function positionAtStartOfHeading(pos)
        {
            var container = getContainerOrParagraph(pos.node);
            if (isHeadingNode(container)) {
                var startOffset = 0;
                if (isOpaqueNode(container.firstChild))
                    startOffset = 1;
                var range = new Range(container,startOffset,pos.node,pos.offset);
                return !range.hasContent();
            }
            else
                return false;
        }
    });

    Cursor_getPrecedingWord = trace(function getPrecedingWord() {
        var selRange = Selection_get();
        if ((selRange == null) && !selRange.isEmpty())
            return "";

        var node = selRange.start.node;
        var offset = selRange.start.offset;
        if (node.nodeType != Node.TEXT_NODE)
            return "";

        return node.nodeValue.substring(0,offset);
    });

    Cursor_getAdjacentNodeWithName = trace(function getAdjacentNodeWithName(name)
    {
        var selRange = Selection_get();
        var position = selRange.start;
        while (position != null) {
            var node = position.closestActualNode();
            for (; node != null; node = node.parentNode) {
                if (DOM_upperName(node) == name)
                    return node;
            }
            position = position.prev();
        }
        return null;
    });

    Cursor_getLinkProperties = trace(function getLinkProperties()
    {
        var a = Cursor_getAdjacentNodeWithName("A");
        if (a == null)
            return null;

        return { href: a.getAttribute("href"),
                 text: getNodeText(a) };
    });

    Cursor_setLinkProperties = trace(function setLinkProperties(properties)
    {
        var a = Cursor_getAdjacentNodeWithName("A");
        if (a == null)
            return null;

        Selection_preserveWhileExecuting(function() {
            DOM_setAttribute(a,"href",properties.href);
            DOM_deleteAllChildren(a);
            DOM_appendChild(a,DOM_createTextNode(document,properties.text));
        });
    });

    Cursor_setReferenceTarget = trace(function setReferenceTarget(itemId)
    {
        var a = Cursor_getAdjacentNodeWithName("A");
        if (a != null)
            Outline_setReferenceTarget(a,itemId);
    });

    // Deletes the current selection contents and ensures that the cursor is located directly
    // inside the nearest container element, i.e. not inside a paragraph or inline node. This
    // is intended for preventing things like inserting a table of contants inside a heading
    Cursor_makeContainerInsertionPoint = trace(function makeContainerInsertionPoint()
    {
        var selRange = Selection_get();
        if (selRange == null)
            return;

        if (!selRange.isEmpty()) {
            Selection_deleteContents();
            selRange = Selection_get();
        }

        var parent;
        var previousSibling;
        var nextSibling;

        if (selRange.start.node.nodeType == Node.ELEMENT_NODE) {
            parent = selRange.start.node;
            nextSibling = selRange.start.node.childNodes[selRange.start.offset];
        }
        else {
            if (selRange.start.offset > 0)
                Formatting_splitTextBefore(selRange.start.node,selRange.start.offset);
            parent = selRange.start.node.parentNode;
            nextSibling = selRange.start.node;
        }

        var offset = DOM_nodeOffset(nextSibling,parent);

        if (isContainerNode(parent)) {
            Selection_set(parent,offset,parent,offset);
            return;
        }

        if ((offset > 0) && isItemNumber(parent.childNodes[offset-1]))
            offset--;

        Formatting_moveFollowing(parent,offset,isContainerNode);
        Formatting_movePreceding(parent,offset,isContainerNode);

        offset = 0;
        while (!isContainerNode(parent)) {
            var old = parent;
            offset = DOM_nodeOffset(parent);
            parent = parent.parentNode;
            DOM_deleteNode(old);
        }

        Selection_set(parent,offset,parent,offset);
    });

})();
