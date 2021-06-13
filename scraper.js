const fs = require("fs");
const path = require("path");
const { default: Axios } = require("axios");
const cheerio = require("cheerio");
const async = require("async");
const cliProgress = require("cli-progress");
const { Mutex } = require("async-mutex");

const outputPath = "./rawHTML"

const generationDexMainPages = [
    { index: 1, link: "https://www.serebii.net/pokedex/" },
    { index: 2, link: "https://www.serebii.net/pokedex-gs/"},
    // { index: 3, link: "https://www.serebii.net/pokedex-rs/"},
    { index: 4, link: "https://www.serebii.net/pokedex-dp/"},
    { index: 5, link: "https://www.serebii.net/pokedex-bw/"},
    { index: 6, link: "https://www.serebii.net/pokedex-xy/"},
    { index: 7, link: "https://www.serebii.net/pokedex-sm/"},
    { index: 8, link: "https://www.serebii.net/pokedex-swsh/" }
];

const serebiiGetLock = new Mutex();
//const serebiiGetLock = new Semaphore(2);
async function throttledPageGet(path) {
    
    var release = await serebiiGetLock.acquire();
    var result;
     
    try {
        result = await Axios.get(path);
        release();
    } catch(err) {
        release();
        throw err;
    }

    return result;
}

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath);

const multibar = new cliProgress.MultiBar({
    format: 'Gen{index} {bar} {percentage}% | ETA: {eta}s | {value}/{total} | {currentPage}'
}, cliProgress.Presets.shades_classic);

async function scrapeGeneration(genIndex, htmlLink) {
    var genPath = path.join(outputPath, `generation${genIndex}`);

    if (!fs.existsSync(genPath))
        fs.mkdirSync(genPath);

    //console.log(`Scraping Generation ${genIndex} Pokedex Entry Pages...`);

    var mainPageHTML = (await Axios.get(htmlLink)).data;

    fs.writeFileSync(path.join(genPath, 'mainPage.html'), mainPageHTML);

    var $ = cheerio.load(mainPageHTML);
    var resultSet = new Set();

    $("form[name^=nav] [name=SelectURL] option").each((i, e) => {
        var val = $(e).val();
        if (val.includes("/"))
            resultSet.add(val.match(/\/pokedex.*?\/([^\/]+)/)[1]);
    });
    //console.log(resultSet);

    const myBar = multibar.create(resultSet.size, 0, {index: genIndex});

    await async.forEachOfLimit(resultSet, 3, (pageLinkFragment, key, callback) => {
        var pagePath = htmlLink + pageLinkFragment;
        //console.log(pagePath);

        throttledPageGet(pagePath).then(response => {
            var page = response.data;
            if (pageLinkFragment.indexOf(".shtml") != -1)
                pageLinkFragment = pageLinkFragment.slice(0, pageLinkFragment.indexOf(".shtml"));

            if (pageLinkFragment.indexOf(":") != -1)
                pageLinkFragment = pageLinkFragment.replace(":", "_");

            fs.writeFileSync(path.join(genPath, `${pageLinkFragment}.html`), page);

            myBar.increment(1, {currentPage: pagePath});

            callback();
        }).catch(err => callback(err) );
    });

    multibar.remove(myBar);

    //console.log(`Generation ${genIndex} Complete!`);
}

(async () => {
    Promise.all(generationDexMainPages.map(genInfo => scrapeGeneration(genInfo.index, genInfo.link))).then(() => {
        multibar.stop();
        console.log("All generations complete!");
    }).catch(err => { throw err; });
})().catch(err => console.error(err));