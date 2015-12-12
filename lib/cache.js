/* globals URL,Blob */
var idbBlobStore = require('idb-blob-store')
var toBuffer = require('blob-to-buffer')
var concat = require('concat-stream')
var urlToKey = require('./url-to-key')

function isFunction (f) {
  return typeof f === 'function'
}

/**
 * Creates a new cache
 * @param {object|function} opts If `function`, used as `opts.keyfn`
 * @param {function} opts.keyFn Function that converts Urls to key string for
 *   storage in the cache. Defaults to sha256 hash of url, but parsing and
 *   removing duplicate tile subdomains
 */
function Cache (opts) {
  if (!(this instanceof Cache)) return new Cache(opts)
  if (typeof opts === 'function') opts = { keyFn: opts }
  opts = opts || {}
  this._keyFn = (isFunction(opts.keyFn)) ? opts.keyFn : urlToKey
  this._store = idbBlobStore()
}

var CacheProto = Cache.prototype

;['exists', 'createReadStream'].forEach(function (method) {
  CacheProto[method] = function (url, cb) {
    var key = this._keyFn(url)
    return this._store[method](key, cb)
  }
})

/**
 * Remove an image from the cache for `url`
 * @param {string}   url
 * @param {Function} cb  called with `err`
 */
CacheProto.remove = function (url, cb) {
  var key = this._keyFn(url)
  var store = this._store
  store.remove(key, function (err) {
    store._del('contentType!' + key, function (errMeta) {
      cb(err || errMeta)
    })
  })
}

/**
 * Create a write stream for an image with url `opts.url` and contentType
 *   `opts.contentType`
 * @param {Object}   opts
 * @param {String}   opts.url         Url of image
 * @param {String}   opts.contentType Image `content-type`
 * @param {Function} cb               called with `err, metadata` where `metadata` has props `key, size, contentType`
 * @return {WriteStream}
 */
CacheProto.createWriteStream = function (opts, cb) {
  if (typeof opts === 'string') opts = {url: opts}
  var key = this._keyFn(opts.url)
  var contentType = opts.contentType || ''
  var store = this._store
  var ws = store.createWriteStream(key, function (err, meta) {
    if (err) ws.emit('error')
    store._put('contentType!' + key, contentType, function (errMeta) {
      if (err) ws.emit('error')
      meta.contentType = contentType
      cb(err || errMeta, meta)
    })
  })
  return ws
}

/**
 * Put an image in the cache
 * @param {string}   url   Url to the image resource online
 * @param {Blob}     blob  Image data
 * @param {Function} cb    called with `err` when finished
 */
CacheProto.put = function (url, blob, cb) {
  if (!(blob instanceof Blob)) {
    throw new Error('expected')
  }
  var contentType = blob.type
  var buf = toBuffer(blob)
  this.createWriteStream({url: url, contentType: contentType}).end(buf, cb)
}

/**
 * Get an image from the cache
 * @param {string}   url Url to the image resource
 * @param {Function} cb  called with `err, image` where `image` is a `Blob`
 */
CacheProto.get = function (url, cb) {
  var store = this._store
  var key = this._keyFn(url)
  var readStream = this.createReadStream(url)
  var concatStream = concat(function (buf) {
    store._get('contentType!' + key, function (err, contentType) {
      if (err) return cb(err)
      var blob = new Blob([buf], {type: contentType})
      cb(null, blob)
    })
  })
  readStream.on('error', cb)
  readStream.pipe(concatStream)
}

/**
 * Returns an
 *   [ObjectUrl](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
 *   for an image in the cache
 * @param {string}   url Url to the image resource
 * @param {Function} cb  called with `err, url` where `url` is an URL
 *   representing the image object in the cache. Should be revoked with
 *   `URL.revokeObjectUrl(url)` when no longer needed (i.e. when the Image has
 *   loaded)
 */
CacheProto.getObjectURL = function (url, cb) {
  this.get(url, function (err, blob) {
    if (err) return cb(err)
    var objectUrl = URL.createObjectURL(blob)
    cb(null, objectUrl)
  })
}

module.exports = Cache
