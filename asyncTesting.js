var sys = require('sys');
var assert = require('assert');

var AssertWrapper = exports.AssertWrapper = function(test) {
  this.__test = test;
  var assertion_functions = [
    'ok',
    'equal',
    'notEqual',
    'deepEqual',
    'notDeepEqual',
    'strictEqual',
    'notStrictEqual',
    'throws',
    'doesNotThrow'
    ];

  assertion_functions.forEach(function(func_name) {
    this[func_name] = function() {
        try {
          assert[func_name].apply(null, arguments);
          this.__test.__numAssertions++;
        }
        catch(err) {
          if( err instanceof assert.AssertionError ) {
            this.__test.failed(err);
          }
        }
      }
    }, this);
};

var Test = function(name, func, suite) {
  this.assert = new AssertWrapper(this);
  this.numAssertionsExpected = null;

  this.__name = name;
  this.__func = func;
  this.__suite = suite;
  this.__promise = new process.Promise();
  this.__numAssertions = 0;
  this.__finished = false;
  this.__failure = null;
  this.__symbol = '.';
};
Test.prototype.run = function() {
  sys.puts('Starting test "' + this.__name + '" ...');
  this.__func(this);
};
Test.prototype.finish = function() {
  if( !this.__finished ) {
    this.__finished = true;

    if( this.__failure === null && this.numAssertionsExpected !== null ) {
      try {
        var message = this.numAssertionsExpected + (this.numAssertionsExpected == 1 ? ' assertion was ' : ' assertions were ')
                    + 'expected but only ' + this.__numAssertions + ' fired';
        assert.equal(this.numAssertionsExpected, this.__numAssertions, message);
      }
      catch(err) {
        this.__failure = err;
        this.__symbol = 'F';
      }
    }

    this.__promise.emitSuccess(this.__numAssertions);
  }
};
Test.prototype.failed = function(err) {
  if( !this.__finished ) {
    this.__failure = err;
    this.__symbol = 'F';
    this.finish();
  }
};

var tests = [];
process.addListener('exit', function() {
    if( tests.length < 1 ) {
      return;
    }

    var failures = [];
    sys.puts('\nResults:');
    tests.forEach(function(t) {
        if( !t.__finished ) {
          t.finish();
        }
        if( t.__failure !== null ) {
          failures.push(t);
        }

        sys.print(t.__symbol);
      });

    sys.puts('');
    failures.forEach(function(t) {
        sys.puts('');

        sys.print('test "' + t.__name + '" failed: ');
        sys.puts(t.__failure.stack || t.__failure);
      });

    sys.puts('');
  });

var test = exports.test = function(name, func) {
  var t = new Test(name, func);
  tests.push(t);

  t.run();
};

var TestSuite = exports.TestSuite = function(name) {
  this.name = name;
  this.setup = null;
  this.teardown = null;
  this.wait = false;
  this.tests = [];
  this.numAssertions = 0;
  this.numFinishedTests = 0;
  this.finished = false;

  var suite = this;
  process.addListener('exit', function() {
      suite.finish();
    });
};
TestSuite.prototype.finish = function() {
  if( this.finished ) {
    return;
  }

  this.finished = true;

  sys.puts('\nResults for ' + (this.name ? '"' + (this.name || '')+ '"' : 'unnamed suite') + ':');
  var failures = [];
  this.tests.forEach(function(t) {
      if( !t.__finished ) {
        t.finish();
      }
      if( t.__failure !== null ) {
        failures.push(t);
      }
      sys.print(t.__symbol);
    });

  sys.puts('');
  sys.print(this.tests.length + ' test' + (this.tests.length == 1 ? '' : 's') + '; ');
  sys.print(failures.length + ' failure' + (failures.length == 1 ? '' : 's') + '; ');
  sys.print(this.numAssertions + ' assertion' + (this.numAssertions == 1 ? '' : 's') + ' ');
  sys.puts('');

  failures.forEach(function(t) {
      sys.puts('');

      sys.print('test "' + t.__name + '" failed: ');
      sys.puts(t.__failure.stack || t.__failure);
    });

  sys.puts('');
};

TestSuite.prototype.setup = function(func) {
  this.setup = func;
  return this;
};
TestSuite.prototype.teardown = function(func) {
  this.teardown = func;
  return this;
};
TestSuite.prototype.waitForTests = function(yesOrNo) {
  if(typeof yesOrNo == 'undefined') {
    yesOrNo = true;
  }
  this.wait = yesOrNo;
  return this;
};
TestSuite.prototype.runTests = function(tests) {
  sys.puts('\n' + (this.name? '"' + (this.name || '')+ '"' : 'unnamed suite'));
  for( var testName in tests ) {
    var t = new Test(testName, tests[testName], this);
    this.tests.push(t);
  };

  this.runTest(0);
};
TestSuite.prototype.runTest = function(testIndex) {
  if( testIndex >= this.tests.length ) {
    return;
  }

  var t = this.tests[testIndex];

  if(this.setup) {
    this.setup.apply(t);
  }

  var suite = this;
  var wait = suite.wait;
  t.__promise.addCallback(function(numAssertions) {
      if(suite.teardown) {
        suite.teardown.apply(t);
      }

      suite.numAssertions += numAssertions;
      suite.numFinishedTests++;

      if( wait ) {
        suite.runTest(testIndex+1);
      }

      if( suite.numFinishedTests == suite.tests.length ) {
        suite.finish();
      }
    });

  t.run();

  if( !wait ) {
    suite.runTest(testIndex+1);
  }

};