importScripts('flatbush.js')
importScripts('spectrum.js')

var tree = null
var requestQueue = []

var viewX = null
var viewY = null
var viewZ = null
var viewCount = null

self.addEventListener('message', handler, false)
function handler(e) {
    if (e.data.request === 'init') {
        // initialize with file content
        console.time("build indices")
        viewX = new Uint32Array(e.data.x)
        viewY = new Uint32Array(e.data.y)
        viewZ = new Uint8Array(e.data.z)
        viewCount = new Uint32Array(e.data.count)
        tree = new Flatbush(viewCount.length, undefined, Uint32Array)
        for (var i=0; i<viewCount.length; i++) {
          tree.add(viewX[i], viewY[i], viewX[i], viewY[i])
        }
        tree.finish()
        console.timeEnd("build indices")
        self.postMessage('building spatial index')
        requestQueue.forEach(handler)
        requestQueue = null
    } else if (e.data.request === 'render') {
        if (tree === null) {
            requestQueue.push(e)
            return
        }
        // render tile
        var overzoom = e.data.overzoom || 0
        var zoom = e.data.zoom
        var tilePoint = e.data.tilePoint
        var tileSize = e.data.tileSize
        console.time("search data")
        fDataIndices = []
        tree.search(
            tilePoint.x*tileSize/Math.pow(2,overzoom),
            tilePoint.y*tileSize/Math.pow(2,overzoom),
            (tilePoint.x+1)*tileSize/Math.pow(2,overzoom)-1,
            (tilePoint.y+1)*tileSize/Math.pow(2,overzoom)-1,
            function(index) { if (viewZ[index] === zoom+8-overzoom) fDataIndices.push(index) }
        )
        console.timeEnd("search data")
        console.time("render tile")

        var pixels = new Uint32Array(tileSize*tileSize*1)
        var pixelsView = new DataView(pixels.buffer)

        fDataIndices.forEach(function(index) {
            var count = viewCount[index]
            var dataX = viewX[index]
            var dataY = viewY[index]
            var color = Math.max(0,1-(Math.log(count)-Math.log(10))/(Math.log(10000)-Math.log(10)))
            color = (parseInt(magma(color).substr(1), 16) << 8) + 255
            for (var y=(dataY*Math.pow(2,overzoom))%tileSize; y<((dataY*Math.pow(2,overzoom))%tileSize)+Math.pow(2,overzoom); y++)
              for (var x=(dataX*Math.pow(2,overzoom))%tileSize; x<((dataX*Math.pow(2,overzoom))%tileSize)+Math.pow(2,overzoom); x++)
                pixelsView.setInt32(4*(y*tileSize+x), color, false)
        })
        console.timeEnd("render tile")
        console.time("send data")
        var data = {
          answer: 'render',
          tileId: e.data.tileId,
          pixels: pixels.buffer
        }
        self.postMessage(data, [data.pixels])
        console.timeEnd("send data")
    } else if (e.data.request === 'query') {
        if (tree === null) {
            requestQueue.push(e)
            return
        }
        fDataIndices = []
        tree.search(
            e.data.x, e.data.y,
            e.data.x, e.data.y,
            function(index) { if (viewZ[index] === e.data.z) fDataIndices.push(index) }
        )
        self.postMessage({
            answer: 'query',
            x: e.data.x,
            y: e.data.y,
            z: e.data.z,
            result: fDataIndices[0] && viewCount[fDataIndices[0]]
        })
    } else {
        throw "worker received unknown request"
    }
}
