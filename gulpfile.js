var gulp = require('gulp');
var mocha = require('gulp-mocha');
var join = require('path').join;
var fs = require('fs');
var path = require('path');
var istanbul = require('gulp-istanbul');


var testFiles = [
    'dist/test/suggestions/suggestionsTests.js',
    'dist/test/structure/structureTests.js'
]

// gulp.task('pre-test', function () {
//     return gulp.src([
//         'dist/*.js',
//         'dist/server/**/*.js',
//         'dist/client/**/*.js'
//     ])
//     // Covering files
//     .pipe(istanbul())
//     // Force `require` to return covered files
//     .pipe(istanbul.hookRequire());
// });

gulp.task('test', /*['pre-test'],*/ function () {
    global.isExpanded = null;

    return gulp.src(testFiles, { read: false })
        .pipe(mocha({
            bail: true,
            reporter: 'spec'
        }))
        //.pipe(istanbul.writeReports());
});