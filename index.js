L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: false,
        maxZoom:19-8,
        data: null
    },
    initialize: function (data) {
        console.time("parse data")
        data = data.split("\n")
        data.pop() // newline at the end
        data = data.map(function(line) {
            line = line.split(' ')
            var coords = line[0].split('/')
            return {
              x: +coords[1],
              y: +coords[2],
              zoom: +coords[0],
              count: +line[1]
            }
        })
        console.timeEnd("parse data")
        console.time("build indices")
        var tree = rbush(9, ['.x', '.y', '.x', '.y'])
        tree.load(data)
        this.options.data = tree
        console.timeEnd("build indices")
    },
    drawTile: function(canvas, tilePoint, zoom) {
        console.time("search data")
        fData = this.options.data.search({
            minX: tilePoint.x*256,
            minY: tilePoint.y*256,
            maxX: (tilePoint.x+1)*256-1,
            maxY: (tilePoint.y+1)*256-1
        }).filter(function(d) { return d.zoom === zoom+8 })
        console.timeEnd("search data")

        var ctx = canvas.getContext('2d');
        // draw something on the tile canvas
        var pixel = ctx.createImageData(1,1);
        var pixeldata = pixel.data;

        var colorbrewer = [[253,224,221],[252,197,192],[250,159,181],[247,104,161],[221,52,151],[174,1,126],[122,1,119]];

        pixeldata[3] = 255

        fData.forEach(function(d) {
            var cat = Math.max(Math.floor(2*Math.log(d.count)/Math.log(10))-1,0)
            cat = Math.min(cat, colorbrewer.length-1)
            pixeldata[0] = colorbrewer[cat][0]
            pixeldata[1] = colorbrewer[cat][1]
            pixeldata[2] = colorbrewer[cat][2]
            ctx.putImageData( pixel, d.x%256, d.y%256 )
        })
    }
});
L.tileLayer.osmTileAccessLogLayer = function(data) {
    return new L.TileLayer.OsmTileAccessLogLayer(data);
}
