var util = require('util');

var log = require('./../libs/log')(module);
var config = require('./../libs/config');

var async = require('async');
var fs = require('fs');
var querystring = require('querystring');
var fsPromise = require('fs-promise');
var requestPromise = require('request-promise');

var serveStatic = require('serve-static');
var cookieSession = require('cookie-session');

var makeBaseUrl = require('./../libs/appUtil').makeBaseUrl;

var ImageModel = require('./../libs/mongoose').ImageModel;

module.exports = function (app) {
    app.set('trust proxy', 1);
    app.use(cookieSession({
        name: 'session',
        keys: ['key1', 'key2']
    }));
    app.use(serveStatic('public', {index: ['index.html']}));

    app.get('/', function (req, res) {
        res.send('Wow! It works!');
    });

    app.get('/doc', function (req, res) {
        var raml2html = require('raml2html');
        var ramlFile = [process.cwd(), 'server', 'api.raml'].join('/');

        var config1 = raml2html.getDefaultConfig();

        raml2html.render(ramlFile, config1)
            .then(function (result) {
                res.send(result);
            })
            .catch(function (error) {
                console.log(error);
            });
    });

    app.get('/image', function (req, res) {
        var expressValidator = require('express-validator');

        req.checkQuery('image_id', 'Image not specified').notEmpty();
        req.checkQuery('image_id', 'Image id length should be 24').isLength([24]);

        var errors = req.validationErrors();

        if (errors) {
            res.status(400).send('Bad Request');
        } else {
            (new Promise(function (resolve, reject) {
                ImageModel.findById(req.query.image_id, function (error, image) {
                    if (error) {
                        reject({
                            code: 500,
                            message: 'Internal error'
                        });
                    } else if (!image) {
                        reject({
                            code: 404,
                            message: 'Not found'
                        });
                    } else if (image) {
                        resolve(image);
                    } else {
                        reject({
                            code: 500,
                            message: 'Internal error'
                        });
                    }
                })
            }))
                .then(function (image) {
                    return fsPromise.exists(image.path_local)
                        .then(function (isExists) {
                            if (isExists) {
                                return image;
                            } else {
                                throw {
                                    code: 404,
                                    message: 'Image not found'
                                }
                            }
                        })
                        .catch(reThrow);
                })
                .then(function (image) {
                    res.writeHead(200, {
                            'Content-Type': image.content_type,
                            'Content-Length': image.size
                        }
                    );

                    var readStream = fs.createReadStream(image.path_local);

                    readStream.pipe(res);
                })
                .catch(function (error) {
                    res
                        .status(
                        error.code
                            ? error.code
                            : 500)
                        .send(
                        error.message
                            ? error.message
                            : 'Internal error');
                });
        }
    });

    app.post('/job/make', function (req, res) {
        req.checkBody('url', 'Url is not defined').notEmpty();
        req.checkBody('url', 'Url is incorrect').isURL();

        var errors = req.validationErrors();

        if (errors) {
            res.status(400).json({
                status: 'ERROR',
                message: errors[0].msg
            });
            return;
        }

        async.waterfall([
            getRequestAccessTokenFn(req),
            function (access_token, callback) {
                requestPromise({
                    method: 'POST',
                    uri: [
                        makeApiUrl(['job', 'make']),
                        querystring.stringify({
                            access_token: access_token
                        })
                    ].join('?'),
                    json: true,
                    body: {
                        url: req.body.url
                    }
                }).then(function (data) {
                    callback(null, 'OK');
                }).catch(function (error) {
                    console.log(error);

                    callback(error);
                })
            }
        ], function (error, result) {
            if (error) {
                console.log(error);

                res.status(500).json({
                    status: 'ERROR',
                    message: 'Internal error'
                });
            } else {
                res.send({
                    status: 'OK'
                });
            }

        });
    });

    app.get('/job/list', function (req, res) {
        async.waterfall([
            getRequestAccessTokenFn(req),
            function (access_token, callback) {
                requestPromise({
                    method: 'GET',
                    url: [
                        makeApiUrl(['job', 'list']),
                        querystring.stringify({access_token: access_token})
                    ].join('?')
                })
                    .then(function (data) {
                        data = JSON.parse(data);
                        if (data.status == 'OK') {
                            callback(null, access_token, data.data.jobs)
                        } else {
                            throw {
                                code: data.code,
                                message: 'Internal error'
                            }
                        }
                    })
                    .catch(function (error) {
                        if (error.name == 'StatusCodeError' && error.statusCode == 401) {
                            req.session = null;
                        }
                        callback(error);
                    });
            },
            function (access_token, jobsArray, callback) {
                var jobPromises = jobsArray.map(function (job) {
                    return requestPromise({
                        method: 'GET',
                        url: [
                            makeApiUrl(['job']),
                            querystring.stringify({
                                access_token: access_token,
                                job_id: job.id
                            })
                        ].join('?')
                    });
                });

                Promise.all(jobPromises).then(function (responses) {
                    callback(null, responses.map(function (response) {
                        response = JSON.parse(response);

                        return response.data.job;
                    }));
                });
            }
        ], function (error, result) {
            res.json({
                status: 'OK',
                data: result
            });
        });

    });
};

function makeApiUrl(parts) {
    return [
        makeBaseUrl(),
        config.get('api:routePrefix').replace(/^\//, ''),
        config.get('api:version')
    ].concat(parts).join('/');
}

function reThrow(error) {
    throw error;
}

function getRequestAccessTokenFn(req) {
    return function requestAccessToken(callback) {
        var access_token = req.session.access_token;

        if (!access_token) {
            requestPromise({
                uri: makeApiUrl(['handshake']),
                method: 'POST',
                json: true,
                body: {}
            }).then(function (data) {
                if (data.status == 'OK') {
                    req.session.access_token = data.access_token;

                    var access_token = data.access_token;

                    callback(null, access_token);
                } else {
                    callback({
                        code: 500,
                        error: 'API error'
                    });
                }
            }).catch(function (error) {
                callback(error);
            })
        } else {
            callback(null, access_token);
        }
    }
}