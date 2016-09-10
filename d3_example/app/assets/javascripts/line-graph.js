function LineGraph(argsMap) {
    var self = this;
    this.slideData = function(newData) {
        var tempData = processDataMap(newData);
        if (tempData.step != newData.step) {
            throw new Error("The step size on appended data must be the same as the existing data => " + data.step + " != " + tempData.step);
        }
        if (tempData.values[0].length == 0) {
            throw new Error("There is no data to append.");
        }
        var numSteps = tempData.values[0].length;
        tempData.values.forEach(function(dataArrays, i) {
            var existingDataArrayForIndex = data.values[i];
            dataArrays.forEach(function(v) {
                existingDataArrayForIndex.push(v);
                existingDataArrayForIndex.shift();
            })
        })
        data.startTime = new Date(data.startTime.getTime() + (data.step * numSteps));
        data.endTime = tempData.endTime;
        redrawAxes(false);
        redrawLines(false);
        if (x(numSteps * data.step) >= 0) {
            graph.selectAll("g .lines path").attr("transform", "translate(-" + x(numSteps * data.step) + ")");
        }
        handleDataUpdate();
        $(container).trigger('LineGraph:dataModification')
    }
    this.updateData = function(newData) {
        data = processDataMap(newData);
        graph.selectAll("g .lines path").data(data.values)
        redrawAxes(true);
        redrawLines(false);
        handleDataUpdate();
        $(container).trigger('LineGraph:dataModification')
    }
    this.switchToPowerScale = function() {
        yScale = 'pow';
        redrawAxes(true);
        redrawLines(true);
        $(container).trigger('LineGraph:configModification')
    }
    this.switchToLogScale = function() {
        yScale = 'log';
        redrawAxes(true);
        redrawLines(true);
        $(container).trigger('LineGraph:configModification')
    }
    this.switchToLinearScale = function() {
        yScale = 'linear';
        redrawAxes(true);
        redrawLines(true);
        $(container).trigger('LineGraph:configModification')
    }
    this.getScale = function() {
        return yScale;
    }
    var yAxisMin = -100;
    var yAxisMax = 100;
    var containerId;
    var container;
    var graph, x, yLeft, yRight, xAxis, yAxisLeft, yAxisRight, yAxisLeftDomainStart, linesGroup, linesGroupText, lines, lineFunction, lineFunctionSeriesIndex = -1;
    var yScale = 'linear';
    var scales = [
        ['linear', 'Linear']
    ];
    var hoverContainer, hoverLine, hoverLineXOffset, hoverLineYOffset, hoverLineGroup;
    var legendFontSize = 12;
    var data;
    var margin = [-1, -1, -1, -1];
    var w, h;
    var transitionDuration = 300;
    var formatNumber = d3.format(",.0f")
    var tickFormatForLogScale = function(d) {
        return formatNumber(d)
    };
    var userCurrentlyInteracting = false;
    var currentUserPositionX = -1;
    var _init = function() {
        containerId = getRequiredVar(argsMap, 'containerId');
        container = document.querySelector('#' + containerId);
        margin[0] = getOptionalVar(argsMap, 'marginTop', 20)
        margin[1] = getOptionalVar(argsMap, 'marginRight', 20)
        margin[2] = getOptionalVar(argsMap, 'marginBottom', 35)
        margin[3] = getOptionalVar(argsMap, 'marginLeft', 90)
        data = processDataMap(getRequiredVar(argsMap, 'data'));
        yScale = data.scale;
        initDimensions();
        createGraph()
        var TO = false;
        $(window).resize(function() {
            if (TO !== false)
                clearTimeout(TO);
            TO = setTimeout(handleWindowResizeEvent, 200);
        });
    }
    var processDataMap = function(dataMap) {
        var dataValues = getRequiredVar(dataMap, 'values', "The data object must contain a 'values' value with a data array.")
        var startTime = new Date(getRequiredVar(dataMap, 'start', "The data object must contain a 'start' value with the start time in milliseconds since epoch."))
        var endTime = new Date(getRequiredVar(dataMap, 'end', "The data object must contain an 'end' value with the end time in milliseconds since epoch."))
        var step = getRequiredVar(dataMap, 'step', "The data object must contain a 'step' value with the time in milliseconds between each data value.")
        var names = getRequiredVar(dataMap, 'names', "The data object must contain a 'names' array with the same length as 'values' with a name for each data value array.")
        var displayNames = getOptionalVar(dataMap, 'displayNames', names);
        var numAxisLabelsPowerScale = getOptionalVar(dataMap, 'numAxisLabelsPowerScale', 6);
        var numAxisLabelsLinearScale = getOptionalVar(dataMap, 'numAxisLabelsLinearScale', 6);
        var axis = getOptionalVar(dataMap, 'axis', []);
        if (axis.length == 0) {
            displayNames.forEach(function(v, i) {
                axis[i] = "left";
            })
        } else {
            var hasRightAxis = false;
            axis.forEach(function(v) {
                if (v == 'right') {
                    hasRightAxis = true;
                }
            })
            if (hasRightAxis) {
                margin[1] = margin[1] + 50;
            }
        }
        var colors = getOptionalVar(dataMap, 'colors', []);
        if (colors.length == 0) {
            displayNames.forEach(function(v, i) {
                colors[i] = "black";
            })
        }
        var maxValues = [];
        var rounding = getOptionalVar(dataMap, 'rounding', []);
        if (rounding.length == 0) {
            displayNames.forEach(function(v, i) {
                rounding[i] = 0;
            })
        }
        var newDataValues = [];
        dataValues.forEach(function(v, i) {
            newDataValues[i] = v.slice(0);
            maxValues[i] = d3.max(newDataValues[i])
        })
        return {
            "values": newDataValues,
            "startTime": startTime,
            "endTime": endTime,
            "step": step,
            "names": names,
            "displayNames": displayNames,
            "axis": axis,
            "colors": colors,
            "scale": getOptionalVar(dataMap, 'scale', yScale),
            "maxValues": maxValues,
            "rounding": rounding,
            "numAxisLabelsLinearScale": numAxisLabelsLinearScale,
            "numAxisLabelsPowerScale": numAxisLabelsPowerScale
        }
    }
    var redrawAxes = function(withTransition) {
        initY(yAxisMin, yAxisMax);
        initX();
        if (withTransition) {
            graph.selectAll("g .x.axis").transition().duration(transitionDuration).ease("linear").call(xAxis)
            graph.selectAll("g .y.axis.left").transition().duration(transitionDuration).ease("linear").call(yAxisLeft)
            if (yAxisRight != undefined) {
                graph.selectAll("g .y.axis.right").transition().duration(transitionDuration).ease("linear").call(yAxisRight)
            }
        } else {
            graph.selectAll("g .x.axis").call(xAxis)
            graph.selectAll("g .y.axis.left").call(yAxisLeft)
            if (yAxisRight != undefined) {
                graph.selectAll("g .y.axis.right").call(yAxisRight)
            }
        }
    }
    var redrawLines = function(withTransition) {
        lineFunctionSeriesIndex = -1;
        if (withTransition) {
            graph.selectAll("g .lines path").transition().duration(transitionDuration).ease("linear").attr("d", lineFunction).attr("transform", null);
        } else {
            graph.selectAll("g .lines path").attr("d", lineFunction).attr("transform", null);
        }
    }
    var initY = function(yAixsMinLoc, yAixsMaxLoc) {
        initYleft(yAixsMinLoc, yAixsMaxLoc);
        initYright();
    }
    var initYleft = function(min, max) {
        var maxYscaleLeft = calculateMaxY(data, 'left')
        var numAxisLabels = 6;
        if (yScale == 'pow') {
            yLeft = d3.scale.pow().exponent(0.3).domain([0, maxYscaleLeft]).range([h, 0]).nice();
            numAxisLabels = data.numAxisLabelsPowerScale;
        } else if (yScale == 'log') {
            yLeft = d3.scale.log().domain([0.1, maxYscaleLeft]).range([h, 0]).nice();
        } else if (yScale == 'linear') {
            if (data.displayNames == 'Battery SoC (%)') {
                yLeft = d3.scale.linear().domain([0, 100]).range([h, 0]).nice();
            } else {
                yLeft = d3.scale.linear().domain([min, max]).range([h, 0]).nice();
            }
            numAxisLabels = data.numAxisLabelsLinearScale;
        }
        yAxisLeft = d3.svg.axis().scale(yLeft).ticks(numAxisLabels, tickFormatForLogScale).orient("left");
    }
    var initYright = function() {
        var maxYscaleRight = calculateMaxY(data, 'right')
        if (maxYscaleRight != undefined) {
            var numAxisLabels = 6;
            if (yScale == 'pow') {
                yRight = d3.scale.pow().exponent(0.3).domain([0, maxYscaleRight]).range([h, 0]).nice();
                numAxisLabels = data.numAxisLabelsPowerScale;
            } else if (yScale == 'log') {
                yRight = d3.scale.log().domain([0.1, maxYscaleRight]).range([h, 0]).nice();
            } else if (yScale == 'linear') {
                yRight = d3.scale.linear().domain([0, maxYscaleRight]).range([h, 0]).nice();
                numAxisLabels = data.numAxisLabelsLinearScale;
            }
            yAxisRight = d3.svg.axis().scale(yRight).ticks(numAxisLabels, tickFormatForLogScale).orient("right");
        }
    }
    var calculateMaxY = function(data, whichAxis) {
        var maxValuesForAxis = [];
        data.maxValues.forEach(function(v, i) {
            if (data.axis[i] == whichAxis) {
                maxValuesForAxis.push(v);
            }
        })
        return d3.max(maxValuesForAxis);
    }
    var initX = function() {
        x = d3.time.scale().domain([data.startTime, data.endTime]).range([0, w]);
        xAxis = d3.svg.axis().scale(x).tickSize(-h).tickSubdivide(1);
    }
    var createGraph = function() {
        graph = d3.select("#" + containerId).append("svg:svg").attr("class", "line-graph").attr("width", w + margin[1] + margin[3]).attr("height", h + margin[0] + margin[2]).append("svg:g").attr("transform", "translate(" + margin[3] + "," + margin[0] + ")");
        initX()
        graph.append("svg:g").attr("class", "x axis").attr("transform", "translate(0," + h + ")").call(xAxis);
        initY(yAxisMin, yAxisMax);
        graph.append("svg:g").attr("class", "y axis left").attr("transform", "translate(-10,0)").call(yAxisLeft);
        if (yAxisRight != undefined) {
            graph.append("svg:g").attr("class", "y axis right").attr("transform", "translate(" + (w + 10) + ",0)").call(yAxisRight);
        }
        lineFunction = d3.svg.line().x(function(d, i) {
            var _x = x(data.startTime.getTime() + (data.step * i));
            return _x;
        }).y(function(d, i) {
            if (yScale == 'log' && d < 0.1) {
                d = 0.1;
            }
            if (i == 0) {
                lineFunctionSeriesIndex++;
            }
            var axis = data.axis[lineFunctionSeriesIndex];
            var _y;
            if (axis == 'right') {
                _y = yRight(d);
            } else {
                _y = yLeft(d);
            }
            return _y;
        }).defined(function(d) {
            if (d != 0) {
                return d;
            } else {
                return 0.1
            }
        });
        lines = graph.append("svg:g").attr("class", "lines").selectAll("path").data(data.values);
        hoverContainer = container.querySelector('g .lines');
        $(container).mouseleave(function(event) {
            handleMouseOutGraph(event);
        })
        $(container).mousemove(function(event) {
            handleMouseOverGraph(event);
        })
        linesGroup = lines.enter().append("g").attr("class", function(d, i) {
            return "line_group series_" + i;
        });
        linesGroup.append("path").attr("class", function(d, i) {
            return "line series_" + i;
        }).attr("fill", "none").attr("stroke", function(d, i) {
            return data.colors[i];
        }).attr("d", lineFunction).on('mouseover', function(d, i) {
            handleMouseOverLine(d, i);
        });
        linesGroupText = linesGroup.append("svg:text");
        linesGroupText.attr("class", function(d, i) {
            return "line_label series_" + i;
        }).text(function(d, i) {
            return "";
        });
        hoverLineGroup = graph.append("svg:g").attr("class", "hover-line");
        hoverLine = hoverLineGroup.append("svg:line").attr("x1", 10).attr("x2", 10).attr("y1", 0).attr("y2", h);
        hoverLine.classed("hide", true);
        createScaleButtons();
        createDateLabel();
        createLegend();
        setValueLabelsToLatest();
    }
    var createLegend = function() {
        var legendLabelGroup = graph.append("svg:g").attr("class", "legend-group").selectAll("g").data(data.displayNames).enter().append("g").attr("class", "legend-labels");
        legendLabelGroup.append("svg:text").attr("class", "legend name").text(function(d, i) {
            return d;
        }).attr("font-size", legendFontSize).attr("fill", function(d, i) {
            return data.colors[i];
        }).attr("y", function(d, i) {
            return h + 28;
        })
        legendLabelGroup.append("svg:circle").attr("class", "color-box").attr("r", "5").attr("fill", function(d, i) {
            return data.colors[i];
        }).attr("cy", function(d, i) {
            return h + 24;
        })
        legendLabelGroup.append("svg:text").attr("class", "legend value").attr("font-size", legendFontSize).attr("fill", function(d, i) {
            return data.colors[i];
        }).attr("y", function(d, i) {
            return h + 28;
        })
    }
    var redrawLegendPosition = function(animate) {
        var legendText = graph.selectAll('g.legend-group text');
        if (animate) {
            legendText.transition().duration(transitionDuration).ease("linear").attr("y", function(d, i) {
                return h + 28;
            });
        } else {
            legendText.attr("y", function(d, i) {
                return h + 28;
            });
        }
    }
    var createScaleButtons = function() {
        var cumulativeWidth = 0;
        var buttonGroup = graph.append("svg:g").attr("class", "scale-button-group").selectAll("g").data(scales).enter().append("g").attr("class", "scale-buttons").append("svg:text").attr("class", "scale-button").text(function(d, i) {
            return d[1];
        }).attr("font-size", "12").attr("fill", function(d) {
            if (d[0] == yScale) {
                return "black";
            } else {
                return "blue";
            }
        }).classed("selected", function(d) {
            if (d[0] == yScale) {
                return true;
            } else {
                return false;
            }
        }).attr("x", function(d, i) {
            var returnX = cumulativeWidth;
            cumulativeWidth += this.getComputedTextLength() + 5;
            return returnX;
        }).attr("y", -4).on('click', function(d, i) {
            handleMouseClickScaleButton(this, d, i);
        });
    }
    var handleMouseClickScaleButton = function(button, buttonData, index) {
        if (index == 0) {
            self.switchToLinearScale();
        } else if (index == 1) {
            self.switchToPowerScale();
        } else if (index == 2) {
            self.switchToLogScale();
        }
        graph.selectAll('.scale-button').attr("fill", function(d) {
            if (d[0] == yScale) {
                return "black";
            } else {
                return "blue";
            }
        }).classed("selected", function(d) {
            if (d[0] == yScale) {
                return true;
            } else {
                return false;
            }
        })
    }
    var createDateLabel = function() {
        var date = new Date();
        var buttonGroup = graph.append("svg:g").attr("class", "date-label-group").append("svg:text").attr("class", "date-label").attr("text-anchor", "end").attr("font-size", "10").attr("y", -4).attr("x", w).text(date.toDateString() + " " + date.toLocaleTimeString())
    }
    var handleMouseOverLine = function(lineData, index) {
        userCurrentlyInteracting = true;
    }
    var handleMouseOverGraph = function(event) {
        initDimensions();
        var mouseX = event.pageX - hoverLineXOffset;
        var mouseY = event.pageY - hoverLineYOffset;
        if (mouseX >= 0 && mouseX <= w && mouseY >= 0 && mouseY <= h) {
            hoverLine.classed("hide", false);
            hoverLine.attr("x1", mouseX).attr("x2", mouseX)
            displayValueLabelsForPositionX(mouseX)
            userCurrentlyInteracting = true;
            currentUserPositionX = mouseX;
        } else {
            handleMouseOutGraph(event)
        }
    }
    var handleMouseOutGraph = function(event) {
        hoverLine.classed("hide", true);
        setValueLabelsToLatest();
        userCurrentlyInteracting = false;
        currentUserPositionX = -1;
    }
    var handleDataUpdate = function() {
        if (userCurrentlyInteracting) {
            if (currentUserPositionX > -1) {
                displayValueLabelsForPositionX(currentUserPositionX)
            }
        } else {
            setValueLabelsToLatest();
        }
    }
    var displayValueLabelsForPositionX = function(xPosition, withTransition) {
        var animate = false;
        if (withTransition != undefined) {
            if (withTransition) {
                animate = true;
            }
        }
        var dateToShow;
        var labelValueWidths = [];
        graph.selectAll("text.legend.value").text(function(d, i) {
            var valuesForX = getValueForPositionXFromData(xPosition, i);
            dateToShow = valuesForX.date;
            return valuesForX.value;
        }).attr("x", function(d, i) {
            labelValueWidths[i] = this.getComputedTextLength();
        })
        var cumulativeWidth = 0;
        var labelNameEnd = [];
        var labelcolorBoxEnd = [];
        graph.selectAll("text.legend.name").attr("x", function(d, i) {
            var returnX = cumulativeWidth;
            cumulativeWidth += this.getComputedTextLength() + 8 + labelValueWidths[i] + 16;
            labelcolorBoxEnd[i] = returnX + this.getComputedTextLength() + 3;
            labelNameEnd[i] = returnX + this.getComputedTextLength() + 15;
            return returnX;
        })
        cumulativeWidth = cumulativeWidth - 8;
        if (cumulativeWidth > w) {
            legendFontSize = legendFontSize - 1;
            graph.selectAll("text.legend.name").attr("font-size", legendFontSize);
            graph.selectAll("text.legend.value").attr("font-size", legendFontSize);
            displayValueLabelsForPositionX(xPosition);
            return;
        }
        graph.selectAll("circle.color-box").attr("cx", function(d, i) {
            return labelcolorBoxEnd[i] + 3;
        })
        graph.selectAll("text.legend.value").attr("x", function(d, i) {
            return labelNameEnd[i];
        })
        graph.select('text.date-label').text(dateToShow.toDateString() + " " + dateToShow.toLocaleTimeString())
        if (animate) {
            graph.selectAll("g.legend-group g").transition().duration(transitionDuration).ease("linear").attr("transform", "translate(" + (w - cumulativeWidth) + ",0)")
        } else {
            graph.selectAll("g.legend-group g").attr("transform", "translate(" + (w - cumulativeWidth) + ",0)")
        }
    }
    var setValueLabelsToLatest = function(withTransition) {
        displayValueLabelsForPositionX(w, withTransition);
    }
    var getValueForPositionXFromData = function(xPosition, dataSeriesIndex) {
        var d = data.values[dataSeriesIndex]
        var xValue = x.invert(xPosition);
        var index = (xValue.getTime() - data.startTime) / data.step;
        if (index >= d.length) {
            index = d.length - 1;
        }
        index = Math.round(index);
        var bucketDate = new Date(data.startTime.getTime() + data.step * (index + 1));
        var v = d[index];
        var roundToNumDecimals = data.rounding[dataSeriesIndex];
        return {
            value: roundNumber(v, roundToNumDecimals),
            date: bucketDate
        };
    }
    var handleWindowResizeEvent = function() {
        initDimensions();
        initX();
        d3.select("#" + containerId + " svg").attr("width", w + margin[1] + margin[3]).attr("height", h + margin[0] + margin[2]);
        graph.selectAll("g .x.axis").attr("transform", "translate(0," + h + ")");
        if (yAxisRight != undefined) {
            graph.selectAll("g .y.axis.right").attr("transform", "translate(" + (w + 10) + ",0)");
        }
        legendFontSize = 12;
        graph.selectAll("text.legend.name").attr("font-size", legendFontSize);
        graph.selectAll("text.legend.value").attr("font-size", legendFontSize);
        graph.select('text.date-label').transition().duration(transitionDuration).ease("linear").attr("x", w)
        redrawAxes(true);
        redrawLines(true);
        redrawLegendPosition(true);
        setValueLabelsToLatest(true);
    }
    var initDimensions = function() {
        w = $("#" + containerId).width() - margin[1] - margin[3];
        h = $("#" + containerId).height() - margin[0] - margin[2];
        hoverLineXOffset = margin[3] + $(container).offset().left;
        hoverLineYOffset = margin[0] + $(container).offset().top;
    }
    var getRequiredVar = function(argsMap, key, message) {
        if (!argsMap[key]) {
            if (!message) {
                throw new Error(key + " is required")
            } else {
                throw new Error(message)
            }
        } else {
            return argsMap[key]
        }
    }
    var getOptionalVar = function(argsMap, key, defaultValue) {
        if (!argsMap[key]) {
            return defaultValue
        } else {
            return argsMap[key]
        }
    }
    var error = function(message) {
        console.log("ERROR: " + message)
    }
    var debug = function(message) {}

    function roundNumber(num, dec) {
        var result = Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
        var resultAsString = result.toString();
        if (dec > 0) {
            if (resultAsString.indexOf('.') == -1) {
                resultAsString = resultAsString + '.';
            }
            var indexOfDecimal = resultAsString.indexOf('.');
            while (resultAsString.length <= (indexOfDecimal + dec)) {
                resultAsString = resultAsString + '0';
            }
        }
        return resultAsString;
    };
     this.pullsvg = function(graph) {
       return graph;
    };
    this.updateYAxis = function(ymin, ymax) {
        yAxisMin = parseInt(ymin);
        yAxisMax = parseInt(ymax);
    }
    _init();
};