/* globals URL */
var ImgObserver = require('img-observer')
var parseUrl = require('url').parse
var inherits = require('inherits')
var http = require('http')
require('array.from')

var Cache = require('./cache')

/**
 * Check if the url is a blob (object) url
 * @param {string} url
 * @return {Boolean}
 */
function isBlobUrl (url) {
  var protocol = parseUrl(url).protocol
  return (protocol === 'blob:')
}

/**
 * Check if the img is loaded
 * @param {Image} img
 * @return {Boolean}
 */
function isImageLoaded (img) {
  return img.complete && img.naturalWidth
}

/**
 * Caches any `img` tags under `root`, and replaces `img.src` with cached
 *   blob. Watches for any dynamically created `img` tags under `root` and any
 *   changes to `img.src`
 * @param {Node} root defaults to `document.body`
 * @param {Object} opts passed through to ImgCache.Cache
 */
function Observer (root, opts) {
  if (!(this instanceof Observer)) return new Observer(root, opts)
  root = root || document.body

  this._cache = new Cache(opts)

  // First, cache any images already in the root element
  var nodeList = root.getElementsByTagName('IMG')
  var imgs = Array.from(nodeList)
  this.cacheImages(imgs)

  // Then, set up an observer to cache any new IMG tags that are added to the DOM
  ImgObserver.call(this, root)
  this.on('added', this.cacheImages.bind(this))
  this.on('changed', this.cacheImages.bind(this))
}

inherits(Observer, ImgObserver)

/**
 * For an array of types Image:
 * 1. Check if we have a cached image for Image.src
 * 2. If we do, replace img.src with an ObjectUrl pointing to the cached blob
 * 3. If we don't, download the image and store in cache
 * 4. Then update the img.src to the cached resource
 * @param {array[Image]} imgs
 */
Observer.prototype.cacheImages = function (imgs) {
  imgs.forEach(function (img) {
    var imgUrl = img.src
    var cache = this._cache
    var self = this
    // If the img tag is already pointing at the image in the cache, we don't
    // do anything
    if (isBlobUrl(imgUrl)) return

    // Check if the image is already in the cache
    cache.exists(imgUrl, function (err, exists) {
      if (err) return self.emit('error', err)
      if (exists) {
        cache.getObjectURL(imgUrl, setUrl)
      } else {
        self.cacheImage(img, setUrl)
      }
    })

    /** sets img.src to objectUrl and revokes the url when loaded */
    function setUrl (err, objectUrl) {
      if (err) return self.emit('error', err)
      img.src = objectUrl
      img.addEventListener('load', onload)
      function onload () {
        URL.revokeObjectURL(objectUrl)
        img.removeEventListener('load', onload)
      }
    }
  })
}

/**
 * Store image blob from `img.src` in the cache and return an ObjectURL
 *   pointing to the cached blob
 * @param {Image}    img
 * @param {Function} cb  called with `err, objectURL`
 */
Observer.prototype.cacheImage = function (img, cb) {
  var imgUrl = img.src
  var cache = this._cache
  // If the img tag is already pointing at the image in the cache, we don't
  // do anything (might have been set since we last checked)
  if (isBlobUrl(imgUrl)) return

  if (isImageLoaded(img)) {
    onImgload()
  } else {
    img.addEventListener('load', onImgload)
  }

  function onImgload () {
    img.removeEventListener('load', onImgload)
    http.get(imgUrl, function (res) {
      var opts = {
        url: imgUrl,
        contentType: res.headers['content-type']
      }
      var ws = cache.createWriteStream(opts, onImgCached)
      res.pipe(ws)
    }).on('error', cb)
  }

  function onImgCached (err, metadata) {
    if (err) return cb(err)
    cache.getObjectURL(imgUrl, function (err, objectUrl) {
      cb(err, objectUrl)
    })
  }
}

module.exports = Observer