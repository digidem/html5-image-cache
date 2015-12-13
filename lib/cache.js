/* globals URL,Blob */
var toBuffer = require('blob-to-buffer')
var collect = require('collect-stream')
var level = require('level-browserify')
var assign = require('object-assign')
var http = require('http')

var urlToKey = require('./url-to-key')
var defaultStore = require('./store')
var guessContentType = require('./guess-content-type')

/**
 * Creates a new cache
 * @param {object|function} opts If `function`, used as `opts.keyfn`
 * @param {function} opts.keyFn Function that converts Urls to key string for
 *   storage in the cache. Defaults to sha256 hash of url, but parsing and
 *   removing duplicate tile subdomains
 * @param {object} opts.store Instance of an
 *   [abstract-blob-store](https://github.com/maxogden/abstract-blob-store)
 *   that supports user-defined keys. Defaults to
 *   [idb-blob-store](https://github.com/substack/idb-blob-store)
 */
function Cache (opts) {
  if (!(this instanceof Cache)) return new Cache(opts)
  if (typeof opts === 'function') opts = { keyFn: opts }
  opts = opts || {}
  this._keyFn = (typeof opts.keyFn === 'function') ? opts.keyFn : urlToKey
  this._blobStore = opts.store || defaultStore()
  this._metaDb = level('./metadb', {valueEncoding: 'json'})
}

var CacheProto = Cache.prototype

;['exists', 'createReadStream', 'createWriteStream'].forEach(function (method) {
  CacheProto[method] = function (url, cb) {
    var key = this._keyFn(url)
    return this._blobStore[method](key, cb)
  }
})

/**
 * Remove an image from the cache for `url`
 * @param {string}   url
 * @param {Function} cb  called with `err`
 */
CacheProto.remove = function (url, cb) {
  var key = this._keyFn(url)
  var metaDb = this._metaDb
  this._blobStore.remove(key, function (err) {
    metaDb.del(key, function (errMeta) {
      cb(err || errMeta)
    })
  })
}

/**
 * Put an image in the cache
 * @param {string}   url   Url to the image resource online
 * @param {Blob}     blob  Image data
 * @param {Function} cb    called with `err` when finished
 */
CacheProto.put = function (url, blob, cb) {
  if (!(blob instanceof Blob)) {
    throw new Error('expected blob')
  }
  var metadata = {'content-type': blob.type}
  var self = this
  var buf = toBuffer(blob)
  self.createWriteStream(url).end(buf, function (err, blobStoreMetadata) {
    if (err) return cb(err)
    self.putMetadata(url, metadata, function (errMeta) {
      assign(blobStoreMetadata, metadata)
      cb(err || errMeta, blobStoreMetadata)
    })
  })
}

/**
 * Get an image from the cache
 * @param {string}   url Url to the image resource
 * @param {Function} cb  called with `err, image` where `image` is a `Blob`
 */
CacheProto.get = function (url, cb) {
  var self = this
  collect(self.createReadStream(url), function (err, buf) {
    self._getContentType(url, function (errMeta, metadata) {
      if (err || errMeta) return cb(err || errMeta)
      var blob = new Blob([buf], {type: metadata['content-type']})
      cb(null, blob)
    })
  })
}

CacheProto.download = function (url, cb) {
  var self = this
  http.get(url, function (res) {
    res.on('error', cb)
    self.putMetadata(url, res.headers, function (err) {
      if (err) return cb(err)
      var ws = self.createWriteStream(url, cb)
      res.pipe(ws)
    })
  }).on('error', cb)
}

CacheProto.getMetadata = function (url, cb) {
  var key = this._keyFn(url)
  this._metaDb.get(key, cb)
}

CacheProto.putMetadata = function (url, metadata, cb) {
  var key = this._keyFn(url)
  this._metaDb.put(key, metadata, cb)
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

CacheProto._getContentType = function (url, cb) {
  var contentType = guessContentType(url)
  if (contentType) return cb(null, contentType)
  this.getMetadata(url, cb)
}

module.exports = Cache
