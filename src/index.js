const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const utils = require('./utils');

const config = utils.initConfig();

async function main() {
    await utils.initDirectories(config.input, config.output);
    const browser = await puppeteer.launch({ headless: config.headless });
    const page = await browser.newPage();
    for (const username of await utils.processUsernames(config.input)) {
        const feed = await getFeed(username);
        for (const item of feed.items) {
            try {
                await page.goto(item.url);
            } catch (err) {
                console.error(`WARNING: Could not check "${item.url}". Skipping item.`);
                continue;
            }
            // We want the URL-friendly artist name, but TralbumData only gives us the friendly display name.
            let artistExec = /\/\/(.+).bandcamp/.exec(item.url) || /\/\/bandcamp\.com\/(.+)/.exec(item.url);
            if (artistExec == null) {
                console.error(`Could not determine artist from URL "${item.url}". Skipping item.`);
                continue;
            }
            const artist = artistExec[1];
            // Surprisingly, we don't have the URL-friendly album or track names either. One of these will be null!
            const albumExec = /album\/(.+)[?#]*/.exec(item.url);
            const trackExec = /track\/(.+)[?#]*/.exec(item.url);
            if (albumExec == null && trackExec == null) {
                console.error(`Could not determine album/track from URL "${item.url}". Skipping item.`);
                continue;
            }
            let album;
            let track;
            if (albumExec != null) album = albumExec[1];
            if (trackExec != null) track = trackExec[1];
            // Create artist sub-folders.
            await utils.initArtistDirectories(config.output, artist);
            const data = await page.evaluate(() => TralbumData);
            if (data == null) {
                console.error(`Could not get album data for ${artist} - do they still exist? Skipping item.`);
                continue;
            }
            // Save the metadata.
            if (data.item_type === 'album') {
                await fs.writeFile(path.join(config.output.path, config.output.metadata, artist, album + '.json'), JSON.stringify(data));
            } else if (data.item_type === 'track') {
                await fs.writeFile(path.join(config.output.path, config.output.metadata, artist, track + '.json'), JSON.stringify(data));
            }
            await fs.writeFile(path.join(config.output.path, config.output.metadata, artist, 'metadata.json'), JSON.stringify(data));
            // Save the album art.
            const allArtURLs = [];
            // Both albums and tracks may have an art_id. We only need to worry about album tracks.
            if (data.art_id != null) allArtURLs.push(`https://f4.bcbits.com/img/a${data.art_id}_0.jpg`);
            // If the item type is an album, we need to iterate through all of the tracks in the album to get the
            // art_id. Unfortunately, Bandcamp doesn't provide the art_id through the mini-objects, so we'll have to use
            // a request to get the art_id from each track page. Note that data.trackinfo exists on both albums and
            // tracks. For tracks, the only item will be the track in question. Here, we'll filter out that track, only
            // iterating albums.
            data.trackinfo = data.trackinfo.filter(track => track.id !== data.id);
            console.info('Iterating over tracks...');
            for (let i = 0; i < data.trackinfo.length; i++) {
                // For each track in this album, go to the track's page. Save the metadata and artwork.
                const track = data.trackinfo[i];
                const trackURL = item.url.replace(/\/album\/.+/, track.title_link);
                console.info(`[${i+1}/${data.trackinfo.length}] ${trackURL}`);
                const res = (await (await fetch(trackURL)).text()).replace(/&quot;/g, '"');
                // The only issue with having the match end with "> is that if Bandcamp decides to, say, render
                // HTML inside
                const trackData = JSON.parse(/<div id="pagedata" data-blob="(.+)">/.exec(res)[1]);
                const artURL = `https://f4.bcbits.com/img/a${trackData.art_id}_0.jpg`;
                if (trackData.art_id != null && !allArtURLs.includes(artURL)) allArtURLs.push(artURL);
            }
            // Download all the artwork. We should probably check for image duplicates beyond same-URL in case the
            // artist decided to be stupid and manually give tracks the same image as the album.
            console.info('Downloading artwork...');
            for (let i = 0; i < allArtURLs.length; i++) {
                console.info(`[${i+1}/${allArtURLs.length}] ${allArtURLs[i]}`);
                const fileName = path.basename(url.parse(allArtURLs[i]).pathname);
                await utils.downloadToFile(allArtURLs[i], path.join(config.output.path, config.output.artwork, artist, fileName));
            }
            let sentEmail = false;
            if (data.freeDownloadPage != null) {
                // Free download
                console.info(`Free ${data.item_type}: ${data.url}`);
                await page.goto(data.freeDownloadPage);
                const flacURL = await page.evaluate(async () => {
                    return new Promise(resolve => {
                        try { $('.item-format.button').click(); } catch (err) {}
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
                const extension = data.item_type === 'album' ? '.zip' : '.flac';
                await utils.downloadToFile(flacURL, path.join(config.output.path, config.output.flacs, 'free', artist, item.title + extension));
                console.info('Downloaded');
                continue;
            } else if (data.current.minimum_price > 0) {
                // Paid item
                console.info(`Paid ${data.item_type}: ${data.url}`);
            } else if (data.current.require_email && data.current.require_email_0) {
                // Free download requiring email and zip code
                console.info(`Free ${data.item_type} requiring email and zip code: ${data.url}`);
                await page.evaluate(async config => {
                    TralbumDownload.begin();
                    const userPrice = $('#userPrice');
                    userPrice.val('0.00');
                    userPrice.change();
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    try { TralbumDownload.showButtonsSection(); } catch (err) {}
                    $('#fan_email_address').val(config.email);
                    $('#fan_email_postalcode').val(config.postal);
                    TralbumDownload.checkout();
                }, config);
                sentEmail = true;
            }
            if (sentEmail) {
                console.info(`Email sent with download link.`);
            } else if (data.current.minimum_price > 0) {
                console.warn('Can\'t do anything with paid items.');
            } else {
                console.warn('Could not find free download page nor could an email be sent.');
            }
        }
    }
}

const feedURLTemplate = 'https://rss-bridge-1.herokuapp.com/?action=display&bridge=Bandcamp&context=By+band&type=changes&limit=100&format=Json&band=';

async function getFeed(username) {
    try {
        return await (await fetch(feedURLTemplate + username)).json();
    } catch (err) {
        console.error('Received error while fetching RSS feed:');
        console.trace(err);
    }
}

main().catch(err => {
    console.error('cbdl ran into an error during operation:');
    console.trace(err);
});
