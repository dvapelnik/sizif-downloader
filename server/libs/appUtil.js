var util = require('util');
var config = require('./config');

module.exports = {
    makeBaseUrl: function () {
        var proto = config.get('http:proto');
        var hostname = config.get('http:hostname');
        var port = config.get('http:port');

        return port
            ? util.format('%s://%s:%s', proto, hostname, port)
            : util.format('%s://%s', proto, hostname);
    }
};