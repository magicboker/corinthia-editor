function testPositionFun(fun,granularity,direction)
{
    var lines = new Array();
    var start = new Position(document.body,0);
    var end = new Position(document.body,document.body.childNodes.length);

    start = Position_closestMatchForwards(start,Position_okForMovement);
    end = Position_closestMatchBackwards(end,Position_okForMovement);

    var pos = start;
    while (pos != null) {

        var before = textBetweenPositions(start,pos);
        var after = textBetweenPositions(pos,end);
        var total = before+"|"+after;

        var result = fun(pos,granularity,direction);
        lines.push(JSON.stringify(total)+" -- "+result+"\n");

        pos = Position_nextMatch(pos,Position_okForMovement);
    }

    return lines.join("");
}

function testPositionWithin(granularity,direction)
{
    return testPositionFun(Input_isPositionWithinTextUnitInDirection,granularity,direction);
}

function testPositionAtBoundary(granularity,direction)
{
    return testPositionFun(Input_isPositionAtBoundaryGranularityInDirection,granularity,direction);
}

function testPositionToBoundary(granularity,direction)
{
    var lines = new Array();
    var start = new Position(document.body,0);
    var end = new Position(document.body,document.body.childNodes.length);

    start = Position_closestMatchForwards(start,Position_okForMovement);
    end = Position_closestMatchBackwards(end,Position_okForMovement);

    var pos = start;
    while (pos != null) {

        var oldBefore = textBetweenPositions(start,pos);
        var oldAfter = textBetweenPositions(pos,end);
        var oldTotal = oldBefore+"|"+oldAfter;

        var resultId = Input_positionFromPositionToBoundaryInDirection(pos,granularity,direction);
        var result = Input_getPosition(resultId);

        var newBefore = textBetweenPositions(start,result);
        var newAfter = textBetweenPositions(result,end);
        var newTotal = newBefore+"|"+newAfter;

        lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");

        pos = Position_nextMatch(pos,Position_okForMovement);
    }

    return lines.join("");
}
