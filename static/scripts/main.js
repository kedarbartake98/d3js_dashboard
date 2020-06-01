window.onload = function(){
    start_rendering(document);
};

function start_rendering(document)
{
    // Start plotting the Parallel Coordinates
    //get the height/width of the svg element
    var parcor = document.getElementById("parcorcont");

    var height = parcor.clientHeight,
        width = parcor.clientWidth;

    var margin = {top: 50, left: 50, bottom:50, right:50},
        width = parcor.clientWidth - margin.left - margin.right,
        height = parcor.clientHeight - margin.top -margin.bottom,
        innerHeight = height-2;

    var color = d3.scaleOrdinal()
                  .domain(["1Fam", "2fmCon", "Duplex", "Twnhs", "TwnhsE"])
                  .range(["cyan" ,"Green", "Blue", "Orange", "Purple"])

    var types = 
    {
      "Number": {
        key: "Number",
        coerce: function(d) { return +d; },
        extent: d3.extent,
        within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
        defaultScale: d3.scaleLinear().range([innerHeight, 20])
      },
      "String": {
        key: "String",
        coerce: String,
        extent: function (data) { return data.sort(); },
        within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
        defaultScale: d3.scalePoint().range([20, innerHeight])
      },
      "Date": {
        key: "Date",
        coerce: function(d) { return new Date(d); },
        extent: d3.extent,
        within: function(d, extent, dim) { return extent[0] <= dim.scale(d) && dim.scale(d) <= extent[1]; },
        defaultScale: d3.scaleTime().range([innerHeight, 20])
      }
    };

    var dimensions = 
    [
        {
            key: "BldgType",
            description: "Type of Dwelling",
            type: types["String"]
        },

        {
            key: "FullBath",
            description: "Bathrooms",
            type: types["String"]
        },

        {
            key: "BedroomAbvGr",
            description: "Bedrooms",
            type: types["Number"]
        },

        {
            key: "GrLivArea",
            description: "Square Footage",
            type: types["Number"]
        },

        {
            key: "LotArea",
            type: types["Number"]
        },

        {
            key: "GarageArea",
            description: "Garage Area",
            type: types["Number"]
        },

        {
            key: "YearBuilt",
            description: "Year",
            type: types["Date"]
        },

        {
            key: "SalePrice",
            description: "Price",
            type: types["Number"]
        },

    ];

    var xscale = d3.scalePoint()
                   .domain(d3.range(dimensions.length))
                   .range([0, width]);

    var yAxis = d3.axisLeft();

    var container = d3.select("#parcorcont")
                      .append("div")
                      .attr("class", "parcoords")
                      .style("position", "relative")
                      .style("width", width + margin.left + margin.right + "px")
                      .style("height", height + margin.top + margin.bottom + "px");

    var svg = container.append("svg")
                       .attr("width", width + margin.left + margin.right)
                       .attr("height", height + margin.top + margin.bottom)
                       .style("position", "absolute")
                       .append("g")
                       .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    var canvas = container.append("canvas")
                          .attr("width", width )
                          .attr("height", height)
                          .style("width", width + "px")
                          .style("height", height + "px")
                          .style("margin-top", margin.top + "px")
                          .style("margin-left", margin.left + "px");
        
    var ctx = canvas.node().getContext("2d");
    ctx.globalCompositeOperation = 'darken';
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 1.5;


    var axes = svg.selectAll(".axis")
                  .data(dimensions)
                  .enter().append("g")
                  .attr("class", function(d) { return "axis " + d.key.replace(/ /g, "_"); })
                  .attr("transform", function(d,i) { return "translate(" + xscale(i) + ")"; });

    d3.csv("static\\data\\train.csv", function(error, data) {
        if (error) throw error;

        data.forEach(function(d) {
            dimensions.forEach(function(p) {
                d[p.key] = !d[p.key] ? null : p.type.coerce(d[p.key]);
            });

            // truncate long text strings to fit in data table
            for (var key in d) {
                if (d[key] && d[key].length > 35) d[key] = d[key].slice(0,36);
            }
        });

      // type/dimension default setting happens here
      dimensions.forEach(function(dim) {
        if (!("domain" in dim)) {
          // detect domain using dimension type's extent function
          dim.domain = d3_functor(dim.type.extent)(data.map(function(d) { return d[dim.key]; }));
        }
        if (!("scale" in dim)) {
          // use type's default scale for dimension
          dim.scale = dim.type.defaultScale.copy();
        }
        dim.scale.domain(dim.domain);
      });

      var render = renderQueue(draw).rate(30);

      ctx.clearRect(0,0,width,height);
      ctx.globalAlpha = d3.min([1.15/Math.pow(data.length,0.3),1]);
      render(data);

      axes.append("g")
          .each(function(d) {
            var renderAxis = "axis" in d ? d.axis.scale(d.scale) : yAxis.scale(d.scale);  // default axis
            d3.select(this).call(renderAxis);
          })
        .append("text")
          .attr("class", "title")
          .attr("text-anchor", "start")
          .attr("transform", "translate(-5,-6)")
          .attr("font-size", 10)
          .attr("stroke", "#000")
          .text(function(d) { return "description" in d ? d.description : d.key; });

      // Add and store a brush for each axis.
      axes.append("g")
          .attr("class", "brush")
          .each(function(d) {
            d3.select(this).call(d.brush = d3.brushY()
              .extent([[-10,0], [10,height]])
              .on("start", brushstart)
              .on("brush", brush)
              .on("end", brush)
            )
          })
        .selectAll("rect")
          .attr("x", -8)
          .attr("width", 16);

      d3.selectAll(".axis.BldgType .tick text")
        .style("fill", color);
        
        plot_rest(data);
      // output.text(d3.tsvFormat(data.slice(0,24)));

      function project(d) {
        return dimensions.map(function(p,i) {
          // check if data element has property and contains a value
          if (
            !(p.key in d) ||
            d[p.key] === null
          ) return null;

          return [xscale(i),p.scale(d[p.key])];
        });
      };

      function draw(d) {
        ctx.strokeStyle = color(d.BldgType);
        ctx.beginPath();
        var coords = project(d);
        coords.forEach(function(p,i) {
          // this tricky bit avoids rendering null values as 0
          if (p === null) {
            // this bit renders horizontal lines on the previous/next
            // dimensions, so that sandwiched null values are visible
            if (i > 0) {
              var prev = coords[i-1];
              if (prev !== null) {
                ctx.moveTo(prev[0],prev[1]);
                ctx.lineTo(prev[0]+6,prev[1]);
              }
            }
            if (i < coords.length-1) {
              var next = coords[i+1];
              if (next !== null) {
                ctx.moveTo(next[0]-6,next[1]);
              }
            }
            return;
          }
          
          if (i == 0) {
            ctx.moveTo(p[0],p[1]);
            return;
          }

          ctx.lineTo(p[0],p[1]);
        });
        ctx.stroke();
      }

      function brushstart() {
        d3.event.sourceEvent.stopPropagation();
      }

      // Handles a brush event, toggling the display of foreground lines.
      function brush() {
        render.invalidate();

        var actives = [];
        svg.selectAll(".axis .brush")
          .filter(function(d) {
            return d3.brushSelection(this);
          })
          .each(function(d) {
            actives.push({
              dimension: d,
              extent: d3.brushSelection(this)
            });
          });

        var selected = data.filter(function(d) {
          if (actives.every(function(active) {
              var dim = active.dimension;
              // test if point is within extents for each active brush
              return dim.type.within(d[dim.key], active.extent, dim);
            })) {
            return true;
          }
        });
        // console.log(selected);
        ctx.clearRect(0,0,width,height);
        ctx.globalAlpha = d3.min([0.85/Math.pow(selected.length,0.3),1]);
        render(selected);

        plot_rest(selected);
      }

    function plot_rest(datapoints)
    {
        // ScatterPlot
        var scatter_cont = d3.select("#QualvsCond")
        scatter_cont.selectAll("*").remove();

        var scatter = document.getElementById("QualvsCond");

        var sc_width = scatter.clientWidth - margin.left - margin.right,
            sc_height = scatter.clientHeight - margin.top - margin.bottom,
            int_height = sc_height - 50;

        var scatter = d3.select("#QualvsCond")
                        .append("g")
                        .attr("width", sc_width+margin.left+margin.right)
                        .attr("height", sc_height+margin.top+margin.bottom)
                        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

        var sc_xScale = d3.scaleLinear().range([0, sc_width]),
            sc_yScale = d3.scaleLinear().range([int_height,0]);    

        sc_yScale.domain([0,10]);
        sc_xScale.domain([0,10]);   

        scatter.append("g")
             .attr("transform","translate(0,"+int_height+")")
             .call(d3.axisBottom(sc_xScale).tickFormat(function(d){
                return d;
             }))
             .append("text")
             .attr("y", 30)
             .attr("x", sc_width/2)
             .attr("text-anchor", "middle")
             .attr("stroke", "black")
             .text("Overall Condition");  

        scatter.append("g")
         .call(d3.axisLeft(sc_yScale).tickFormat(function(d){
            return d;
         }).ticks(10))
           .append("text")
           .attr("transform","rotate(-90) translate(-150,10)")
           .attr("y",10)
           .attr("dy", "-5.1em")
           .attr("text-anchor", "middle")
           .attr("stroke", "black")
           .text("Overall Quality");

        var sc_plot = scatter.append('g')
            .selectAll("dot")
            .data(datapoints)
            .enter()
            .append("circle")
              .attr("cx", function (d) { return sc_xScale(d["OverallCond"]); } )
              .attr("cy", function (d) { return sc_yScale(d["OverallQual"]); } )
              .attr("r", 2)
              .style("fill", "red");
              // .style("fill", "#69b3a2")     

        // scatter.call(d3.brush()
        //                .extent([[0,0], [sc_width, sc_height]]))
        //                .on("end", sc_brushstart);
        // scatter.append("g")
        //        .attr("class", "brush")
        //        .call(d3.brush()
        //                .extent([[0,0], [sc_width, int_height]])
        //                .on("end", sc_brush));

        // function sc_brush()
        // {
        //     console.log("scatterplot brushed");
        //     var sel_extent = d3.event.selection,
        //         xmin = sc_xScale.invert(sel_extent[0][0]),
        //         ymax = sc_xScale.invert(sel_extent[0][1]),
        //         xmax = sc_yScale.invert(sel_extent[1][0]),
        //         ymin = sc_yScale.invert(sel_extent[1][1]);

        //     console.log("Selected extent", sel_extent);           

        //     console.log(xmin, xmax, ymin, ymax);

        //     var datapts = datapoints.map(function(d){
        //         // console.log("apply");
        //         d['OverallCond']=+d['OverallCond'];
        //         d['OverallQual']=+d['OverallQual'];
        //         return d;
        //     });

        //     var filtered_data = datapts.filter(function(d){

        //         if ((xmin<=d["OverallCond"]<=xmax) && (ymin<=d["OverallQual"]<=ymax)) 
        //                 {
        //                     console.log("True found");
        //                     return true;
        //                 }
        //     });

        //     console.log(filtered_data);
        //     // plot_rest(filtered_data);
        //     // console.log("vapas Parallel");
        //     // ctx.clearRect(0,0,width,height);
        //     // ctx.globalAlpha = d3.min([0.85/Math.pow(datapoints.length,0.3),1]);
        //     // render(filtered_data);
        // };

        //Bar Graph

        // console.log("bar graph");

        var barcont = d3.select("#HouseStyle")
        barcont.selectAll('*').remove();

        var bardiv = document.getElementById("HouseStyle"),
            bar_height = bardiv.clientHeight-margin.top-margin.bottom,
            bar_width = bardiv.clientWidth-margin.left-margin.right,
            int_height = bar_height-50;

        var bargraph = d3.select("#HouseStyle")
                        .append("g")
                        .attr("width", bar_width+margin.left+margin.right)
                        .attr("height", bar_height+margin.top+margin.bottom)
                        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

        var bar_xScale = d3.scaleBand().range([0, bar_width]).padding(0.4),
            bar_yScale = d3.scaleLinear().range([int_height, 0]);

        var valuecounts = d3.nest()
                            .key(function(d) {return d["HouseStyle"];})
                            .rollup(function(v) {return v.length;})
                            .entries(datapoints);
        // console.log(valuecounts);

        bar_xScale.domain(valuecounts.map(function(d){return d["key"];}));
        bar_yScale.domain([0, d3.max(valuecounts, function(d){ return d['value'];})]);

        bargraph.selectAll(".bar")
                .data(valuecounts)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) {return bar_xScale(d['key']);})
                .attr("width", bar_xScale.bandwidth())
                .attr("y", function(d) {return bar_yScale(d['value']);})
                .attr("height", function(d) {return int_height-bar_yScale(d['value']);})
                .style("fill", "orange");


        bargraph.append("g")
              .attr("transform", "translate(0," + int_height + ")")
              .call(d3.axisBottom(bar_xScale))
              .append("text")
              .attr("y", 30)
              .attr("x", bar_width/2)
              .attr("text-anchor", "middle")
              .attr("stroke", "black")
              .text("Types of Houses")
              .style("font-size", 14);;

        bargraph.append("g")
              .call(d3.axisLeft(bar_yScale))
              .append("text")
              .attr("transform","rotate(-90) translate(-150,10)")
              .attr("y", 10)
              .attr("dy", "-5.1em")
              .attr("text-anchor", "middle")
              .attr("stroke", "black")
              .text("Number of Houses");


        var barcont = d3.select("#PCA")
        barcont.selectAll('*').remove();

        var bardiv = document.getElementById("PCA"),
            bar_height = bardiv.clientHeight-margin.top-margin.bottom,
            bar_width = bardiv.clientWidth-margin.left-margin.right,
            int_height = bar_height-50;

        var bargraph = d3.select("#PCA")
                        .append("g")
                        .attr("width", bar_width+margin.left+margin.right)
                        .attr("height", bar_height+margin.top+margin.bottom)
                        .attr("transform","translate(" + margin.left + "," + margin.top + ")");

        var bar_xScale = d3.scaleBand().range([0, bar_width]).padding(0.4),
            bar_yScale = d3.scaleLinear().range([int_height, 0]);

        var valuecounts = d3.nest()
                            .key(function(d) {return d["Neighborhood"];})
                            .rollup(function(v) {return v.length;})
                            .entries(datapoints);
        // console.log(valuecounts);

        bar_xScale.domain(valuecounts.map(function(d){return d["key"];}));
        bar_yScale.domain([0, d3.max(valuecounts, function(d){ return d['value'];})]);

        bargraph.selectAll(".bar")
                .data(valuecounts)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function(d) {return bar_xScale(d['key']);})
                .attr("width", bar_xScale.bandwidth())
                .attr("y", function(d) {return bar_yScale(d['value']);})
                .attr("height", function(d) {return int_height-bar_yScale(d['value']);})
                .style("fill", "blue");


        bargraph.append("g")
              .attr("transform", "translate(0," + int_height + ")")
              .call(d3.axisBottom(bar_xScale))
              .selectAll("text")
              .attr("transform", "rotate(-30) translate(-30,0)");

        bargraph.append("g")
              .attr("transform", "translate(0," + int_height + ")")
              .append("text")
              .attr("y", 55)
              .attr("x", bar_width/2)
              .attr("text-anchor", "middle")
              .attr("stroke", "black")
              .text("Neighborhood");

        bargraph.append("g")
              .call(d3.axisLeft(bar_yScale))
              .append("text")
              .attr("transform","rotate(-90) translate(-150,10)")
              .attr("y", 10)
              .attr("dy", "-5.1em")
              .attr("text-anchor", "middle")
              .attr("stroke", "black")
              .text("Number of Houses");


        piechartcont = d3.select("#Dummy");
        piechartcont.selectAll('*').remove();

        var piediv = document.getElementById("Dummy"),
            pie_height = piediv.clientHeight-margin.top-margin.bottom,
            pie_width = piediv.clientWidth-margin.left-margin.right,
            innerHeight = pie_height-10;

        var piechart = d3.select("#Dummy")
                        .append("g")
                        .attr("width", pie_width)
                        .attr("height", innerHeight)
                        .attr("transform","translate(" + 200 + "," + 200 + ")");

        var pie_data = d3.nest()
                         .key(function(d){ return d["LotShape"];})
                         .rollup(function(v) {return v.length;})
                         .object(datapoints);

        console.log(pie_data);                         
        var colors = [];

        var radius = Math.min(pie_width, innerHeight) / 2 -10 ;

        var colors = [ "Orange", "Magenta", "Cyan", "Brown", "Pink"];

        var piecolor = d3.scaleOrdinal()
                         .domain(pie_data)
                         .range(colors.slice(0,pie_data.length));

        var pie = d3.pie()
                    .value(function(d){ return d.value;})

        var data_ready = pie(d3.entries(pie_data));

        console.log(data_ready);

        piechart.selectAll("mySlices")
                .data(data_ready)
                .enter()
                .append('path')
                .attr("d", d3.arc()
                           .innerRadius(0)
                           .outerRadius(radius)
                )
                .style("fill", function(d) {return piecolor(d.data.key);})
                .attr("stroke", "black")
                .style("stroke-width", "2px")
                .style("opacity", 0.8);

        piechart.selectAll('mySlices')
          .data(data_ready)
          .enter()
          .append('text')
          .text(function(d){ return d.data.key})
          .attr("transform", function(d) { return "translate(" + d3.arc().innerRadius(0).outerRadius(radius).centroid(d) + ")";  })
          .style("text-anchor", "middle")
          .style("font-size", 17);

        piechart.append("g")
              .attr("transform", "translate(-100," + innerHeight-20+ ")")
              .append("text")
              .attr("y", 25)
              .attr("x", pie_width/2)
              .attr("text-anchor", "middle")
              .attr("stroke", "black")
              .text("Lot Shape");
        };

    });
}

function d3_functor(v) {
  return typeof v === "function" ? v : function() { return v; };
};

