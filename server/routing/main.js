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
};