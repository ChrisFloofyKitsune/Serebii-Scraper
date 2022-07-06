const fs = require("fs");
const { writeFile } = require("fs/promises");
const path = require("path");
const { default: Axios } = require("axios");
const cheerio = require("cheerio");
const cliProgress = require("cli-progress");
const async = require("async");
const { throttledPageGet } = require("../src/util");

const outputPath = path.resolve(__dirname, '../rawHTML/abilities');

const mainPage = "https://www.serebii.net/abilitydex/";

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath, { recursive: true });

const bar = new cliProgress.Bar({
    format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {currentPage}'
}, cliProgress.Presets.shades_classic);

async function main() {

    var mainPageHTML = (await Axios.get(mainPage)).data;

    await writeFile(path.join(outputPath, 'mainPage.html'), mainPageHTML);

    var $ = cheerio.load(mainPageHTML);
    /** @type {Set<string>} */
    var pathFragments = new Set();

    $(`form[name^=ability] option[value^="/abilitydex/"]`).each((_, e) => {
        /** @type {string} */
        const value = $(e).val();
        pathFragments.add(value.match(/\/abilitydex\/(.*)$/)[1]);
    });

    bar.start(pathFragments.size, 0, { currentPage: "starting..."});

    await async.forEachLimit(pathFragments, 3, async pathFrag => {
        const outputFilePath = path.join(outputPath, pathFrag.replace('.shtml', '.html'));
        const pathHTML = (await throttledPageGet(mainPage + pathFrag)).data;
        await writeFile(outputFilePath, pathHTML);
        bar.increment(1, { currentPage: pathFrag });
    }).catch(err => { 
        console.error("SCRAPING FAILED");
        throw err; 
    }).finally(() => {
        bar.stop();
    });

    console.log("SCRAPING OF ABILITIES COMPLETE!");
}

(async () => { await main()})().catch(err => console.error(err));