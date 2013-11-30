/**
 * Created by Gilad Peleg on 25/11/13.
 */

'use strict';

var fs = require('fs'),
    _ = require('lodash');

exports.task = function (grunt) {
    var exports = {
        options: {}
    };

    exports.extractedTargets = {};

    // set up relevant regex for jade find
    exports.regex = {
        buildRegex       : /<!-- build/,
        buildExtractRegex: /build:(\w+)\s+((\w*[\/._]*)+)/,
        endBuildRegex    : /<!-- endbuild/,
        jsSourceRegex    : /src=['"]((\w*[\/._-]*)+)['"]/,
        cssSourceRegex   : /href=['"]((\w*[\/._-]*)+)['"]/
    };

    exports.defaultTasks = {
        concat: {
            options: {
                banner   : '',
                footer   : '',
                separator: '\n',
                process  : function (src, filepath) {
                    return '\n/*! START:' + filepath + '**/\n' +
                        src + '\n/*! END:' + filepath + '**/';
                }
            },
            files  : []
        },

        uglify: {
            options: {
                report          : 'min',
                preserveComments: 'some',
                compress        : false
            },
            files  : []
        },

        cssmin: {
            options: {
                report: 'min'
            },
            files  : []
        }
    };

    exports.addConcatFileTarget = function (concat, src, dest) {
        concat.files.push({
            src : src,
            dest: dest
        });
    };

    /**
     *
     * @param uglify
     * @param target
     */
    exports.addUglifyTarget = function (uglify, target) {
        var uglifyTarget = {};
        uglifyTarget[target] = target;
        uglify.files.push(uglifyTarget);
    };

    /**
     * Process the extracted targets
     * @param parameters
     * @param {Object} parameters.extractedTargets
     * @param parameters.concat
     * @param parameters.uglify
     * @returns {number} totalFiles Total files processed as source files
     */
    exports.processTasks = function (parameters) {
        var extractedTargets = parameters.extractedTargets;
        var concat = parameters.concat;
        var uglify = parameters.uglify;
        var cssmin = parameters.cssmin;
        var totalFiles = 0;

        _.each(extractedTargets, function (item, target) {

            exports.addConcatFileTarget(concat, item.src, target);
            grunt.log.oklns('Target ' + target + ' contains ' + item.src.length + ' files.');
            totalFiles += item.src.length;

            if (item.type === 'js') {
                exports.addUglifyTarget(uglify, target);
            }
            else if (item.type === 'css') {
                exports.addUglifyTarget(cssmin, target);
            }
        });

        return totalFiles;
    };

    exports.getSrcRegex = function (type) {
        if (type === 'js') {
            return exports.regex.jsSourceRegex;
        }
        else if (type === 'css') {
            return exports.regex.cssSourceRegex;
        }
        return null;
    };

    exports.extractTargetsFromJade = function (location, extractedTargets) {
        //current temp file
        var srcRegex, insideBuild = false;
        var target = null, extracted = [], type = null, tempExtraction = {};

        var file = grunt.file.read(location).split('\n');

        _.each(file, function (line, lineIndex) {
            //if still scanning for build:<type>
            if (!insideBuild) {
                //look for pattern build:<type>
                if (line.match(exports.regex.buildRegex)) {
                    extracted = line.match(exports.regex.buildExtractRegex);
                    type = extracted[1];
                    target = extracted[2];

                    //if unrecognized build type
                    if (!_.contains(['css', 'js'], type)) {
                        grunt.log.error('Unsupported build type: ' + type + ' in line number:' + lineIndex);
                        return;
                    }
                    else if (!target) {
                        grunt.log.warn('Target not found in line:' + line);
                        return;
                    }

                    grunt.verbose.writelns('Found build:<type> pattern in line:', lineIndex);

                    //default empty target
                    tempExtraction[target] = {
                        type: type,
                        src : []
                    };

                    insideBuild = true;
                }
            }
            //got to end of build: <!-- endbuild -->
            else if (line.match(exports.regex.endBuildRegex) && type && target) {
                insideBuild = false;
                extractedTargets[target] = {};
                _.merge(extractedTargets[target], tempExtraction[target]);
                type = target = null;
            }
            //we are inside a build:<type> block
            else {
                srcRegex = exports.getSrcRegex(type);
                var src = line.match(srcRegex);

                if (src && src[1]) {
                    src = src[1];
                    if (src.charAt(0) === '/') {
                        src = src.substr(1);
                    }

                    //if path actually exists
                    if (fs.existsSync(src)) {
                        tempExtraction[target].src.push(src);
                    }
                    else {
                        grunt.log.warn("Found script src that doesn't exist: " + src);
                    }
                }
            }
        });

        if (insideBuild) {
            grunt.fatal("Couldn't find `endbuild` in file: " + location + ", target: " + target);
        }
    };

    return exports;

};