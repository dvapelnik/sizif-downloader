var nconf = require('nconf');

nconf.argv()
    .env()
    .file({
        file: [process.cwd(), 'server', '/config.json'].join('/')
    });

module.exports = nconf;