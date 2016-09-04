importScripts('rbush.js')

var tree = null
var tileQueue = []

self.addEventListener('message', handler, false)
function handler(e) {
    if (e.data.x instanceof ArrayBuffer) {
        // initialize with file content
        console.time("load data")
        var viewX = new Uint32Array(e.data.x)
        var viewY = new Uint32Array(e.data.y)
        var viewZ = new Uint8Array(e.data.z)
        var viewCount = new Uint32Array(e.data.count)
        var data = []
        for (var i=0; i<viewX.length; i++) {
            data.push({
                minX: viewX[i],
                maxX: viewX[i],
                minY: viewY[i],
                maxY: viewY[i],
                zoom: viewZ[i],
                count: viewCount[i]
            })
        }
        e.data = null; viewX = null; viewY = null; viewZ = null; viewCount = null // don't need
        console.timeEnd("load data")
        console.time("build indices")
        tree = rbush()
        tree.load(data)
        console.timeEnd("build indices")
        self.postMessage('building spatial index')
        tileQueue.forEach(handler)
        tileQueue = null
    } else {
        if (tree === null) {
            tileQueue.push(e)
            return
        }
        // render tile
        var zoom = e.data.zoom
        var tilePoint = e.data.tilePoint
        var tileSize = e.data.tileSize
        console.time("search data")
        fData = tree.search({
            minX: tilePoint.x*tileSize,
            minY: tilePoint.y*tileSize,
            maxX: (tilePoint.x+1)*tileSize-1,
            maxY: (tilePoint.y+1)*tileSize-1
        }).filter(function(d) { return d.zoom === zoom+8 })
        console.timeEnd("search data")
        console.time("render tile")

        var colorbrewer = new Uint32Array(new Uint8Array([
            [253,224,221, 255],
            [252,197,192, 255],
            [250,159,181, 255],
            [247,104,161, 255],
            [221,52,151, 255],
            [174,1,126, 255],
            [122,1,119, 255],
        ].reduce((a,b) => a.concat(b))
        ).buffer);

        var pixels = new Array(tileSize*tileSize)

        fData.forEach(function(d) {
            var cat = Math.max(Math.floor(2*Math.log(d.count)/Math.log(10))-1,0)
            cat = Math.min(cat, colorbrewer.length-1)
            pixels[(d.minY%tileSize) * tileSize + (d.minX%tileSize)] = colorbrewer[cat]
        })
        console.timeEnd("render tile")
        console.time("send data")
        var data = {
          tileId: e.data.tileId,
          pixels: (new Uint32Array(pixels)).buffer
        }
        self.postMessage(data, [data.pixels])
        console.timeEnd("send data")
    }
}
