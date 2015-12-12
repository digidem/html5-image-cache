var parseUrl = require('url').parse
var formatUrl = require('url').format
var Sha = require('sha.js/sha256')

function hash (str) {
  var sha256 = new Sha()
  return sha256.update(str, 'utf8').digest('hex')
}

/**
 * Map tile services use multiple subdomains to get past browser limitations
 *   on the number of downloads from a single domain. This makes a 'best
 *   guess' at removing those subdomains from the url by removing the last
 *   character of any subdomains that end in a digit. This is useful because
 *   tiles on different subdomains are duplicates. The potential bad side-
 *   effect of this is that if you have two different images on different
 *   subdomains `subdomain1.example.com/myimage.jpg` and
 *   `subdomain2.example.com/myimage.jpg` only one of the images will be
 *   cached and used
 * @param {string} url URL to parse
 * @return {string} URL with postfixed digits removed from subdomains
 * @example ```
 *   removeTileSubdomain('http://ecn.t1.tiles.virtualearth.net/tiles/a0313131311301.jpeg')
 *   // http://ecn.t.tiles.virtualearth.net/tiles/a0313131311301.jpeg ```
 */
function removeTileSubdomain (url) {
  var urlObj = parseUrl(url)
  var hostname = urlObj.hostname
  if (hostname) {
    var subdomains = hostname.split('.').slice(0, -2)
    var tld = hostname.split('.').slice(-2)
    subdomains = subdomains.map(function (subdomain) {
      return subdomain.replace(/^(.*)\d$/, '$1')
    })
    urlObj.hostname = subdomains.concat(tld).join('.')
  }
  return formatUrl(urlObj)
}

module.exports = function (url) {
  return hash(removeTileSubdomain(url))
}
