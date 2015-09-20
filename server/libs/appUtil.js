var util = require('util');
var config = require('./config');

module.exports = {
    makeBaseUrl: function () {
        return util.format(config.get('http:port')
                ? '%s://%s:%s'
                : '%s://%s',
            config.get('http:proto'),
            config.get('http:hostname'),
            config.get('http:port'));
    }
};