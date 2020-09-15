const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

function initConfig() {
    try {
        return require('../config.json');
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error('Configuration not found. Copy config.example.json to config.json and configure.');
            console.error('If config.example.json is missing, try running git checkout HEAD config.example.json.');
            process.exit(1);
        }
    }
}

// If directory creation fails for any reason than it already existing, throw. Cannot recover.
function mkdirFailed(err, type) {
    if (err.code !== 'EEXIST') {
        console.error('Could not create ' + type + ' directory. Details:');
        console.trace(err);
        process.exit(1);
    }
}

async function initDirectories(input, output) {
    let newInputDir = true;
    await fs.promises.mkdir(input.path).catch(err => {
        mkdirFailed(err, 'input');
        newInputDir = false;
    });
    await fs.promises.mkdir(output.path).catch(err => mkdirFailed(err, 'output'));
    await fs.promises.mkdir(path.join(output.path, 'flac')).catch(err => mkdirFailed(err, 'output FLAC'));
    await fs.promises.mkdir(path.join(output.path, 'htmls')).catch(err => mkdirFailed(err, 'output HTMLs'));
    await fs.promises.mkdir(path.join(output.path, 'rips')).catch(err => mkdirFailed(err, 'output rips'));
    if (newInputDir) {
        console.info('Input and output directories have been created.');
        console.info('Please provide input according to README.md before continuing.');
        process.exit(1);
    }
}

async function processUsernames(input) {
    const usernameListRaw = await fs.promises.readFile(path.join(input.path, input.usernameList), 'utf8').catch(err => {
        if (err.code === 'ENOENT') {
            console.error('Could not find username list at the configured path and filename.');
            process.exit(1);
        } else {
            console.error('Could not read username list for an unknown reason.');
            console.trace(err);
            process.exit(1);
        }
    });
    return usernameListRaw.split('\n').map(username => username.trim());
}

function sortFeedItems(feedItems) {
    const albums = [];
    const tracks = [];
    for (const item of feedItems) {
        if (/bandcamp\.com\/album/.test(item.url)) {
            albums.push(item);
        } else if (/bandcamp\.com\/track/.test(item.url)) {
            tracks.push(item);
        }
    }
    return { albums, tracks };
}

function retry(fn, opts) {
    // Resolve if retries succeeded, reject otherwise all retries have been exhausted
    const errors = [];
    return new Promise(async (resolve, reject) => {
        for (let i = 0; i < opts.count; i++) {
            try {
                const result = fn();
                resolve(result);
                break;
            } catch (err) {
                errors.push(err);
                await sleep(opts.delay);
            }
        }
        reject(errors);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadToFile(url, filePath) {
    // console.debug('Downloading file from ' + url + ' to ' + filePath);
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}

const times = {};

function time(label) {
    times[label] = process.hrtime.bigint();
}

function timeEnd(label) {
    const time = Math.abs(Number(times[label] - process.hrtime.bigint())) / 1e9;
    delete times[label];
    return time;
}

module.exports = { initConfig, initDirectories, processUsernames, sortFeedItems, retry, downloadToFile, time, timeEnd };
