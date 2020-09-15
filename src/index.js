const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const utils = require('./utils');

const config = utils.initConfig();

const feedURLTemplate = 'https://rss-bridge-1.herokuapp.com/?action=display&bridge=Bandcamp&context=By+band&type=changes&limit=100&format=Json&band=';

async function main() {
    // Create input and output directories if they don't exist already.
    await utils.initDirectories(config.input, config.output);
    // Process all the usernames.
    const usernames = await utils.processUsernames(config.input);
    // Make a Puppeteer instance.
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    // When we process the usernames, we are sending requests to
    // https://rss-bridge-1.herokuapp.com/?action=display&bridge=Bandcamp&context=By+band&band=pepperbrony&type=changes&limit=200&format=Json
    // with &band=<iterated username>.
    // That will return JSON structured like in NOTES.md.
    // We will attempt to download each album or track through Bandcamp's page with Puppeteer.
    // If it asks for an email (and zip code), use one provided through the configuration and either a random or
    // configured zip code.
    // If it asks for payment, we should save it for later somewhere.
    // Let's process the pages.
    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        // Get the JSON feed for the artist.
        let feedRes;
        utils.time('rss');
        try {
            feedRes = await utils.retry(() => fetch(feedURLTemplate + username), config.retry.fetch);
        } catch (err) {
            console.error(`Could not fetch RSS feed for "${username}":`);
            console.trace(err);
            continue;
        }
        console.debug(`RSS feed for "${username}" took ${utils.timeEnd('rss')} seconds`);
        const feed = await feedRes.json();
        // utils.time('sort');
        // const sorted = utils.sortFeedItems(feed.items);
        // console.debug(`Sorting items for "${username}" took ${utils.timeEnd('sort')} seconds`);
        for (const item of feed.items) {
        //const items = [{title: 'Foozogz - New Journey', url: 'https://pepperbrony.bandcamp.com/track/new-journey'}];
        //for (const item of items) {
            utils.time('loadbc');
            await page.goto(item.url);
            console.debug(`Loading Bandcamp for "${item.title}" took ${utils.timeEnd('loadbc')} seconds`);
            const albumData = await page.evaluate(() => TralbumData);
            utils.time('loadbcdl');
            await page.goto(albumData.freeDownloadPage);
            console.debug(`Loading Bandcamp Free DL page for "${item.title}" took ${utils.timeEnd('loadbcdl')} seconds`);
            const flacURL = await page.evaluate(async () => {
                return new Promise(resolve => {
                    try {
                        $('.item-format.button').click();
                    } catch (err) {
                        // Bandcamp likes to throw an error when we click to open the type list.
                    }
                    $($('ul > li > span.description').filter((i, e) => e.innerText === 'FLAC')[0]).click();
                    const toObserve = $('.download-title > a')[0];
                    const observer = new MutationObserver(mutations => {
                        resolve($('.download-title > a')[0].href);
                    });
                    observer.observe(toObserve, {
                        attributes: true,
                        attributeFilter: ['href']
                    });
                });
            });
            utils.time('dlflac');
            await utils.downloadToFile(flacURL, path.join(config.output.path, 'flac', item.title + '.flac'));
            console.debug(`Downloading FLAC for "${item.title}" took ${utils.timeEnd('dlflac')} seconds`);
            //break;
        }
    }
}

main().catch(err => {
    console.error('cbdl ran into an error during operation:');
    console.trace(err);
});
