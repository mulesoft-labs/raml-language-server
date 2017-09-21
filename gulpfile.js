var gulp = require('gulp');
var mocha = require('gulp-mocha');
var join = require('path').join;
var fs = require('fs');
var path = require('path');
var istanbul = require('gulp-istanbul');

var testFiles = [
    "dist/test/suggestions/suggestionsTests.js",
    "dist/test/parsertests/parserTests.js",
    "dist/test/structure/structureTests.js",
    "dist/test/parsertests/parserTests2.js"
];

var testFilesComplete = [
    "dist/test/suggestions/suggestionsTests.js",
    "dist/test/parsertests/parserTests.js",
    "dist/test/structure/structureTests.js",
    "dist/test/parsertests/parserTests2.js",
    "dist/test/parsertests/parserTests3.js",
    "dist/test/parsertests/astReuseTestsBasicTyping.js"
];

gulp.task('test', function() {
    global.isExpanded = null;
    
    return gulp.src(testFiles, {
        read: false
    }).pipe(mocha({
        bail: true,
        reporter: 'spec'
    }));
});

gulp.task('testComplete', function() {
    global.isExpanded = null;

    return gulp.src(testFilesComplete, {
        read: false
    }).pipe(mocha({
        bail: true,
        reporter: 'spec'
    }));
});