L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: false,
        maxZoom:19-8,
        data: null
    },
    initialize: function (data) {
        console.log("Loaded data!")
        data = data.split("\n")
        data.pop() // newline at the end
        data = data.map(function(line) {
            return line.split(/[ \/]/).map(Number)
        })
        var tree = rbush(9, ['[1]', '[2]', '[1]', '[2]'])
        tree.load(data)
        this.options.data = tree
        console.log("Indices created!")
    },
    drawTile: function(canvas, tilePoint, zoom) {
        fData = this.options.data.search([tilePoint.x*256, tilePoint.y*256, (tilePoint.x+1)*256-1, (tilePoint.y+1)*256-1]).filter(function(d) { return d[0] === zoom+8 })

        var ctx = canvas.getContext('2d');
        // draw something on the tile canvas
        var pixel = ctx.createImageData(1,1);
        var pixeldata = pixel.data;

        var colorbrewer = [[253,224,221],[252,197,192],[250,159,181],[247,104,161],[221,52,151],[174,1,126],[122,1,119]];

        //pixeldata[0] = 255; pixeldata[1] = 0; pixeldata[2] = 0;
        pixeldata[3] = 255

        fData.forEach(function(d) {
            var cat = Math.max(Math.floor(2*Math.log(d[3])/Math.log(10))-1,0)
            cat = Math.min(cat, colorbrewer.length-1)
            pixeldata[0] = colorbrewer[cat][0]
            pixeldata[1] = colorbrewer[cat][1]
            pixeldata[2] = colorbrewer[cat][2]
            ctx.putImageData( pixel, d[1]%256, d[2]%256 )
        })
    }
});
L.tileLayer.osmTileAccessLogLayer = function(data) {
    return new L.TileLayer.OsmTileAccessLogLayer(data);
}

/*
get('./tile_logs/tiles-2014-05-12.csv').then(function(response) {
//get('tiles-2015-05-28.txt.xz').then(function(response) {
    loadLogs(response);
}, function(error) {
    console.error("Failed loading data!", error);
});
*/

function loadLogs(data) {
    console.log("Loaded data!")
    data = data.split("\n")
    data.pop()
    data = data.map(function(line) {
        return line.split(" ").map(Number)
    })
    var tree = rbush(9, ['[1]', '[2]', '[1]', '[2]'])
    tree.load(data)
    console.log("Indices created!")
    drawCanvas(tree)
}

function drawCanvas(data) {
    //var canvasTiles = L.tileLayer.canvas()
    /*
    var zoomIndex = []
    var actZoom = -1
    data.forEach(function(d, index) {
        if (d.zoom > actZoom) {
            zoomIndex[d.zoom] = index
            actZoom = d.zoom
        }
    })
    zoomIndex[actZoom+1] = data.length
    // fixme: theoretically, there could be gaps in zoom Index
    */

    canvasTiles.drawTile = function(canvas, tilePoint, zoom) {
        //console.log(tilePoint, zoom);
        /*var fData = data.filter(function(d) {
            return d[0] === zoom+8 &&
                   d[1] >= tilePoint.x*256 && d[1] < (tilePoint.x+1)*256 &&
                   d[2] >= tilePoint.y*256 && d[2] < (tilePoint.y+1)*256
        })*/
        /*var fData = []
        var minX = -Infinity,
            maxX = Infinity
        for (var i=zoomIndex[zoom]; i<zoomIndex[zoom+1]; i++) {
            if ()
            fData.push(data[i])
        }*/
        fData = data.search([tilePoint.x*256, tilePoint.y*256, (tilePoint.x+1)*256-1, (tilePoint.y+1)*256-1]).filter(function(d) { return d[0] === zoom+8 })

        var ctx = canvas.getContext('2d');
        // draw something on the tile canvas
        var pixel = ctx.createImageData(1,1);
        var pixeldata = pixel.data;

        var colorbrewer = [[255,247,243],[253,224,221],[252,197,192],[250,159,181],[247,104,161],[221,52,151],[174,1,126],[122,1,119]];

        //pixeldata[0] = 255; pixeldata[1] = 0; pixeldata[2] = 0;
        pixeldata[3] = 255

        fData.forEach(function(d) {
            var cat = Math.floor(2*Math.log(d[3])/Math.log(10))
            cat = Math.min(cat, colorbrewer.length-1)
            pixeldata[0] = colorbrewer[cat][0]
            pixeldata[1] = colorbrewer[cat][1]
            pixeldata[2] = colorbrewer[cat][2]
            ctx.putImageData( pixel, d[1]%256, d[2]%256 )
        })

        /*for (var i=0; i<100; i++)
            ctx.putImageData( pixel, Math.floor(Math.random()*256), Math.floor(Math.random()*256) );*/
    }

//    canvasTiles.addTo(map);
}



/*
 * utility functions
 */

function get(url) {
  // Return a new promise.
  return new Promise(function(resolve, reject) {
    // Do the usual XHR stuff
    var req = new XMLHttpRequest();
    req.open('GET', url);

    req.onload = function() {
      // This is called even on 404 etc
      // so check the status
      if (req.status == 200) {
        // Resolve the promise with the response text
        resolve(req.response);
      }
      else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(Error(req.statusText));
      }
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    };

    // Make the request
    req.send();
  });
}
