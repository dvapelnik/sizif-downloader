module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        bowercopy: {
            options: {
                srcPrefix: 'bower_components',
                destPrefix: 'public/assets'
            },
            stylesheets: {
                files: {
                    'bootstrap/css/bootstrap.min.css': 'bootstrap/dist/css/bootstrap.min.css',
                    'bootstrap/css/bootstrap-theme.min.css': 'bootstrap/dist/css/bootstrap-theme.min.css',
                    'growl/css/jquery.growl.css': 'growl/stylesheets/jquery.growl.css'
                }
            },
            js: {
                files: {
                    'js/jquery.min.js': 'jquery/dist/jquery.min.js',
                    'js/react-with-addons.min.js': 'react/react-with-addons.min.js',
                    'bootstrap/js/bootstrap.min.js': 'bootstrap/dist/js/bootstrap.min.js',
                    'growl/js/jquery.growl.js': 'growl/javascripts/jquery.growl.js'
                }
            },
            fonts: {
                files: {
                    'bootstrap/fonts': 'bootstrap/dist/fonts'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-bowercopy');
    grunt.registerTask('default', ['bowercopy']);
};