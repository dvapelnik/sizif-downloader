var util = require('util');

var log = require('./../libs/log')(module);
var config = require('./../libs/config');
var async = require('async');
var _ = require('underscore');
var expressValidator = require('express-validator');
var mongooseConnection = require('./../libs/mongoose').connection;
var amqpConnection = require('./../libs/amqp').connection;
var downloader = require('./../libs/downloader');

var ClientModel = require('./../libs/mongoose').ClientModel;
var JobModel = require('./../libs/mongoose').JobModel;

module.exports = function (app) {
    var config = require('./../libs/config');

    var apiRoutePrefix = config.get('api:routePrefix');
    var apiVersion = config.get('api:version');

    // Custom validators
    app.use(expressValidator({
        customValidators: {
            clientIsAvailable: function (value) {
                return new Promise(function (resolve, reject) {
                    if (mongooseConnection.readyState) {
                        ClientModel.findById(value, function (error, client) {
                            if (!client) {
                                reject({error: {code: 404, errors: 'Client not found'}});
                                return;
                            }

                            if (error) {
                                reject({error: error});
                                return;
                            }

                            resolve(client);
                        });
                    } else {
                        reject({error: {code: 500, errors: 'Internal server error'}})
                    }

                })
            }
        }
    }));

    // Access token checking middlware
    app.use(apiRoutePrefix, function (req, res, next) {
        if ([
                getUrl(['handshake'])
            ].indexOf(req.originalUrl) === -1) {
            req.checkBody('access_token',
                'Access token is not defined').notEmpty();
            req.checkBody('access_token',
                'Access token should have 24 symbol').isLength([24]);
            req.checkBody('access_token',
                'Client not found or internal server error occurred').clientIsAvailable();

            req.asyncValidationErrors()
                .then(function () {
                    next();
                })
                .catch(function (errors) {
                    var status = 401;
                    console.log(errors);
                    res.status(status).json({
                        status: 'ERROR',
                        code: status,
                        errors: makeValidationErrorArray(errors)
                    });
                });
        } else {
            next();
        }
    });

    // Disable caching
    app.use(function (req, res, next) {
        next();
    });

    // POST:/api/handshake
    app.post(getUrl('handshake'), function (req, res) {
        var client = new ClientModel;
        client.save(function (err) {
            if (err) {
                res.statusCode = 500;
                res.send({
                    status: 'ERROR',
                    code: 500,
                    errors: 'Internal server error'
                });

                log.error('Internal error(%d): %s', res.statusCode, err.message);
            } else {
                log.info("Client created");

                res.json({
                    status: 'OK',
                    code: 201,
                    message: 'Client created',
                    access_token: client._id
                });
            }

        });
    });

    // POST:/api/job/make
    app.post(getUrl(['job', 'make']), function (req, res) {
        async.waterfall([
            function (callback) {
                req.checkBody('url', 'Url is invalid').notEmpty();

                req.asyncValidationErrors()
                    .then(function () {
                        callback(null);
                    })
                    .catch(function (errors) {
                        console.log(errors);
                        callback({
                            code: 400,
                            errors: errors
                        });
                    })
            },
            function (callback) {
                ClientModel.findById(req.body.access_token, function (error, client) {
                    callback(error, client);
                });
            },
            function (client, callback) {
                var job = new JobModel({
                    client_id: client.id,
                    url: req.body.url
                });

                job.save(function (error) {
                    if (error) {
                        callback({
                            code: 500,
                            errors: 'Internal server error'
                        });
                    } else {
                        callback(error, job);
                    }
                });
            },
            function (job, callback) {
                amqpConnection
                    .then(function (connection) {
                        return connection.createConfirmChannel(config.get('amqp:queue:mainJob:name'));
                    }).
                    then(function (channel) {
                        channel.prefetch(config.get('amqp:queue:mainJob:limit'));
                        channel.assertQueue(config.get('amqp:queue:mainJob:name'));
                        channel.sendToQueue(
                            config.get('amqp:queue:mainJob:name'),
                            new Buffer(JSON.stringify({
                                jobId: job.id
                            })), {}, function () {

                            });
                    });

                callback(null, job);
            }
        ], function (error, job) {
            if (error) {
                res.status(error.code).json({
                    status: 'ERROR',
                    code: error.code,
                    errors: makeValidationErrorArray(error.errors)
                });
            } else {
                res.status(201).json({
                    status: 'OK',
                    message: 'Job created',
                    data: {
                        id: job.id,
                        created: job.created,
                        status: job.status,
                        url: job.url
                    }
                });
            }
        });
    });

    // GET:/api/job/status
    app.get(getUrl(['job', 'status']), function (req, res) {
        async.waterfall([
                function (callback) {
                    req.checkBody('job_id')
                        .notEmpty()
                        .isLength([24]);

                    req.asyncValidationErrors()
                        .then(function () {
                            callback(null, req.body.job_id, req.body.access_token);
                        })
                        .catch(function (errors) {
                            callback({
                                code: 400,
                                errors: makeValidationErrorArray(errors)
                            })
                        });
                },
                function (jobId, clientId, callback) {
                    ClientModel.findById(clientId, function (error, client) {
                        if (error) {
                            callback({errors: 'Internal server error'});
                        } else {
                            callback(null, jobId, client)
                        }
                    });
                },
                function (jobId, client, callback) {
                    JobModel.findById(jobId, function (error, job) {
                        if (error) {
                            callback({
                                code: 500,
                                errors: 'Internal server error'
                            });
                        } else if (!job) {
                            callback({
                                code: 404,
                                errors: 'Job not found'
                            });
                        } else if (job.client_id != client.id) {
                            callback({
                                code: 403,
                                errors: 'Access forbidden'
                            });
                        } else {
                            callback(null, job);
                        }
                    });
                }
            ],
            function (error, job) {
                if (error) {
                    res.status(error.code).json({
                        status: 'ERROR',
                        code: error.code,
                        errors: error.errors
                    });
                } else {
                    res.json({
                        status: 'OK',
                        code: 200,
                        data: {
                            id: job.id,
                            url: job.url,
                            status: job.status,
                            created: job.created
                        }
                    });
                }
            }
        )
    });

    function getUrl(url) {
        return [apiRoutePrefix, apiVersion].concat(url).join('/');
    }

    function makeValidationErrorArray(errors) {
        return _.chain(errors).map(function (error) {
            var errorObj = {};
            errorObj[error.param] = error.msg;

            return errorObj;
        }).uniq(function (a, b) {
            return JSON.stringify(a) === JSON.stringify(b);
        }).value();
    }
};