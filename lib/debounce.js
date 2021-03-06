var extend = require('xtend/mutable');

/*
 * TODO:
 * - batch limits
 * - time/rate limits
 *   - at least every X
 *   - other?
 */

var defaults = {
    renew    : true,
    time     : 0,
    setTimer : setTimer,
    immed    : immed,
    clear    : clear,
    fire     : fire,
    finish   : finish
};

function debounce(options, func) {
    options = setOptions(options, func);
    extend(self, defaults, options);
    self.immedCaller = function() {
        return self.immed(this, arguments);
    };
    function self() {
        self.handle(this, arguments);
        if (self.timer) {
            if (!self.renew) return;
            self.clear();
        }
        self.timer = self.setTimer();
    }
    return self;
}

function setOptions(options, func) {
    if (func === undefined && typeof options === 'function') {
        options = {func: options};
    }
    if (typeof options === 'number') {
        options = {time: options};
    }
    if (typeof func === 'function') options.func = func;
    if (typeof options.func !== 'function') throw new Error('invalid function');
    return options;
}

function withFixedOptinos(fixed) {
    return function(options, func) {
        options = setOptions(options, func);
        options = extend(options, fixed);
        return debounce(options, func);
    };
}

function setTimer() {
    return setTimeout(this.finish.bind(this), this.time);
}

function immed(that, args) {
    this.apply(that, args);
    return this.finish();
}

function finish() {
    this.clear();
    return this.fire();
}

function clear() {
    clearTimeout(this.timer);
    delete this.timer;
}

function fire() {
    if (this.future) {
        var ret = this.future();
        delete this.future;
        return ret;
    }
}

var handle = {};

handle.rising  =
handle.leading = function(that, args) {
    if (!this.future) {
        this.future = function() {};
        this.func.apply(that, args);
    }
};

handle.falling  =
handle.trailing = function(that, args) {
    if (!this.future) {
        var func = this.func;
        this.future = function() {return func.apply(that, args);};
    }
};

handle.defer =
handle.batch = function(that, args) {
    if (!this.future) {
        this.buffer = [];
        this.future = function() {
            this.func.call(this, this.buffer);
            delete this.buffer;
        };
    }
    this.buffer.push([that, Array.prototype.slice.call(args)]);
};

defaults.handle = handle.trailing;

module.exports          = debounce;
module.exports.defaults = defaults;
module.exports.finish   = finish;
module.exports.handle   = handle;

Object.keys(handle).forEach(function(key) {
    module.exports[key] = withFixedOptinos({handle: handle[key]});
});
