// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

DocxUtil = new Object();

DocxUtil.htmlColor = function(DocxColor)
{
    if (DocxColor == "auto")
        return "black";
    else if (DocxColor != null)
        return "#"+DocxColor;
    else
        return null;
}

DocxUtil.mergeCSSProperties = function(cssProperties)
{
    mergeVals("border-left",["border-left-width","border-left-style","border-left-color"]);
    mergeVals("border-right",["border-right-width","border-right-style","border-right-color"]);
    mergeVals("border-top",["border-top-width","border-top-style","border-top-color"]);
    mergeVals("border-bottom",["border-bottom-width","border-bottom-style","border-bottom-color"]);
    
    mergeIdentical("border",["border-left","border-right","border-top","border-bottom"]);
    
    function mergeIdentical(combined,names)
    {
        for (var i = 0; i < names.length; i++) {
            if (cssProperties[names[i]] == null)
                return;
            if (cssProperties[names[i]] != cssProperties[names[0]])
                return;
        }
        cssProperties[combined] = cssProperties[names[0]];
        for (var i = 0; i < names.length; i++)
            delete cssProperties[names[i]];
    }
    
    function mergeVals(combined,names)
    {
        var values = new Array();
        for (var i = 0; i < names.length; i++) {
            if (cssProperties[names[i]] != null) {
                values.push(cssProperties[names[i]]);
                delete cssProperties[names[i]];
            }
        }
        if (values.length > 0) {
            cssProperties[combined] = values.join(" ");
        }
    }
}

DocxUtil.cssPropertiesText = function(cssProperties)
{
    var props = new Array();
    for (var name in cssProperties)
        props.push(name+": "+cssProperties[name]);
    if (props.length > 0)
        return props.join("; ");
    else
        return null;
}

DocxUtil.cssRuleText = function(selector,cssProperties)
{
    var names = new Array();
    for (name in cssProperties) {
        // if (name.indexOf("word-") != 0)
        names.push(name);
    }
    names.sort();
    
    var str = selector+" {\n";
    for (var i = 0; i < names.length; i++) {
        str += "    "+names[i]+": "+cssProperties[names[i]];
        str += ";\n";
    }
    str += "}\n";
    return str;
}

DocxUtil.percentage = function(numerator,denominator)
{
    if (denominator <= 0)
        return "0%";
    var ratio = Math.min(1,numerator/denominator);
    return Math.round(1000*ratio)/10 + "%";
}

DocxUtil.isWordElement = function(node,name)
{
    return (node.namespaceURI == WORD_NAMESPACE) && (node.localName == name);
}

DocxUtil.firstChildElement = function(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeType == Node.ELEMENT_NODE)
            return child;
    }
    return null;
}
