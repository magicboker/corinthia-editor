// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.
// If you're successfully able to decipher all this and figure out what it
// does, please send a copy of your resume to peter@uxproductivity.com.

var trace;

(function() {

    function valueString(arg)
    {
        try {
            if (typeof(arg) == "object") {
                var str = arg.toString();
                return "[object "+arg.constructor.name+"]";
            }
            else if (typeof(arg) == "string") {
                return JSON.stringify(arg);
            }
            else if (typeof(arg) == "function") {
                if (arg.name)
                    return "<function "+arg.name+">";
                else
                    return "<anonymous function>";
            }
            else {
                return arg;
            }
        }
        catch (e) {
            return "?"; // in case object or array element's toString() fails
        }
    }

    function stackEntryString(fun,args,thisObject)
    {
        var components = new Array();
        if ((thisObject != null) && (thisObject.constructor.name != null)) {
            components.push(thisObject.constructor.name+".");
        }
        components.push(fun.name+"(");
        for (var argno = 0; argno < args.length; argno++) {
            var arg = args[argno];
            if (argno > 0)
                components.push(",");
            components.push(valueString(arg));
        }
        components.push("): this = "+valueString(thisObject));
        return components.join("");
    }

    trace = function(fun)
    {
        return function() {
            try {
                return fun.apply(this,arguments);
            }
            catch (e) {
                var error = e;
                if (!error.custom) {
                    error = new Error(e.toString()+"\n");
                    error.custom = true;
                }
                error.message += stackEntryString(fun,arguments,this)+"\n";
                throw error;
            }
        }
    }

})();