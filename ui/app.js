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
var markov = Markov.load(JSON.parse(fs.readFileSync('markov_source.json')));
function generatePhrase(numPhrases, minLength) {
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
    maxErrorPerWord: 2,
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

    console.log(result);
}

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
