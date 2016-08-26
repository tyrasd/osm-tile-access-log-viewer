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
        fData = this.options.data.search({
            minX: tilePoint.x*256,
            minY: tilePoint.y*256,
            maxX: (tilePoint.x+1)*256-1,
            maxY: (tilePoint.y+1)*256-1
        }).filter(function(d) { return d[0] === zoom+8 })

        var ctx = canvas.getContext('2d');
        // draw something on the tile canvas
        var pixel = ctx.createImageData(1,1);
        var pixeldata = pixel.data;

        var colorbrewer = [[253,224,221],[252,197,192],[250,159,181],[247,104,161],[221,52,151],[174,1,126],[122,1,119]];

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
