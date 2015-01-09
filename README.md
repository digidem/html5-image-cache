Transparent Image Caching
=========================

ImgCache will cache all images on a webpage (including dynamically added images) in local filesystem storage. Currently only works with Google Chrome.

### Why?

HTML5 App Cache does not work for dynamic resources, such as image tiles for a map or images from a database. ImgCache will cache all images on a page allowing all images to be seen offline.

### How?

ImgCache monitors changes in the DOM for any new IMG tags, and then:

1. Check if the image is already cached, if so change the IMG tag to point to the cached resource.

2. Download the image and store it in a filesystem cache, then update the IMG tag to point to the cached resource.

### Caveats

Only works in Google Chrome right now. Firefox support coming soon (needs to use IndexedDb rather than the FileSystem API). Only works for images on servers on a different domain to the page if CORS headers are set on the image resources.
