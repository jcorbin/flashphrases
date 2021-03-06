var async = require('async');
var util = require('util');
var test = require('tape');

var debounce = require('../../lib/debounce');

function countCalls(assert, func) {
    self.called = 0;
    self.wasCalled = function(times, mess) {
        assert.equal(self.called, times, mess);
    };
    self.willBeCalled = function(called, timeout, mess, done) {
        setTimeout(function() {
            self.wasCalled(called, mess);
            done();
        }, timeout);
    };
    function self() {
        self.called++;
        func.apply(this, arguments);
    }
    return self;
}

function giveGet(assert, expected, func) {
    var self = {expected: expected, i: 0, j: 0};
    function give() {
        if (self.i < expected.length) {
            func(expected[self.i++]);
        }
    }
    function skip() {
        self.j++;
    }
    function get() {
        var got = Array.prototype.slice.call(arguments);
        if (self.j < expected.length) {
            assert.deepEqual(got, expected[self.j],
                util.format('got expected[%j] args', self.j)
            );
            self.j++;
        } else {
            assert.fail('got unexpected args');
        }
    }
    function getBatch(stuff) {
        var exp = self.expected
            .slice(self.j, self.i)
            .map(function(d) {return [{t: d[0]}, d];})
            ;
        self.j = self.i;
        assert.deepEqual(stuff, exp, 'got expected batched args');
    }
    self.give = give;
    self.skip = skip;
    self.get = get;
    self.getBatch = getBatch;
    return self;
}

test('trailing debounce', function(assert) {
    var db = debounce(countCalls(assert, function() {
        assert.deepEqual(
            Array.prototype.slice.call(arguments), [1, 2],
            'called with correct args');
    }));
    db(1, 2);
    db(2, 3);
    db.func.wasCalled(0, 'not called immediately');
    db.func.willBeCalled(1, 2, 'called once', assert.end);
});

test('trailing debounce, renew', function(assert) {
    var db = debounce(10, countCalls(assert, function() {
        assert.deepEqual(
            Array.prototype.slice.call(arguments), [1, 2],
            'called with correct args');
    }));
    db(1, 2);
    db.func.wasCalled(0, 'not called immediately');
    setTimeout(function() {
        db(2, 3);
        db.func.wasCalled(0, 'still not called');
    }, 5);
    setTimeout(function() {
        db.func.wasCalled(0, 'still not called');
    }, 12);
    db.func.willBeCalled(1, 17, 'called once', assert.end);
});

test('trailing debounce, sans-renew', function(assert) {
    var foo = giveGet(assert, [
        [1, 2],
        [2, 3]
    ], function(args) {
        db.apply(this, args);
    });

    var db = debounce({
        time: 10,
        renew: false
    }, countCalls(assert, foo.get));

    foo.give();
    db.func.wasCalled(0, 'not called immediately');
    setTimeout(function() {
        foo.give();
        db.func.wasCalled(0, 'still not called');
    }, 5);

    setTimeout(function() {
        db.func.wasCalled(1, 'called once');
        assert.end();
    }, 12);
});

test('leading debounce, renew', function(assert) {
    var foo = giveGet(assert, [
        [1, 2],
        [2, 3],
        [3, 4]
    ], function(args) {
        db.apply(this, args);
    });

    var db = debounce.leading(10, countCalls(assert, foo.get));

    foo.give();
    db.func.wasCalled(1, 'called immediately');

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(1, 'not called again');
        foo.skip();
    }, 5);

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(2, 'called once more');
    }, 20);

    setTimeout(function() {
        assert.notDeepEqual(db.timer, undefined, 'not timed out yet');
    }, 25);

    setTimeout(function() {
        assert.deepEqual(db.timer, undefined, 'timed out');
        assert.end();
    }, 35);
});

test('leading debounce, sans-renew', function(assert) {
    var foo = giveGet(assert, [
        [1, 2],
        [2, 3],
        [3, 4]
    ], function(args) {
        db.apply(this, args);
    });

    var db = debounce.leading(10, countCalls(assert, foo.get));

    foo.give();
    db.func.wasCalled(1, 'called immediately');

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(1, 'not called again');
        foo.skip();
    }, 5);

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(2, 'called once more');
    }, 17);

    setTimeout(function() {
        assert.notDeepEqual(db.timer, undefined, 'not timed out yet');
    }, 20);

    setTimeout(function() {
        assert.deepEqual(db.timer, undefined, 'timed out');
        assert.end();
    }, 30);
});

test('batch debounce, renew', function(assert) {
    var foo = giveGet(assert, [
        [1, 2],
        [2, 3],
        [3, 4]
    ], function(args) {
        db.apply({t: foo.i}, args);
    });

    var db = debounce.batch(10, countCalls(assert, foo.getBatch));

    foo.give();
    db.func.wasCalled(0, 'not called yet');

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(0, 'not called yet');
    }, 5);

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(0, 'not called yet');
    }, 10);

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(0, 'not called yet');
    }, 15);

    db.func.willBeCalled(1, 25, 'called once', assert.end);
});

test('batch debounce, sans-renew', function(assert) {
    var foo = giveGet(assert, [
        [1, 2],
        [2, 3],
        [3, 4]
    ], function(args) {
        db.apply({t: foo.i}, args);
    });

    var db = debounce.batch({
        time: 10,
        renew: false
    }, countCalls(assert, foo.getBatch));

    foo.give();
    db.func.wasCalled(0, 'not called yet');

    setTimeout(function() {
        db.func.wasCalled(1, 'called once already');
        foo.give();
        db.func.wasCalled(1, 'not called yet');
    }, 12);

    setTimeout(function() {
        foo.give();
        db.func.wasCalled(1, 'not called again yet');
    }, 17);

    db.func.willBeCalled(2, 25, 'called twice', assert.end);
});

test('debounce immed', function(assert) {
    var db = debounce(10, countCalls(assert, function() {
        assert.deepEqual(
            Array.prototype.slice.call(arguments), [1, 2],
            'called with correct args');
    }));

    function step1(next) {
        var called = db.func.called;
        db(1, 2);
        db.func.wasCalled(called, 'not called immediately');

        db.immed(null, [1, 2]);
        db.func.wasCalled(++called, 'called immediately on purpose');
        db.func.willBeCalled(called, 20, 'not called again', next);
    }

    function step2(next) {
        var called = db.func.called;

        db.immed(null, [1, 2]);
        db.func.wasCalled(++called, 'called immediately on purpose, with none deferred');
        db.func.willBeCalled(called, 20, 'not called again', next);
    }

    function step3(next) {
        var now = db.immedCaller;
        var called = db.func.called;

        now(1, 2);
        db.func.wasCalled(++called, 'called immediately on purpose, by immedCaller');
        db.func.willBeCalled(called, 20, 'not called again', next);
    }

    async.series([
        step1,
        step2,
        step3
    ], assert.end);
});
