// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Hierarchy_ensureValidHierarchy;
var Hierarchy_ensureInlineNodesInParagraph;
var Hierarchy_wrapInlineNodesInParagraph;

(function() {

    // private
    var wrapInlineChildren = trace(function wrapInlineChildren(first,last,ancestors)
    {
        var haveNonWhitespace = false;
        for (var node = first; node != last.nextSibling; node = node.nextSibling) {
            if (!isWhitespaceTextNode(node))
                haveNonWhitespace = true;
        }
        if (!haveNonWhitespace)
            return false;

        var parentNode = first.parentNode;
        var nextSibling = first;
        for (var i = ancestors.length-1; i >= 0; i--) {
            var ancestorCopy = DOM_shallowCopyElement(ancestors[i]);
            DOM_insertBefore(parentNode,ancestorCopy,nextSibling);
            parentNode = ancestorCopy;
            nextSibling = null;

            var node = first;
            while (true) {
                var next = node.nextSibling;
                DOM_insertBefore(parentNode,node,null);
                if (node == last)
                    break;
                node = next;
            }
        }
    });

    // private
    var wrapInlineChildrenInAncestors = trace(function wrapInlineChildrenInAncestors(node,ancestors)
    {
        var firstInline = null;
        var lastInline = null;

        var child = node.firstChild;
        while (true) {
            var next = (child != null) ? child.nextSibling : null;
            if ((child == null) || !isInlineNode(child)) {

                if ((firstInline != null) && (lastInline != null)) {
                    wrapInlineChildren(firstInline,lastInline,ancestors);
                }
                firstInline = null;
                lastInline = null;
                if (child != null)
                    wrapInlineChildrenInAncestors(child,ancestors);
            }
            else {
                if (firstInline == null)
                    firstInline = child;
                lastInline = child;
            }
            if (child == null)
                break;
            child = next;
        }
    });

    // Enforce the restriction that any path from the root to a given node must be of the form
    //    container+ paragraph inline
    // or container+ paragraph
    // or container+
    // public
    Hierarchy_ensureValidHierarchy = trace(
        function ensureValidHierarchy(node,recursive,allowDirectInline)
    {
        var count = 0;
        while ((node != null) && (node.parentNode != null) && (node != document.body)) {
            count++;
            if (count > 20)
                throw new Error("ensureValidHierarchy: too many iterations");

            if (isHeadingNode(node) &&
                (node.parentNode != document.body) &&
                (DOM_upperName(node.parentNode) != "NAV")) {

                var offset = DOM_nodeOffset(node);
                Formatting_moveFollowing(new Position(node.parentNode,offset+1),
                                         function() { return false; });
                Formatting_movePreceding(new Position(node.parentNode,offset),
                                         function() { return false; });
                DOM_removeNodeButKeepChildren(node.parentNode);
                continue;
            }
            else if (isContainerNode(node) || isParagraphNode(node)) {

                var invalidNesting = !isContainerNode(node.parentNode);
                if (isParagraphNode(node) && (DOM_upperName(node.parentNode) == "DIV"))
                    invalidNesting = false; // this case is ok
                if (invalidNesting) {
                    DOM_removeAdjacentWhitespace(node);

                    var offset = DOM_nodeOffset(node);
                    Formatting_moveFollowing(new Position(node.parentNode,offset+1),
                                             isContainerNode);
                    Formatting_movePreceding(new Position(node.parentNode,offset),
                                             isContainerNode);

                    var ancestors = new Array();
                    var child = node;
                    while (!isContainerNode(child.parentNode)) {
                        if (isInlineNode(child.parentNode))
                            ancestors.push(child.parentNode);
                        child = child.parentNode;
                    }
                    DOM_insertBefore(child.parentNode,node,child);
                    DOM_deleteNode(child);

                    wrapInlineChildrenInAncestors(node,ancestors);
                }
            }

            node = node.parentNode;
        }
    });

    Hierarchy_ensureInlineNodesInParagraph = trace(function ensureInlineNodesInParagraph(node)
    {
        var count = 0;
        while ((node != null) && (node.parentNode != null) && (node != document.body)) {
            count++;
            if (count > 20)
                throw new Error("ensureInlineNodesInParagraph: too many iterations");
            if (isInlineNode(node) &&
                isContainerNode(node.parentNode) && !isListItemNode(node.parentNode) &&
                !isWhitespaceTextNode(node)) {
                Hierarchy_wrapInlineNodesInParagraph(node);
                return;
            }
            node = node.parentNode;
        }
    });

    // public
    Hierarchy_wrapInlineNodesInParagraph = trace(function wrapInlineNodesInParagraph(node)
    {
        var start = node;
        var end = node;

        while ((start.previousSibling != null) && isInlineNode(start.previousSibling))
            start = start.previousSibling;
        while ((end.nextSibling != null) && isInlineNode(end.nextSibling))
            end = end.nextSibling;

        return DOM_wrapSiblings(start,end,"P");
    });

})();
