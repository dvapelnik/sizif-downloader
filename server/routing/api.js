var log = require('./../libs/log')(module);
var async = require('async');
var _ = require('underscore');
var expressValidator = require('express-validator');

var ClientModel = require('./../libs/mongoose').ClientModel;
var JobModel = require('./../libs/mongoose').JobModel;

module.exports = function (app) {
    var config = require('./../libs/config');
    var apiRoutePrefix = config.get('express:apiRoutePrefix');

    // Custom validators
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

    // Access token checking middlware
    app.use(apiRoutePrefix, function (req, res, next) {
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

    // GET:/api/handshake
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
                        callback({
                            isValidateError: true,
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
                    callback(error, job.id)
                })
            }
        ], function (error, jobId) {
            if (error) {
                log.error(error);

                if (error.isValidateError) {
                    res.status(400).json({
                        status: 'ERROR',
                        code: 400,
                        errors: error.errors
                    });
                } else {
                    res.status(500).json({
                        status: 'ERROR',
                        code: 500,
                        errors: error.errors ? _.map(error.errors, function (error, key) {
                            return 'Request key \'' + key + '\' is invalid';
                        }) : []
                    });
                }
            } else {
                res.status(201).json({
                    status: 'OK',
                    message: 'Job created',
                    data: {
                        job_id: jobId
                    }
                });
            }
        });
    });

    // GET:/api/job/status
    app.get(getUrl(['job', 'status']), function (req, res) {
        async.waterfall([
                function (callback) {
                    req.checkBody('job_id').notEmpty();

                    req.asyncValidationErrors()
                        .then(function () {
                            callback(null, req.body.job_id, req.body.access_token);
                        })
                        .catch(function (errors) {
                            callback({
                                code: 400,
                                errors: _.map(errors, function (error) {
                                    var errorObj = {};
                                    log.debug(error);
                                    errorObj[error.path] = error.message;

                                    return errorObj;
                                })
                            })
                        });
                },
                function (jobId, clientId, callback) {
                    ClientModel.findById(clientId, function (error, client) {
                        if (error) {
                            callback({errors: ['Internal error']});
                        } else {
                            callback(null, jobId, client)
                        }
                    });
                },
                function (jobId, client, callback) {
                    log.debug('JobID:', jobId);
                    JobModel.findById(jobId, function (error, job) {
                        if (error) {
                            callback({
                                code: 500,
                                errors: ['Internal error']
                            });
                        } else if (!job) {
                            callback({
                                code: 404,
                                errors: ['Job not found']
                            });
                        } else if (job.client_id != client.id) {
                            callback({
                                code: 403,
                                errors: ['Access forbidden']
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
        return [apiRoutePrefix].concat(url).join('/');
    }
};