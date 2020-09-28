const fs = require('fs');
const { join } = require('path');
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

/**
 * Creates a directory recursively and exits if an error occurs that's not EEXIST.
 * @param path - The directory path.
 * @returns {Promise<void>}
 */
async function mkdir(path) {
    await fs.promises.mkdir(path, { recursive: true }).catch(err => {
        if (err.code !== 'EEXIST') {
            console.error(`Could not create ${path}. Details:`);
            console.trace(err);
            process.exit(1);
        }
    });
}

async function initDirectories(input, output) {
    let newInputDir = true;
    await fs.promises.mkdir(input.path).catch(err => {
        mkdirFailed(err, 'input');
        newInputDir = false;
    });
    await mkdir(join(output.path, output.artwork));
    await mkdir(join(output.path, output.flacs, 'free'));
    await mkdir(join(output.path, output.metadata));
    await mkdir(join(output.path, output.rips));
    if (newInputDir) {
        console.info('Input and output directories have been created.');
        console.info('Please provide input according to README.md before continuing.');
        process.exit(1);
    }
}

async function initArtistDirectories(output, artist) {
    await mkdir(join(output.path, output.artwork, artist));
    await mkdir(join(output.path, output.flacs, 'free', artist));
    await mkdir(join(output.path, output.metadata, artist));
    await mkdir(join(output.path, output.rips, artist));
}

async function processUsernames(input) {
    const usernameListRaw = await fs.promises.readFile(join(input.path, input.usernameList), 'utf8').catch(err => {
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

module.exports = { initConfig, mkdirFailed, initDirectories, initArtistDirectories, processUsernames, sortFeedItems, retry, downloadToFile, time, timeEnd };
