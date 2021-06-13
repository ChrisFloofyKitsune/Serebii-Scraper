const fs = require("fs");
const path = require("path");
const { default: Axios } = require("axios");
const cheerio = require("cheerio");
const async = require("async");
const cliProgress = require("cli-progress");
const { Mutex, Semaphore } = require("async-mutex");

const outputPath = "./rawHTML/generation3/extraPages"

const extraPages = require("./extraBulbaPages.json");

// const extraPages = [{
//     "DexNum": 1,
//     "URL": "https://bulbapedia.bulbagarden.net/wiki/Bulbasaur_(Pok%C3%A9mon)/Generation_III_learnset"
// }];

const httpGetLock = new Mutex();
//const serebiiGetLock = new Semaphore(2);
async function throttledPageGet(path) {

    var release = await httpGetLock.acquire();
    var result;

    try {
        result = await Axios.get(path);
        
        release();
    } catch (err) {
        release();
        throw err;
    }

    return result;
}

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath);

const bar = new cliProgress.SingleBar({
    format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {currentPage}'
}, cliProgress.Presets.shades_classic);

async function scrapePage(DexNum, URL) {
    console.log(URL);
    var page = (await throttledPageGet(URL)).data;

    fs.writeFileSync(path.join(outputPath, `${DexNum}.html`), page);

    bar.increment(1, {currentPage: URL});
}

(async () => {
    bar.start(extraPages.length, 0, {currentPage: "none"});
    Promise.all(extraPages.map(page => scrapePage(page.DexNum, page.URL))).then(() => {
        bar.stop();
        console.log("All pages complete!");
    }).catch(err => { throw err; });
})().catch(err => console.error(err));
