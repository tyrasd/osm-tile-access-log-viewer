self.addEventListener('message', function(e) {
  self.postMessage('parsing')
    var view = new Uint8Array(e.data.data)
    var approxLength = ~~(view.length / 15 / e.data.numWorkers); // 15 -> empirical guestimate (i.e. number of lines in tiles-*.txt divided by file size in bytes)
    var dataX = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return new Uint32Array(approxLength)})
    var dataY = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return new Uint32Array(approxLength)})
    var dataZ = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return new Uint8Array(approxLength)})
    var dataC = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return new Uint32Array(approxLength)})
    var dataI = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return new Uint32Array(approxLength)})
    var currentInt = 0
    var currentCoords = [0,0,0]
    var currentCoordsIndex = 0
    var currentIndex = Array.apply(null, new Array(e.data.numWorkers)).map(function() {return 0})
    for (var i = 0; i<view.length; i++) {
        switch (view[i]) {
        default: // 0-9
          currentInt = currentInt*10 + (view[i] & 0x0f)
        break;
        case 10: // '\n'
            var bin = ~~(currentCoords[1]/256) % e.data.numWorkers
            var binCurrentIndex = currentIndex[bin]
            dataX[bin][binCurrentIndex] = currentCoords[1]
            dataY[bin][binCurrentIndex] = currentCoords[2]
            dataZ[bin][binCurrentIndex] = currentCoords[0]
            dataC[bin][binCurrentIndex] = currentInt
            dataI[bin][binCurrentIndex] = binCurrentIndex
            currentIndex[bin]++;
            if (binCurrentIndex >= approxLength) {
                // we need to make our data arrays a bit bigger to accomodate all data
                console.log("expand internal data arrays")
                function expand(oldData, newLength, ArrayType) {
                    var temp = new ArrayType(newLength)
                    temp.set(oldData)
                    return temp
                }
                approxLength = ~~(approxLength * 1.2)
                dataX[bin] = expand(dataX[bin], approxLength, Uint32Array)
                dataY[bin] = expand(dataY[bin], approxLength, Uint32Array)
                dataZ[bin] = expand(dataZ[bin], approxLength, Uint8Array)
                dataC[bin] = expand(dataC[bin], approxLength, Uint32Array)
                dataI[bin] = expand(dataI[bin], approxLength, Uint32Array)
            }

            currentCoordsIndex = 0
            currentInt = 0
        break;
        case 32: // ' '
        case 47: // '/'
            currentCoords[currentCoordsIndex++] = currentInt
            currentInt = 0
        break;
        }
    }
    dataX = dataX.map(function(d,i) {return d.slice(0, currentIndex[i]-1).buffer})
    dataY = dataY.map(function(d,i) {return d.slice(0, currentIndex[i]-1).buffer})
    dataZ = dataZ.map(function(d,i) {return d.slice(0, currentIndex[i]-1).buffer})
    dataC = dataC.map(function(d,i) {return d.slice(0, currentIndex[i]-1).buffer})
    dataI = dataI.map(function(d,i) {return d.slice(0, currentIndex[i]-1).buffer})
    self.postMessage(
        dataX.map(function(_, index) {return {
            x: dataX[index],
            y: dataY[index],
            z: dataZ[index],
            count: dataC[index],
            indices: dataI[index]
        }}),
        [dataX, dataY, dataZ, dataC, dataI].reduce(function (a,b) {return a.concat(b)}, [])
    )
    self.postMessage('build spatial index')
}, false)
