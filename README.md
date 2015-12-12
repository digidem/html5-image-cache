Transparent Image Caching
=========================

ImageCache will cache all images on a webpage (including dynamically added images) in IndexedDb. If an image is already in the cache, that version is preferred. For map tile servers it will attempt to parse subdomains serving duplicate images.

### Why?

HTML5 App Cache does not work for dynamic resources, such as image tiles for a map or images from a database. ImageCache will cache all images on a page allowing all images to be seen offline.

### How?

ImageCache monitors changes in the DOM for any new IMG tags, and then:

1. Check if the image is already cached, if so change the IMG tag to point to the cached resource.

2. Download the image and store it in IndexedDb, then update the IMG tag to point to the cached resource.

### Caveats

- Only works for images on servers on a different domain to the page if CORS headers are set on the image resources.

- Currently does not expire the cache - cached images will always be used if they are in the cache.
