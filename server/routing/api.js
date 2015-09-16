var log = require('./../libs/log')(module);
var util = require('util');
var expressValidator = require('express-validator');
var ClientModel = require('./../libs/mongoose').ClientModel;

module.exports = function (app) {
    var config = require('./../libs/config');
    var apiRoutePrefix = config.get('express:apiRoutePrefix');

    app.use(expressValidator({
        customValidators: {
            clientIsAvailable: function (value) {
                return new Promise(function (resolve, reject) {
                    log.info(value);
                    ClientModel.findById(value, function (error, client) {
                        if (!client) {
                            reject({error: {code: 404, message: 'Client not found'}});
                            return;
                        }

                        if (error) {
                            reject({error: error});
                            return;
                        }

                        resolve(client);
                    });
                })
            }
        }
    }));

    app.use(apiRoutePrefix, function (req, res, next) {
        log.warn([
            getUrl(['handshaker'])
        ].indexOf(req.originalUrl));

        if ([
                getUrl(['handshake'])
            ].indexOf(req.originalUrl) === -1) {
            req.checkBody('access_token')
                .notEmpty()
                .clientIsAvailable();

            req.asyncValidationErrors()
                .then(function () {
                    next();
                })
                .catch(function (errors) {
                    res.status(400).json({
                        status: 'ERROR',
                        code: 400,
                        errors: errors
                    });
                });
        } else {
            next();
        }
    });

    app.post(getUrl('handshake'), function (req, res) {
        var client = new ClientModel;
        client.save(function (err) {
            if (!err) {
                log.info("Client created");

                res.json({
                    status: 'OK',
                    code: 201,
                    message: 'all good!',
                    access_token: client._id
                });
            } else {
                console.log(err);

                res.statusCode = 500;
                res.send({
                    status: 'ERROR',
                    code: 500,
                    message: 'Server error'
                });

                log.error('Internal error(%d): %s', res.statusCode, err.message);
            }

        });
    });

    app.post(getUrl(['job', 'make']), function (req, res) {
        var body = req.body;

        req.checkBody('url', 'Url is invalid').notEmpty();

        var errors = req.validationErrors();
        if (errors) {
            res.status(400).json({
                status: 'ERROR',
                code: 400,
                errors: errors
            });
            return;
        }

        res.json({
            status: 'OK'
        })
    });

    function getUrl(url) {
        return [apiRoutePrefix].concat(url).join('/');
    }
}
;