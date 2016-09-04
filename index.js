L.TileLayer.OsmTileAccessLogLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        maxZoom:19-8,
        data: null
    },
    canvasCache: {},
    parserWorker: new Worker('parser.js'),
    numWorkers: navigator.hardwareConcurrency || 1,
    workers: [],
    initialize: function (arrayBuffer) {
        var self = this
        console.timeEnd("parse data by worker")
        this.workers = Array.apply(null, new Array(this.numWorkers)).map(function() {return new Worker('worker.js')})
        this.parserWorker.postMessage({numWorkers:this.numWorkers, data:arrayBuffer}, [arrayBuffer])
        this.parserWorker.onmessage = function(e) {
            console.timeEnd("parse data by worker")

            self.workers.forEach(function(worker, index) {
                worker.postMessage(e.data[index], [e.data[index].x, e.data[index].y, e.data[index].z, e.data[index].count])
                worker.onmessage = tileHandler
            })
        }
        function tileHandler(e) {
            var array = new Uint8Array(e.data.pixels)
            var canvas = self.canvasCache[e.data.tileId]
            delete self.canvasCache[e.data.tileId]
            var ctx = canvas.getContext('2d')
            var imagedata = ctx.getImageData(0, 0, self.options.tileSize, self.options.tileSize)
            imagedata.data.set(array)
            ctx.putImageData(imagedata, 0, 0)
            self.tileDrawn(canvas)
        }
    },
    drawTile: function(canvas, tilePoint, zoom) {
        var tileId=tilePoint.x+":"+tilePoint.y+":"+zoom
        this.canvasCache[tileId]=canvas
        var worker = this.workers[tilePoint.x % this.numWorkers]
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
