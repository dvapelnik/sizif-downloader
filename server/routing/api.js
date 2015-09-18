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
var ImageModel = require('./../libs/mongoose').ImageModel;

var apiRoutePrefix = config.get('api:routePrefix');
var apiVersion = config.get('api:version');

module.exports = function (app) {
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
            console.log(req.query);
            console.log(req.originalUrl);
            req.checkQuery('access_token',
                'Access token is not defined').notEmpty();
            req.checkQuery('access_token',
                'Access token should have 24 symbol').isLength([24]);
            req.checkQuery('access_token',
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

    // POST:/api/v1/handshake
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

    // POST:/api/v1/job/make
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
                ClientModel.findById(req.query.access_token, function (error, client) {
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
                                job.status = JobModel.getStatusList().pending;

                                job.save(function (error) {
                                    if (error) {
                                        log.error('Job saving error');
                                    } else {
                                        log.debug('Job status updated to %s', job.status);
                                    }
                                });
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

    // GET:/api/v1/job/status
    app.get(getUrl(['job', 'status']), function (req, res) {
        async.waterfall([
                function (callback) {
                    req.checkQuery('job_id')
                        .notEmpty()
                        .isLength([24]);

                    req.asyncValidationErrors()
                        .then(function () {
                            callback(null, req.query.job_id, req.query.access_token);
                        })
                        .catch(function (errors) {
                            callback({
                                code: 400,
                                errors: makeValidationErrorArray(errors)
                            })
                        });
                },
                findClient,
                checkAccess
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

    // GET:/api/v1/job
    app.get(getUrl(['job']), function (req, res) {
        async.waterfall([
            function (callback) {
                req.checkQuery('job_id')
                    .notEmpty()
                    .isLength([24]);

                req.asyncValidationErrors()
                    .then(function () {
                        callback(null, req.query.job_id, req.query.access_token)
                    })
                    .catch(function (errors) {
                        callback({
                            code: 400,
                            errors: makeValidationErrorArray(errors)
                        })
                    });
            },
            findClient,
            checkAccess,
            function (job, callback) {
                var resultObject = {
                    id: job.id,
                    url: job.url,
                    status: job.status,
                    created: job.created
                };

                if (job.status == JobModel.getStatusList().complete) {
                    ImageModel.find({job_id: job.id}, function (error, iamges) {
                        if (error) {
                            callback({
                                code: 500,
                                errors: 'Internal server error'
                            });
                        } else {
                            resultObject.files = iamges.map(function (image) {
                                return {
                                    height: image.height,
                                    width: image.width,
                                    path: {
                                        original: image.path_remote,
                                        retrieve: util.format('%s/image?image_id=%s', makeBaseUrl(), image.id)
                                    },
                                    size: image.path,
                                    content_type: image.content_type,
                                    downloaded: image.created
                                };
                            });

                            callback(null, resultObject);
                        }
                    });
                } else {
                    callback(null, resultObject);
                }
            }
        ], function (error, job) {
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
                        job: job
                    }
                });
            }
        });
    });

    app.get(getUrl(['job', 'list']), function (req, res) {
        async.waterfall([
            function (callback) {
                JobModel.find({client_id: req.query.access_token}, function (error, jobs) {
                    if (error) {
                        callback({
                            code: 500,
                            errors: 'Internal error'
                        });
                    } else {
                        var jobList = jobs.map(function (job) {
                            return {
                                id: job.id,
                                status: job.status,
                                url: job.url,
                                created: job.created
                            }
                        });

                        callback(null, jobList);
                    }
                })
            }
        ], function (error, jobList) {
            if (error) {
                res.status(error.code).json({
                    status: 'ERROR',
                    code: error.code,
                    errors: error.errors
                })
            } else {
                res.json({
                    status: 'ERROR',
                    code: 200,
                    data: {
                        jobs: jobList
                    }
                });
            }
        });
    });
};

function makeValidationErrorArray(errors) {
    return _.chain(errors).map(function (error) {
        var errorObj = {};
        errorObj[error.param] = error.msg;

        return errorObj;
    }).uniq(function (a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }).value();
}

function getUrl(url) {
    return [apiRoutePrefix, apiVersion].concat(url).join('/');
}

function makeBaseUrl() {
    return util.format('%s://%s:%s',
        config.get('express:proto'),
        config.get('express:hostname'),
        config.get('express:port'));
}

function findClient(jobId, clientId, callback) {
    ClientModel.findById(clientId, function (error, client) {
        if (error) {
            callback({errors: 'Internal server error'});
        } else {
            callback(null, jobId, client)
        }
    });
}

function checkAccess(jobId, client, callback) {
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