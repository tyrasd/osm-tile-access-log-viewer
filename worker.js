importScripts('rbush.js')

var tree = null;

self.addEventListener('message', function(e) {
    if (e.data.data instanceof ArrayBuffer) {
        // initialize with file content
        console.time("parse data")
        var view = new Uint8Array(e.data.data)
        var data = []
        var currentInt = 0
        var currentCoords = []
        for (var i = 0; i<view.length; i++) {
            switch (view[i]) {
            default:
              currentInt = currentInt*10 + (view[i] - 48 /*'0'*/)
            break;
            case 10: // '\n'
                if (~~(currentCoords[1]/256)%4 === e.data.tiles) {
                    data.push({
                        minX: currentCoords[1],
                        maxX: currentCoords[1],
                        minY: currentCoords[2],
                        maxY: currentCoords[2],
                        zoom: currentCoords[0],
                        count: currentInt
                    })
                }
                currentCoords = []
                currentInt = 0
            break;
            case 32: // ' '
            case 47: // '/'
                currentCoords.push(currentInt)
                currentInt = 0
            break;
            }
        }
        console.timeEnd("parse data")
        console.time("build indices")
        tree = rbush()
        tree.load(data)
        console.timeEnd("build indices")
    } else {
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
}, false)
