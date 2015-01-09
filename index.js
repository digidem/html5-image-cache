var domready = require('domready');
var Observer = require('document-change-observer');
var InlineWorker = require('inline-worker');
var cacheUrl = require('./cache-url-webworker');

// Array of tile server domains - used to recognize identical tiles
// coming from different subdomains
var tileServers = [
    'tiles.mapbox.com',
    'tiles.virtualearth.net'
];

window.resolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL;

// Creates a web worker from an inline function
// (normally web workers can only be created from an external js file)
var worker = new InlineWorker(cacheUrl);

// Returns a unique ID
var idCounter = 0;

function uniqueId() {
    return ++idCounter + '';
}

// Keep track of web workers
var workerIndex = {};

// Takes an array of `img` nodes. 
// If the image source is in the cache, sets the source to the cached version.
// If not, caches the image once it is loaded.
function cacheImages(imgs) {
    imgs.forEach(function(img) {
        var originalUrl = img.src;
        // Are we already using a cached image?
        if (isCached(originalUrl)) return;
        // Exclude certain domains **FOR TESTING ONLY -- REMOVE**
        if (originalUrl.match(/formhub/)) return;

        // Check if the image is already in the cache
        var cachedUrl = guessFileSystemURL(originalUrl);
        resolveLocalFileSystemURL(cachedUrl, function(url) {
            // If it is, set the image source to the cached version
            img.src = cachedUrl;
        }, function(err) {
            // If not, then wait until the image is loaded, then kick off
            // a worker script to download and cache the image
            img.addEventListener('load', onLoad);
        });
    });
}

function onLoad() {
    var img = this;

    // Turn off the onload event handler
    img.removeEventListener('load', onLoad);

    var id = uniqueId();
    // Keep a reference to the image node we are processing
    workerIndex[id] = img;

    // Runs when the web worker completes returning a reference to the cached image
    worker.onmessage = function(e) {
        if (e.data.error) return console.log(e.data.error);
        // Retrieve the image node we are processing
        var img = workerIndex[e.data.id];
        // Is the image source already set to the cached version?
        // Or is the image node no longer in the DOM?
        if (isCached(img.src) || !document.contains(img)) return delete workerIndex[e.data.id];
        // Change the image source to the cached url
        img.src = e.data.url;
        // Delete our reference to the image node
        delete workerIndex[e.data.id];
    };

    // Send our caching task to the worker
    worker.postMessage({
        fileName: urlToFilename(img.src),
        url: img.src,
        id: id
    });
}

// Checks whether a url points to a remote resource or to a local cached resource
function isCached(url) {
    return !url.match(/^https?:\/\//);
}

// Guesses the FileSystem URL for a given remote Url
function guessFileSystemURL(url) {
    if (url.match(/^filesystem:/)) return url;
    return "filesystem:" + window.location.href + "temporary/" + urlToFilename(url);
}

// Converts a url into a valid filesystem filename
// Also removes the subdomains of any tileservers, since most tileservers
// use several subdomains which return the same images
function urlToFilename(url) {
    var tileServerRe = new RegExp(".*(" + tileServers.join(")|(").replace(/\./g, "\\.") + ")");
    return url.replace(/^https?:\/\//, "").replace(tileServerRe, "$1").replace(/[^a-z0-9\-\.]/gi, '_');
}

domready(function() {
    // First, cache any images already on the page when it is loaded
    var imgs = [];
    var nodeList = document.getElementsByTagName('IMG');
    for (var i = 0; i < nodeList.length; ++i) {
        imgs.push(nodeList[i]);
    }
    cacheImages(imgs);

    // Then, set up an observer to cache any new IMG tags that are added to the DOM
    var observer = Observer(document.body, 'img');
    observer.on('added', cacheImages);
});
