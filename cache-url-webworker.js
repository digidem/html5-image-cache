module.exports = function() {

    self.requestFileSystemSync = self.webkitRequestFileSystemSync ||
        self.requestFileSystemSync;

    var fs;

    function makeRequest(url) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false); // Note: synchronous
            xhr.responseType = 'blob';
            xhr.send();
            return xhr.response;
        } catch (e) {
            return onError(e);
        }
    }

    function onError(e) {
        postMessage({
            error: 'ERROR: ' + e.toString()
        });
    }

    onmessage = function(e) {
        var data = e.data;

        // Make sure we have the right parameters.
        if (!data.fileName || !data.url) {
            return;
        }

        try {
            if (!fs) {
                fs = requestFileSystemSync(TEMPORARY, 500 * 1024 * 1024 /*500MB*/ );
            }

            var fileEntry = fs.root.getFile(data.fileName, {
                create: true
            });

            var blob = makeRequest(data.url);

            try {
                fileEntry.createWriter().write(blob);
                postMessage({
                    id: data.id,
                    url: fileEntry.toURL()
                });
            } catch (e) {
                onError(e);
            }

        } catch (e) {
            onError(e);
        }
    };

};
