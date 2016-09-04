L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        maxZoom:19-8,
        data: null
    },
    messages: {},
    parserWorker: new Worker('parser.js'),
    worker1: new Worker('worker.js'),
    worker2: new Worker('worker.js'),
    worker3: new Worker('worker.js'),
    worker4: new Worker('worker.js'),
    initialize: function (arrayBuffer) {
        var self = this
        console.timeEnd("parse data by worker")
        this.parserWorker.postMessage({numWorkers:4, data:arrayBuffer}, [arrayBuffer])
        this.parserWorker.onmessage = function(e) {
            console.timeEnd("parse data by worker")

            self.worker1.postMessage(e.data[0], [e.data[0].x, e.data[0].y, e.data[0].z, e.data[0].count])
            self.worker2.postMessage(e.data[1], [e.data[1].x, e.data[1].y, e.data[1].z, e.data[1].count])
            self.worker3.postMessage(e.data[2], [e.data[2].x, e.data[2].y, e.data[2].z, e.data[2].count])
            self.worker4.postMessage(e.data[3], [e.data[3].x, e.data[3].y, e.data[3].z, e.data[3].count])
            self.worker1.onmessage = tileHandler
            self.worker2.onmessage = tileHandler
            self.worker3.onmessage = tileHandler
            self.worker4.onmessage = tileHandler
        }
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
            case 0: worker = this.worker1; break
            case 1: worker = this.worker2; break
            case 2: worker = this.worker3; break
            case 3: worker = this.worker4; break
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
