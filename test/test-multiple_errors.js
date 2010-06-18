
exports['test async error 1'] = function(test) {
  process.nextTick(function() {
      throw new Error();
    });
};
exports['test sync error'] = function(test) {
  throw new Error('Oooops');
};
exports['test async error 2'] = function(test) {
  setTimeout(function() {
      throw new Error();
    }, 500);
};

if (module == require.main) {
  require('../async_testing').run(exports, process.ARGV);
}
