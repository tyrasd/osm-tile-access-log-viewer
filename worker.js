importScripts('rbush.js')

var tree = null
var requestQueue = []

self.addEventListener('message', handler, false)
function handler(e) {
    if (e.data.request === 'init') {
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
        fData = tree.search({
            minX: tilePoint.x*tileSize/Math.pow(2,overzoom),
            minY: tilePoint.y*tileSize/Math.pow(2,overzoom),
            maxX: (tilePoint.x+1)*tileSize/Math.pow(2,overzoom)-1,
            maxY: (tilePoint.y+1)*tileSize/Math.pow(2,overzoom)-1
        }).filter(function(d) { return d.zoom === zoom+8-overzoom })
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
            for (var y=(d.minY*Math.pow(2,overzoom))%tileSize; y<((d.minY*Math.pow(2,overzoom))%tileSize)+Math.pow(2,overzoom); y++)
              for (var x=(d.minX*Math.pow(2,overzoom))%tileSize; x<((d.minX*Math.pow(2,overzoom))%tileSize)+Math.pow(2,overzoom); x++)
                pixels[y*tileSize + x] = colorbrewer[cat]
        })
        console.timeEnd("render tile")
        console.time("send data")
        var data = {
          answer: 'render',
          tileId: e.data.tileId,
          pixels: (new Uint32Array(pixels)).buffer
        }
        self.postMessage(data, [data.pixels])
        console.timeEnd("send data")
    } else if (e.data.request === 'query') {
        if (tree === null) {
            requestQueue.push(e)
            return
        }
        fData = tree.search({
            minX: e.data.x,
            maxX: e.data.x,
            minY: e.data.y,
            maxY: e.data.y
        }).filter(function(d) { return d.zoom === e.data.z })
        self.postMessage({
            answer: 'query',
            x: e.data.x,
            y: e.data.y,
            z: e.data.z,
            result: (fData[0] || {}).count
        })
    } else {
        throw "worker received unknown request"
    }
}
