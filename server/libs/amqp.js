var log = require('./log')(module);
var config = require('./config');

var amqp = require('amqplib');

var connection = amqp
    .connect(config.get('amqp:uri'))
    .then(function (connection) {
        log.info('Connected to %s', config.get('amqp:uri'));

        return connection;
    })
    .catch(console.warn);

module.exports.connection = connection;