self.addEventListener('message', function(e) {
    console.time("parse data")
    var view = new Uint8Array(e.data.data)
    var dataX = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return []})
    var dataY = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return []})
    var dataZ = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return []})
    var dataC = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return []})
    var currentInt = 0
    var currentCoords = []
    for (var i = 0; i<view.length; i++) {
        switch (view[i]) {
        default:
          currentInt = currentInt*10 + (view[i] - 48 /*'0'*/)
        break;
        case 10: // '\n'
            var bin = ~~(currentCoords[1]/256)%4
            dataX[bin].push(currentCoords[1])
            dataY[bin].push(currentCoords[2])
            dataZ[bin].push(currentCoords[0])
            dataC[bin].push(currentInt)

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
    console.time("send data")
    dataX = dataX.map(function(d) {return new Uint32Array(d).buffer})
    dataY = dataY.map(function(d) {return new Uint32Array(d).buffer})
    dataZ = dataZ.map(function(d) {return new Uint8Array(d).buffer})
    dataC = dataC.map(function(d) {return new Uint32Array(d).buffer})
    self.postMessage(
        dataX.map(function(_, index) {return {
            x: dataX[index],
            y: dataY[index],
            z: dataZ[index],
            count: dataC[index]
        }}),
        [dataX, dataY, dataZ, dataC].reduce(function (a,b) {return a.concat(b)}, [])
    )
    console.timeEnd("send data")
}, false)
