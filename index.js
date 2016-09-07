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
    initialize: function (arrayBuffer, doneCallback) {
        var self = this
        console.time("parse data by worker")
        this.workers = Array.apply(null, new Array(this.numWorkers)).map(function() {return new Worker('worker.js')})
        this.parserWorker.postMessage({numWorkers:this.numWorkers, data:arrayBuffer}, [arrayBuffer])
        this.parserWorker.onmessage = function(e) {
            if (typeof e.data === 'string') {
                var processingDiv = document.getElementById('processing')
                processingDiv.textContent = e.data
                return
            }
            console.timeEnd("parse data by worker")

            self.workers.forEach(function(worker, index) {
                e.data[index].request = 'init'
                worker.postMessage(e.data[index], [e.data[index].x, e.data[index].y, e.data[index].z, e.data[index].count])
                worker.onmessage = tileHandler
            })
            self._map.on('click', function(e) {
                var coords = self._map.project(e.latlng)
                coords.x = Math.round(coords.x)
                coords.y = Math.round(coords.y)
                var worker = self.workers[Math.floor(coords.x/256) % self.numWorkers]
                worker.postMessage({
                    request: 'query',
                    x: coords.x,
                    y: coords.y,
                    z: self._map.getZoom()+8
                })
                //worker.onmessage(
                map.openPopup(
                    '<p>tile '+(self._map.getZoom()+8)+'/'+coords.x+'/'+coords.y+' was accessed <span id="clicked-count">'+'?'+'</span> times</p>' +
                    '<img src="https://a.tile.openstreetmap.org/'+(self._map.getZoom()+8)+'/'+coords.x+'/'+coords.y+'.png'+'" />',
                    e.latlng, {
                    minWidth:256
                })
            })
        }
        function tileHandler(e) {
            if (typeof e.data === 'string') {
                var processingDiv = document.getElementById('processing')
                processingDiv.count = (processingDiv.count || 0)+1
                processingDiv.textContent = e.data + ' (' + Math.round(100*processingDiv.count/self.numWorkers) + '%)'
                if (doneCallback && processingDiv.count == self.numWorkers) doneCallback()
            } else if (e.data.answer === 'render') {
                var array = new Uint8Array(e.data.pixels)
                var canvas = self.canvasCache[e.data.tileId]
                delete self.canvasCache[e.data.tileId]
                var ctx = canvas.getContext('2d')
                var imagedata = ctx.getImageData(0, 0, self.options.tileSize, self.options.tileSize)
                imagedata.data.set(array)
                ctx.putImageData(imagedata, 0, 0)
                self.tileDrawn(canvas)
            } else if (e.data.answer === 'query') {
                document.getElementById('clicked-count').textContent = e.data.result || '<10'
            } else {
                throw "Undefined answer returned by worker"
            }
        }
    },
    drawTile: function(canvas, tilePoint, zoom) {
        var tileId=tilePoint.x+":"+tilePoint.y+":"+zoom
        this.canvasCache[tileId]=canvas
        var worker = this.workers[((tilePoint.x % this.numWorkers) + this.numWorkers) % this.numWorkers]
        worker.postMessage({
            request: 'render',
            tileId: tileId,
            zoom: zoom,
            tilePoint: tilePoint,
            tileSize: this.options.tileSize
        })
    }
});
L.tileLayer.osmTileAccessLogLayer = function(data, doneCallback) {
    return new L.TileLayer.OsmTileAccessLogLayer(data, doneCallback);
}
