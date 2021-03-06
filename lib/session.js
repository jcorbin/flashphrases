var EE = require('./event_stream_emitter');
var inherits = require('inherits');
var util = require('util');
var uuid = require('uuid');
var CachedObject = require('./cached_object');
var Result = require('./result');

function Session(dataOrId) {
    if (!(this instanceof Session)) {
        var Class = Session;
        if (typeof dataOrId === 'object') Class = Session.classForType(dataOrId.type);
        return new Class(dataOrId);
    }
    CachedObject.call(this);
    if (this.typeString) this.type = this.typeString;
    switch (typeof dataOrId) {
        case 'object':
            this.setData(dataOrId);
            break;
        default:
            this.setData({
                id: dataOrId,
                results: []
            });
    }
}

inherits(Session, EE);

Session.Types = {};

Session.registerType = function(Type) {
    var typeString = Type.name
        .split(/(?=[A-Z])/g)
        .map(function(s) {return s.toLowerCase();})
        .join('_')
        ;
    Session.Types[typeString] = Type;
    Type.typeString = Type.prototype.typeString = typeString;
    return Type;
};

Session.prototype.resultType = Result;

Session.prototype.createResult = function(data) {
    if (this.resultType) {
        return new this.resultType(data);
    } else {
        return data;
    }
};

Session.classForType = function(type) {
    if (type !== undefined) {
        if (Session.Types[type]) {
            return Session.Types[type];
        } else {
            throw new Error('invalid session type ' + JSON.stringify(type));
        }
    }
    return Session;
};

Session.prototype.setData = function(data) {
    if (this.id !== undefined && data.id !== this.id) {
        throw new Error(util.format('session data id mismatch (%j != %j)', data.id, this.id));
    }
    if (this.id === undefined) this.id = data.id || uuid.v4();
    if (data.type && this.type !== data.type) throw new Error('session type mismatch');
    this.setResults(data.results);
    this.emit('change');
};

Session.prototype.setResults = function(results) {
    if (this.resultType) {
        if (this.results) this.results.forEach(function(result) {
            result.removeAllListeners();
        });
    }
    if (results) {
        if (this.resultType) {
            results = results.map(function(result) {
                if (!(result instanceof this.resultType)) {
                    return this.createResult(result);
                }
            }, this);
        }
        this.results = results;
    } else {
        this.results = [];
    }
};

Session.prototype.addResult = function(result) {
    if (this.resultType) {
        if (!(result instanceof this.resultType)) {
            result = this.createResult(result);
        }
        var self = this;
        result.on('change', function() {
            self.clearCache();
            self.emit('change');
        });
    }
    this.results.push(result);
    this.clearCache();
    this.emit('resultAdd', result);
    this.emit('change');
    return result;
};

Session.prototype.currentLevelResults = function() {
    var rs = this.results, n = rs.length;
    if (!n) return [];
    var level = rs[n-1].level;
    var i=n-1;
    while (i>0 && rs[i-1].level === level) i--;
    return rs.slice(i);
};

function Legacy(dataOrId) {
    if (!(this instanceof Legacy)) return new Legacy(dataOrId);
    Session.call(this, dataOrId);
}

inherits(Legacy, Session);

Legacy.prototype.resultType = null;

Session.Legacy = Session.registerType(Legacy);

module.exports = Session;
