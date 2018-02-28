(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
typeof define === 'function' && define.amd ? define(factory) :
(global = global || self, global.Flatbush = factory());
}(this, (function () { 'use strict';

var FlatQueue = function FlatQueue() {
    this.ids = [];
    this.values = [];
    this.length = 0;
};

FlatQueue.prototype.clear = function clear () {
    this.length = 0;
};

FlatQueue.prototype.push = function push (id, value) {
    var pos = this.length++;
    this.ids[pos] = id;
    this.values[pos] = value;

    while (pos > 0) {
        var parent = (pos - 1) >> 1;
        var parentValue = this.values[parent];
        if (value >= parentValue) { break; }
        this.ids[pos] = this.ids[parent];
        this.values[pos] = parentValue;
        pos = parent;
    }

    this.ids[pos] = id;
    this.values[pos] = value;
};

FlatQueue.prototype.pop = function pop () {
    if (this.length === 0) { return undefined; }

    var top = this.ids[0];
    this.length--;

    if (this.length > 0) {
        var id = this.ids[0] = this.ids[this.length];
        var value = this.values[0] = this.values[this.length];
        var halfLength = this.length >> 1;
        var pos = 0;

        while (pos < halfLength) {
            var left = (pos << 1) + 1;
            var right = left + 1;
            var bestIndex = this.ids[left];
            var bestValue = this.values[left];
            var rightValue = this.values[right];

            if (right < this.length && rightValue < bestValue) {
                left = right;
                bestIndex = this.ids[right];
                bestValue = rightValue;
            }
            if (bestValue >= value) { break; }

            this.ids[pos] = bestIndex;
            this.values[pos] = bestValue;
            pos = left;
        }

        this.ids[pos] = id;
        this.values[pos] = value;
    }

    return top;
};

FlatQueue.prototype.peek = function peek () {
    return this.ids[0];
};

FlatQueue.prototype.peekValue = function peekValue () {
    return this.values[0];
};

var ARRAY_TYPES = [
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array
];

var VERSION = 3; // serialized format version

var Flatbush = function Flatbush(numItems, nodeSize, ArrayType, data) {
    if ( nodeSize === void 0 ) nodeSize = 16;
    if ( ArrayType === void 0 ) ArrayType = Float64Array;

    if (numItems === undefined) { throw new Error('Missing required argument: numItems.'); }
    if (isNaN(numItems) || numItems <= 0) { throw new Error(("Unpexpected numItems value: " + numItems + ".")); }

    this.numItems = +numItems;
    this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);

    // calculate the total number of nodes in the R-tree to allocate space for
    // and the index of each tree level (used in search later)
    var n = numItems;
    var numNodes = n;
    this._levelBounds = [n * 4];
    do {
        n = Math.ceil(n / this.nodeSize);
        numNodes += n;
        this._levelBounds.push(numNodes * 4);
    } while (n !== 1);

    this.ArrayType = ArrayType || Float64Array;
    this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;

    var arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
    var nodesByteSize = numNodes * 4 * this.ArrayType.BYTES_PER_ELEMENT;

    if (arrayTypeIndex < 0) {
        throw new Error(("Unexpected typed array class: " + ArrayType + "."));
    }

    if (data && (data instanceof ArrayBuffer)) {
        this.data = data;
        this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
        this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);

        this._pos = numNodes * 4;
        this.minX = this._boxes[this._pos - 4];
        this.minY = this._boxes[this._pos - 3];
        this.maxX = this._boxes[this._pos - 2];
        this.maxY = this._boxes[this._pos - 1];

    } else {
        this.data = new ArrayBuffer(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
        this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
        this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);
        this._pos = 0;
        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;

        new Uint8Array(this.data, 0, 2).set([0xfb, (VERSION << 4) + arrayTypeIndex]);
        new Uint16Array(this.data, 2, 1)[0] = nodeSize;
        new Uint32Array(this.data, 4, 1)[0] = numItems;
    }

    // a priority queue for k-nearest-neighbors queries
    this._queue = new FlatQueue();
};

Flatbush.from = function from (data) {
    if (!(data instanceof ArrayBuffer)) {
        throw new Error('Data must be an instance of ArrayBuffer.');
    }
    var ref = new Uint8Array(data, 0, 2);
        var magic = ref[0];
        var versionAndType = ref[1];
    if (magic !== 0xfb) {
        throw new Error('Data does not appear to be in a Flatbush format.');
    }
    if (versionAndType >> 4 !== VERSION) {
        throw new Error(("Got v" + (versionAndType >> 4) + " data when expected v" + VERSION + "."));
    }
    var ref$1 = new Uint16Array(data, 2, 1);
        var nodeSize = ref$1[0];
    var ref$2 = new Uint32Array(data, 4, 1);
        var numItems = ref$2[0];

    return new Flatbush(numItems, nodeSize, ARRAY_TYPES[versionAndType & 0x0f], data);
};

Flatbush.prototype.add = function add (minX, minY, maxX, maxY) {
    var index = this._pos >> 2;
    this._indices[index] = index;
    this._boxes[this._pos++] = minX;
    this._boxes[this._pos++] = minY;
    this._boxes[this._pos++] = maxX;
    this._boxes[this._pos++] = maxY;

    if (minX < this.minX) { this.minX = minX; }
    if (minY < this.minY) { this.minY = minY; }
    if (maxX > this.maxX) { this.maxX = maxX; }
    if (maxY > this.maxY) { this.maxY = maxY; }

    return index;
};

Flatbush.prototype.finish = function finish () {
    if (this._pos >> 2 !== this.numItems) {
        throw new Error(("Added " + (this._pos >> 2) + " items when expected " + (this.numItems) + "."));
    }

    var width = this.maxX - this.minX;
    var height = this.maxY - this.minY;
    var hilbertValues = new Uint32Array(this.numItems);
    var hilbertMax = (1 << 16) - 1;

    // map item centers into Hilbert coordinate space and calculate Hilbert values
    for (var i = 0; i < this.numItems; i++) {
        var pos = 4 * i;
        var minX = this._boxes[pos++];
        var minY = this._boxes[pos++];
        var maxX = this._boxes[pos++];
        var maxY = this._boxes[pos++];
        var x = Math.floor(hilbertMax * ((minX + maxX) / 2 - this.minX) / width);
        var y = Math.floor(hilbertMax * ((minY + maxY) / 2 - this.minY) / height);
        hilbertValues[i] = hilbert(x, y);
    }

    // sort items by their Hilbert value (for packing later)
    sort(hilbertValues, this._boxes, this._indices, 0, this.numItems - 1);

    // generate nodes at each tree level, bottom-up
    for (var i$1 = 0, pos$1 = 0; i$1 < this._levelBounds.length - 1; i$1++) {
        var end = this._levelBounds[i$1];

        // generate a parent node for each block of consecutive <nodeSize> nodes
        while (pos$1 < end) {
            var nodeMinX = Infinity;
            var nodeMinY = Infinity;
            var nodeMaxX = -Infinity;
            var nodeMaxY = -Infinity;
            var nodeIndex = pos$1;

            // calculate bbox for the new node
            for (var i$2 = 0; i$2 < this.nodeSize && pos$1 < end; i$2++) {
                var minX$1 = this._boxes[pos$1++];
                var minY$1 = this._boxes[pos$1++];
                var maxX$1 = this._boxes[pos$1++];
                var maxY$1 = this._boxes[pos$1++];
                if (minX$1 < nodeMinX) { nodeMinX = minX$1; }
                if (minY$1 < nodeMinY) { nodeMinY = minY$1; }
                if (maxX$1 > nodeMaxX) { nodeMaxX = maxX$1; }
                if (maxY$1 > nodeMaxY) { nodeMaxY = maxY$1; }
            }

            // add the new node to the tree data
            this._indices[this._pos >> 2] = nodeIndex;
            this._boxes[this._pos++] = nodeMinX;
            this._boxes[this._pos++] = nodeMinY;
            this._boxes[this._pos++] = nodeMaxX;
            this._boxes[this._pos++] = nodeMaxY;
        }
    }
};

Flatbush.prototype.search = function search (minX, minY, maxX, maxY, filterFn) {
    if (this._pos !== this._boxes.length) {
        throw new Error('Data not yet indexed - call index.finish().');
    }

    var nodeIndex = this._boxes.length - 4;
    var level = this._levelBounds.length - 1;
    var queue = [];
    var results = [];

    while (nodeIndex !== undefined) {
        // find the end index of the node
        var end = Math.min(nodeIndex + this.nodeSize * 4, this._levelBounds[level]);

        // search through child nodes
        for (var pos = nodeIndex; pos < end; pos += 4) {
            var index = this._indices[pos >> 2] | 0;

            // check if node bbox intersects with query bbox
            if (maxX < this._boxes[pos]) { continue; } // maxX < nodeMinX
            if (maxY < this._boxes[pos + 1]) { continue; } // maxY < nodeMinY
            if (minX > this._boxes[pos + 2]) { continue; } // minX > nodeMaxX
            if (minY > this._boxes[pos + 3]) { continue; } // minY > nodeMaxY

            if (nodeIndex < this.numItems * 4) {
                if (filterFn === undefined || filterFn(index)) {
                    results.push(index); // leaf item
                }

            } else {
                queue.push(index); // node; add it to the search queue
                queue.push(level - 1);
            }
        }

        level = queue.pop();
        nodeIndex = queue.pop();
    }

    return results;
};

Flatbush.prototype.neighbors = function neighbors (x, y, maxResults, maxDistance, filterFn) {
        if ( maxResults === void 0 ) maxResults = Infinity;
        if ( maxDistance === void 0 ) maxDistance = Infinity;

    if (this._pos !== this._boxes.length) {
        throw new Error('Data not yet indexed - call index.finish().');
    }

    var nodeIndex = this._boxes.length - 4;
    var q = this._queue;
    var results = [];
    var maxDistSquared = maxDistance * maxDistance;

    while (nodeIndex !== undefined) {
        // find the end index of the node
        var end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));

        // add child nodes to the queue
        for (var pos = nodeIndex; pos < end; pos += 4) {
            var index = this._indices[pos >> 2] | 0;

            var dx = axisDist(x, this._boxes[pos], this._boxes[pos + 2]);
            var dy = axisDist(y, this._boxes[pos + 1], this._boxes[pos + 3]);
            var dist = dx * dx + dy * dy;

            if (nodeIndex < this.numItems * 4) { // leaf node
                if (filterFn === undefined || filterFn(index)) {
                    // put a negative index if it's an item rather than a node, to recognize later
                    q.push(-index - 1, dist);
                }
            } else {
                q.push(index, dist);
            }
        }

        // pop items from the queue
        while (q.length && q.peek() < 0) {
            var dist$1 = q.peekValue();
            if (dist$1 > maxDistSquared) {
                q.clear();
                return results;
            }
            results.push(-q.pop() - 1);

            if (results.length === maxResults) {
                q.clear();
                return results;
            }
        }

        nodeIndex = q.pop();
    }

    q.clear();
    return results;
};

function axisDist(k, min, max) {
    return k < min ? min - k : k <= max ? 0 : k - max;
}

// binary search for the first value in the array bigger than the given
function upperBound(value, arr) {
    var i = 0;
    var j = arr.length - 1;
    while (i < j) {
        var m = (i + j) >> 1;
        if (arr[m] > value) {
            j = m;
        } else {
            i = m + 1;
        }
    }
    return arr[i];
}

// custom quicksort that sorts bbox data alongside the hilbert values
function sort(values, boxes, indices, left, right) {
    if (left >= right) { return; }

    var pivot = values[(left + right) >> 1];
    var i = left - 1;
    var j = right + 1;

    while (true) {
        do { i++; } while (values[i] < pivot);
        do { j--; } while (values[j] > pivot);
        if (i >= j) { break; }
        swap(values, boxes, indices, i, j);
    }

    sort(values, boxes, indices, left, j);
    sort(values, boxes, indices, j + 1, right);
}

// swap two values and two corresponding boxes
function swap(values, boxes, indices, i, j) {
    var temp = values[i];
    values[i] = values[j];
    values[j] = temp;

    var k = 4 * i;
    var m = 4 * j;

    var a = boxes[k];
    var b = boxes[k + 1];
    var c = boxes[k + 2];
    var d = boxes[k + 3];
    boxes[k] = boxes[m];
    boxes[k + 1] = boxes[m + 1];
    boxes[k + 2] = boxes[m + 2];
    boxes[k + 3] = boxes[m + 3];
    boxes[m] = a;
    boxes[m + 1] = b;
    boxes[m + 2] = c;
    boxes[m + 3] = d;

    var e = indices[i];
    indices[i] = indices[j];
    indices[j] = e;
}

// Fast Hilbert curve algorithm by http://threadlocalmutex.com/
// Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
function hilbert(x, y) {
    var a = x ^ y;
    var b = 0xFFFF ^ a;
    var c = 0xFFFF ^ (x | y);
    var d = x & (y ^ 0xFFFF);

    var A = a | (b >> 1);
    var B = (a >> 1) ^ a;
    var C = ((c >> 1) ^ (b & (d >> 1))) ^ c;
    var D = ((a & (c >> 1)) ^ (d >> 1)) ^ d;

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 2)) ^ (b & (b >> 2)));
    B = ((a & (b >> 2)) ^ (b & ((a ^ b) >> 2)));
    C ^= ((a & (c >> 2)) ^ (b & (d >> 2)));
    D ^= ((b & (c >> 2)) ^ ((a ^ b) & (d >> 2)));

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 4)) ^ (b & (b >> 4)));
    B = ((a & (b >> 4)) ^ (b & ((a ^ b) >> 4)));
    C ^= ((a & (c >> 4)) ^ (b & (d >> 4)));
    D ^= ((b & (c >> 4)) ^ ((a ^ b) & (d >> 4)));

    a = A; b = B; c = C; d = D;
    C ^= ((a & (c >> 8)) ^ (b & (d >> 8)));
    D ^= ((b & (c >> 8)) ^ ((a ^ b) & (d >> 8)));

    a = C ^ (C >> 1);
    b = D ^ (D >> 1);

    var i0 = x ^ y;
    var i1 = b | (0xFFFF ^ (i0 | a));

    i0 = (i0 | (i0 << 8)) & 0x00FF00FF;
    i0 = (i0 | (i0 << 4)) & 0x0F0F0F0F;
    i0 = (i0 | (i0 << 2)) & 0x33333333;
    i0 = (i0 | (i0 << 1)) & 0x55555555;

    i1 = (i1 | (i1 << 8)) & 0x00FF00FF;
    i1 = (i1 | (i1 << 4)) & 0x0F0F0F0F;
    i1 = (i1 | (i1 << 2)) & 0x33333333;
    i1 = (i1 | (i1 << 1)) & 0x55555555;

    return ((i1 << 1) | i0) >>> 0;
}

return Flatbush;

})));
