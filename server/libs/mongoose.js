var mongoose = require('mongoose');
var validator = require('validator');
var log = require('./log')(module);
var config = require('./config');

mongoose.connect(config.get('mongoose:uri'));

var db = mongoose.connection;

db.on('error', function (err) {
    log.error('connection error:', err.message);
});
db.once('open', function callback() {
    log.info("Connected to DB!");
});

var Schema = mongoose.Schema;

var Client = new Schema({
    created: {
        type: Date,
        default: Date.now
    }
});

var Job = new Schema({
    client_id: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['created', 'pending', 'in_progress', 'complete', 'error'],
        default: 'created',
        required: true
    },
    created: {
        type: Date,
        required: true,
        default: Date.now
    },
    finished: {
        type: Date,
        required: false
    }
});
Job.path('url').validate(function (value) {
    return validator.isURL(value);
});
Job.statics.getStatusList = function () {
    return {
        created: 'created',
        pending: 'pending',
        in_progress: 'in_progress',
        complete: 'complete',
        error: 'error'
    }
};

var Image = new Schema({
    job_id: {
        type: String,
        required: true
    },
    path_remote: {
        type: String,
        required: true
    },
    path_local: {
        type: String,
        required: true
    },
    width: {
        type: Number,
        required: true
    },
    height: {
        type: Number,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    content_type: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        required: true,
        default: Date.now
    }
});
Image.path('size').validate(validatePositiveNumber);
Image.path('width').validate(validatePositiveNumber);
Image.path('height').validate(validatePositiveNumber);

module.exports = {
    connection: db,
    ClientModel: mongoose.model('Client', Client),
    JobModel: mongoose.model('Job', Job),
    ImageModel: mongoose.model('Image', Image)
};

function validatePositiveNumber(value) {
    return validator.isNumeric(value) && value >= 0;
}