var log = require('./../libs/log')(module);
var config = require('./config');

var Promise = require('bluebird');
var request = require('request');
var requestPromise = require('request-promise');
var cheerio = require('cheerio');
var url = require('url');
var fs = require('fs');
var fsPromise = require('fs-promise');
var mime = require('mime-types');
var sizeOf = require('image-size');

var amqpConnection = require('./../libs/amqp').connection;

var ClientModel = require('./../libs/mongoose').ClientModel;
var JobModel = require('./../libs/mongoose').JobModel;
var ImageModel = require('./../libs/mongoose').ImageModel;

var imageSavePath = [process.cwd(), 'server', config.get('storage:images')].join('/');

log.debug(imageSavePath);

amqpConnection
    .then(function (connection) {
        return connection.createConfirmChannel(config.get('amqp:queue:mainJob:name'));
    })
    .then(function (channel) {
        channel.prefetch(config.get('amqp:queue:mainJob:limit'));
        channel.assertQueue(config.get('amqp:queue:mainJob:name'));
        channel.consume(config.get('amqp:queue:mainJob:name'), function (message) {
            if (message) {
                log.info('Message received!');
                log.debug(JSON.parse(message.content.toString()));
                new MainJob(JSON.parse(message.content.toString()).jobId).run(function () {
                    channel.ack(message);
                });
            }
        });
    });

function MainJob(jobId) {
    this.jobId = jobId;

    this.run = function (callback) {
        var that = this;

        (new Promise(function (resolve, reject) {
            log.verbose('Finfing job');
            JobModel.findById(that.jobId, function (error, job) {
                if (error) {
                    reject(error);
                } else {
                    that.job = job;

                    resolve(job);
                }
            });
        }))      // finding job
            .then(function (job) {
                job.status = JobModel.getStatusList().in_progress;

                return job;
            })                      // update status to in_progress
            .then(updateJob)                                 // update job
            .then(function (job) {
                log.info('Check directory is exists');
                return fsPromise.exists([imageSavePath, job.id].join('/')).then(function (exists) {
                    return {
                        exists: exists,
                        job: job
                    }
                });
            })                      // check directory is exists
            .then(function (obj) {
                log.verbose('Make dir');
                if (obj.exists) {
                    return obj.job;
                } else {
                    return fsPromise.mkdir([imageSavePath, obj.job.id].join('/')).then(function () {
                        return obj.job;
                    });
                }
            })                      // make dir
            .then(function (job) {
                log.verbose('Request HTML');
                return requestPromise(job.url);
            })                      // request page
            .then(function (html) {
                log.verbose('Parsing HTML');
                var $ = cheerio.load(html);

                var images = [];

                $('img').map(function (index, element) {
                    var src = $(element).attr('src');

                    if (!src) return;

                    images.push(url.resolve(that.job.url, src));
                });

                return images;
            })                     // parse html
            .then(function (images) {
                log.verbose('Making promises for Promise.all()');
                var promises = images.map(function (image) {
                    return requestPromise({uri: image, resolveWithFullResponse: true})
                        .then(function (response) {
                            log.verbose('Making image model');

                            return new ImageModel({
                                job_id: that.jobId,
                                path_remote: image,
                                size: response.headers['content-length'],
                                content_type: response.headers['content-type']
                            });
                        })        // make image model
                        .then(function (imageModel) {
                            log.verbose('Piping image');

                            imageModel.path_local = [
                                [imageSavePath, that.job.id, imageModel.id].join('/'),
                                mime.extension(imageModel.content_type)
                            ].join('.');

                            return new Promise(function (resolve, reject) {
                                log.verbose('Piping image in new promise');

                                var destination = fs.createWriteStream(imageModel.path_local);
                                destination.on('finish', function () {
                                    resolve(imageModel);
                                }).on('error', function (error) {
                                    reject(error);
                                });

                                request(imageModel.path_remote).pipe(destination);
                            });
                        })      // piping image
                        .catch(reThrow);
                });

                return Promise.settle(promises).then(function (images) {
                    log.verbose('Settling batch image promises');
                    var fulfilled = [];

                    images.map(function (image) {
                        if (image.isFulfilled()) {
                            fulfilled.push(image.value());
                        }
                        if (image.isRejected()) {
                            log.error([image.reason().name, image.reason().statusCode].join(': '));
                        }
                    });

                    return fulfilled;
                });
            })                   // batch images make object and pipe to file
            .then(function (images) {
                var imagePromises = images.map(function (imageModel) {
                    return (new Promise(function (resolve, reject) {
                        log.verbose('Get image size in created Promise');
                        sizeOf(imageModel.path_local, function (error, dimensions) {
                            if (error) {
                                reject(error);
                            } else {
                                imageModel.width = dimensions.width;
                                imageModel.height = dimensions.height;

                                resolve(imageModel);
                            }
                        });
                    }));
                });

                return Promise.settle(imagePromises).then(function (images) {
                    var fulfilled = [];

                    images.map(function (image) {
                        if (image.isFulfilled()) {
                            fulfilled.push(image.value());
                        }
                        if (image.isRejected()) {
                            console.log(image.reason());
                        }
                    });

                    return fulfilled;
                });
            })                   // batch get image size
            .then(function (images) {
                var imagesSavePromises = images.map(function (imageModel) {
                    return new Promise(function (resolve, reject) {
                        imageModel.save(function (error) {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(imageModel);
                            }
                        });
                    });
                });

                return Promise.settle(imagesSavePromises).then(function (images) {
                    var fulfilled = [];

                    images.map(function (image) {
                        if (image.isFulfilled()) {
                            fulfilled.push(image.value());
                        } else {
                            console.log(image.reason());
                        }
                    });

                    return fulfilled;
                })
            })                   // batch saving models into mongodb
            .then(function () {
                that.job.status = JobModel.getStatusList().complete;

                return that.job;
            })                         // update status to complete
            .then(updateJob)                                 // update job
            .then(function (job) {
                log.verbose('Complete');
                callback();
            })                      // complete
            .catch(function (error) {
                log.debug(error);
            });
    };
}

function reThrow(error) {
    throw error;
}

function updateJob(job) {
    return (new Promise(function (resolve, reject) {
        job.save(function (error) {
            if (error) {
                reject(error);
            } else {
                log.debug('Job status updated to %s', job.status);

                resolve(job);
            }
        })
    }))
        .then(function (job) {
            return job;
        }).catch(reThrow);
}