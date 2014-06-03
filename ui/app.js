var h = require('hyperscript');

// XXX require('global/mumble')
var window = global.window;
var document = global.document;

document.title = 'Flash Phrases';
document.head.appendChild(
    h('link', {
        rel: 'stylesheet',
        type: 'text/css',
        href: 'style.css'
    }));

////

var fs = require('fs');
var Markov = require('../lib/markov');

function loadMarkovMap(data) {
    var markovMap = {};
    if (data.transitions) {
        var markov = Markov.load(data);
        markovMap[markov.stateSize] = markov;
    } else {
        Object.keys(data).forEach(function(key) {
            markovMap[key] = Markov.load(data[key]);
        });
    }
    return markovMap;
}

var data = JSON.parse(fs.readFileSync('markov_source.json'));
var markovMap = loadMarkovMap(data);

function getMarkov(k) {
    if (markovMap[k]) return markovMap[k];
    var best = null;
    Object.keys(markovMap).forEach(function(key) {
        var markov = markovMap[key];
        if (!best ||
            (markov.stateSize <= k && markov.stateSize > best.stateSize)
        ) best = markov;
    });
    if (best) markovMap[k] = best;
    return best;
}

function generatePhrase(numPhrases, minLength) {
    var markov = getMarkov(numPhrases);
    if (!markov) throw new Error('unable to get a markov for ' + numPhrases + '-phrases');
    var phrase = '';
    while (phrase.length < minLength) {
        phrase = markov.chain(numPhrases).join(' ');
    }
    return phrase.toLowerCase();
}

var PhrasePrompt = require('./phrase_prompt');
var prompt = new PhrasePrompt({
    generatePhrase: generatePhrase,
    displayTime: 1500,
    inputTime: 10000,
    maxErrorPerWord: 1,
    repromptDelay: 200,
    complexity: {
        initial: [2, 10],
        step: [1, 5],
        lo: [2, 10],
        hi: [10, 50]
    }
});

var PromptLoop = require('./prompt_loop');
var loop = new PromptLoop(prompt);

var StartStop = require('./start_stop');
var ss = new StartStop();
ss.contentElement.appendChild(prompt.element);
document.body.appendChild(ss.element);

function scoreResult(result) {
    if (!result.correct) return 0;
    var diffDisplay = Math.max(0, result.timeout.display - result.elapsed.display);
    var diffInput = Math.max(0, result.timeout.input - result.elapsed.input);
    var diffError = result.maxErrors - result.dist;
    diffDisplay /= 100; // milli -> deci seconds
    diffInput /= 100; // milli -> deci seconds
    return diffError + diffInput + diffDisplay;
}

var history = [];
var levelScore = 0;
function onResult(result) {
    // TODO: prune and/or archive history?
    history.push(result);

    var k = 3; // TODO setting

    var lastK = history.slice(-k);
    var lastKExpired = lastK
        .reduce(function(allExpired, result) {
            return allExpired && Boolean(result.expired);
        }, lastK.length >= k);
    if (lastKExpired) return ss.stop();

    result.score = scoreResult(result);

    // TODO: adjust dispalyTime and inputTime in addition to complexity

    levelScore += result.score;
    var threshold = 2 + (2 * prompt.complexity.level) * 100;
    if (levelScore > threshold) {
        levelScore = 0;
        prompt.complexity.level++;
    }

    var util = require('util');
    console.log(util.format(
        'level %s (%s/%s = %s%%)',
        prompt.complexity.level,
        levelScore, threshold,
        (100 * Math.round(levelScore) / threshold).toFixed(2)));
    console.log(result);
}

prompt.on('stopkey', function(event) {
    if (event.keyCode === 0x1b) ss.stop();
});
ss.on('start', loop.start.bind(loop));
ss.on('stop', loop.stop.bind(loop));
ss.on('keypress', function(event) {
    if (prompt.inputing) return;
    var char = String.fromCharCode(event.charCode);
    if (char !== prompt.expected[0]) return;
    event.stopPropagation();
    event.preventDefault();
    prompt.showInput();
    prompt.inputElement.value = char;
    prompt.updateInput();
});
ss.addListeners(window);
prompt.on('result', onResult);
