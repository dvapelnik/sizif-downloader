var log = require('./../libs/log')(module);
var config = require('./../libs/config');

var fs = require('fs');
var fsPromise = require('fs-promise');

var ImageModel = require('./../libs/mongoose').ImageModel;

module.exports = function (app) {
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
    })
};

function reThrow(error) {
    throw error;
}