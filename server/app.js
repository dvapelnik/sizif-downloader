var config = require('./libs/config');

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var expressValidator = require('express-validator');

var log = require('./libs/log')(module);

var app = express();

app.disable('etag');

app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(expressValidator());

require('./routing/main')(app);
require('./routing/api')(app);

app.use(function (req, res, next) {
    res.status(404);
    log.debug('Not found URL: %s', req.url);
    res.send({
        status: 'ERROR',
        message: 'not-found'
    });
    return;
});
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    log.error('Internal error(%d): %s', res.statusCode, err.message);
    res.send({
        status: 'ERROR',
        message: err.message
    });
    return;
});

server = app.listen(config.get('express:port'), function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Server started on http://%s:%s', host, port);
});