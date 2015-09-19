var util = require('util');
var config = require('./config');

module.exports = {
    makeBaseUrl: function () {
        return util.format('%s://%s:%s',
            config.get('express:proto'),
            config.get('express:hostname'),
            config.get('express:port'));
    }
};