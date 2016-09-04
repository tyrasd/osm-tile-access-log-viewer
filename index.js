L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        maxZoom:19-8,
        data: null
    },
    messages: {},
    worker1: new Worker('worker.js'),
    worker2: new Worker('worker.js'),
    worker3: new Worker('worker.js'),
    worker4: new Worker('worker.js'),
    initialize: function (arrayBuffer1) {
        var self = this
        var arrayBuffer2 = arrayBuffer1.slice()
        var arrayBuffer3 = arrayBuffer1.slice()
        var arrayBuffer4 = arrayBuffer1.slice()
        this.worker1.postMessage({tiles:1, data:arrayBuffer1}, [arrayBuffer1])
        this.worker2.postMessage({tiles:2, data:arrayBuffer2}, [arrayBuffer2])
        this.worker3.postMessage({tiles:3, data:arrayBuffer3}, [arrayBuffer3])
        this.worker4.postMessage({tiles:0, data:arrayBuffer4}, [arrayBuffer4])
        this.worker1.onmessage = tileHandler
        this.worker2.onmessage = tileHandler
        this.worker3.onmessage = tileHandler
        this.worker4.onmessage = tileHandler
        function tileHandler(e) {
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
        var worker = null
        switch (tilePoint.x%4) {
            case 1: worker = this.worker1; break
            case 2: worker = this.worker2; break
            case 3: worker = this.worker3; break
            case 0: worker = this.worker4; break
        }
        worker.postMessage({
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
