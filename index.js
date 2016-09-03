L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        maxZoom:19-8,
        data: null
    },
    messages: {},
    worker: new Worker('worker.js'),
    initialize: function (arrayBuffer) {
        var self = this
        this.worker.postMessage(arrayBuffer, [arrayBuffer])
        this.worker.onmessage = function(e) {
            var array = new Uint8Array(e.data.pixels)
            var canvas = self.messages[e.data.tileId]
            var ctx = canvas.getContext('2d')
            var imagedata = ctx.getImageData(0, 0, self.options.tileSize, self.options.tileSize)
            imagedata.data.set(array)
            ctx.putImageData(imagedata, 0, 0)
            self.tileDrawn(canvas)
        }
    },
    drawTile: function(canvas, tilePoint, zoom) {
        var tileId=tilePoint.x+":"+tilePoint.y+":"+zoom
        this.messages[tileId]=canvas
        this.worker.postMessage({
            tileId: tileId,
            zoom: zoom,
            tilePoint: tilePoint,
            tileSize: this.options.tileSize
        })
    }
});
L.tileLayer.osmTileAccessLogLayer = function(data) {
    return new L.TileLayer.OsmTileAccessLogLayer(data);
}
