const fs = require("fs");
const { writeFile } = require("fs/promises");
const path = require("path");
const { default: Axios } = require("axios");
const cheerio = require("cheerio");
const cliProgress = require("cli-progress");
const async = require("async");
const { throttledPageGet } = require("../src/util");

const outputPath = path.resolve(__dirname, '../rawHTML/attackdex/');

const mainPages = {
    7: 'https://www.serebii.net/attackdex-sm/',
    8: 'https://www.serebii.net/attackdex-swsh/',
    9: 'https://www.serebii.net/attackdex-sv/'
}

const multiBar = new cliProgress.MultiBar({
    format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {currentPage}'
}, cliProgress.Presets.shades_classic);

async function main() {

    await Promise.all(Object.keys(mainPages).map(genIndex => scrapeGenPages(genIndex, mainPages[genIndex])));

    console.log("SCRAPING OF ATTACK DEX COMPLETE!");
}

async function scrapeGenPages(genIndex, mainPage) {

    const mainPageHTML = (await Axios.get(mainPage)).data;
    const genOutPath = path.join(outputPath, `generation${genIndex}`);

    if (!fs.existsSync(genOutPath))
        fs.mkdirSync(genOutPath, { recursive: true });

    await writeFile(path.join(genOutPath, 'mainPage.html'), mainPageHTML);

    var $ = cheerio.load(mainPageHTML);
    /** @type {Set<string>} */
    var pathFragments = new Set();

    $(`form[name^=nav] option[value^="/attackdex"]`).each((_, e) => {
        /** @type {string} */
        const value = $(e).val();
        pathFragments.add(value.match(/\/attackdex-\w*\/(.*)$/)[1]);
    });

    
    const bar = multiBar.create(pathFragments.size, 0, { currentPage: "starting..."});

    await async.forEachLimit(pathFragments, 3, async pathFrag => {
        const outputFilePath = path.join(genOutPath, pathFrag);
        const pathHTML = (await throttledPageGet(mainPage + pathFrag)).data;
        await writeFile(outputFilePath, pathHTML);
        bar.increment(1, { currentPage: pathFrag });
    }).catch(err => { 
        console.error("SCRAPING FAILED");
        throw err; 
    }).finally(() => {
        bar.stop();
    });
    
}

(async () => { await main()})().catch(err => console.error(err)).finally(() => { multiBar.stop() });