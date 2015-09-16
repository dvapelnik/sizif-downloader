module.exports = function (app) {
    var config = require('./../config/config');

    var apiRoutePrefix = config.express.apiRoutePrefix;

    app.post([apiRoutePrefix, 'handshake'].join('/'), function (req, res) {
        res.json({
            status: 'OK',
            message: 'all good!'
        });
    });
};