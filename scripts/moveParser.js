const {readdir, readFile, writeFile} = require('fs/promises');
const fs = require('fs');
const cheerio = require('cheerio');
const {Presets, MultiBar} = require('cli-progress');
const path = require('path');

const baseHtmlDir = path.resolve(__dirname, '../rawHTML/attackdex/');
const progressMultiBar = new MultiBar({
    format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}',
    fps: 60
}, Presets.shades_classic);
const outputPath = path.resolve(__dirname, '../genMoveDexes/');

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath, {recursive: true});

const genIndexes = [
    // 7,
    // 8,
    9
];

async function main() {

    await Promise.all(genIndexes.map(async genIndex => {
        await parseGenPages(genIndex);
    }));

    progressMultiBar.stop();

    console.log("PARSING COMPLETE");
}

async function parseGenPages(genIndex) {

    const genPathFragment = `generation${genIndex}`;
    const htmlDir = path.join(baseHtmlDir, genPathFragment);

    const filePaths = (await readdir(htmlDir)).filter(p => !p.includes('mainPage'));

    const myBar = progressMultiBar.create(filePaths.length, 0, {current: 'starting...'});

    function removeBadProps(obj) {
        const keysToDelete = Object.keys(obj).filter(k => typeof obj[k] === 'string' && obj[k] === '');
        for (const key of keysToDelete) {
            delete obj[key];
        }

        if (obj['ZMovePowerOrEffect'] !== undefined && obj['ZMovePowerOrEffect'] === '0') {
            delete obj['ZMovePowerOrEffect'];
        }
    }

    try {
        let entries = await Promise.all(filePaths.map(p => parseFile(p, genIndex, myBar)));
        entries = entries.filter(e => e !== null).sort((a, b) => a.Name.localeCompare(b.Name));
        entries.forEach(removeBadProps);
        await writeFile(`${path.join(outputPath, genPathFragment)}.json`, JSON.stringify(entries, null, 4));
    } catch (err) {
        throw err;
    } finally {
        myBar.stop();
    }
}

/**
 * @typedef {object} MoveEntry
 * @property {string} Name
 */

/**
 * @param {string} pathFragment
 * @param {string} genIndex
 * @param {import('cli-progress').Bar} bar
 * @returns {MoveEntry}
 */
async function parseFile(pathFragment, genIndex, bar) {
    const filePath = path.join(baseHtmlDir, `generation${genIndex}`, pathFragment);

    const $ = cheerio.load(await readFile(filePath));
    const entry = {
        Name: $('table.dextab:nth-of-type(1) td:nth-child(1)').text().trim()
    }

    const $headerRows = $('table.dextable').slice(0, 2).find('tr:nth-child(2n-1)');

    if ($headerRows.next().find(`td:contains("This move can't be used.")`).length) {
        //A victim of dexit, RIP.
        bar.increment(1, {current: `SKIPPED ${pathFragment}`});
        return null;
    }

    /**
     * Finds a header with the given text and adds the result of the callback to the entry (if the header exists)
     * @param {string} headerText
     * @param {PropertyKey} prop
     * @param {($cell: cheerio.Cheerio<cheerio.Element>) => string | number} extractCallback
     * @returns
     */
    function addInfoByHeader(headerText, prop, extractCallback = ($cell) => $cell.text().trim()) {
        // find the cell in the header rows that contains our text.
        const $headerCell = $headerRows.find(`td:contains(${headerText})`);

        if (!$headerCell.length) {
            return null;
        }

        const cellIndex = $headerCell.index();
        const $cell = $headerCell.parent('tr').next().find(`td:nth-child(${cellIndex + 1})`);

        if ($cell.length) {
            try {
                entry[prop] = extractCallback($cell);
            } catch {
                console.error(`\nError getting "${prop}" from ${pathFragment}`);
            }
        }
    }

    /* FORMAT
    {
        "Name": "Absorb",
        "Type": "Grass",
        "Category": "Special",
        "BasePower": 20,
        "Accuracy": 100,
        "BattleEffect": "A nutrient-draining attack. The user's HP is restored by half the damage taken by the target.",
        "SecondaryEffect": "User recovers half the damage inflicted.",
        "EffectRate": "-- %",
        "SpeedPriority": 0,
        "CriticalHitRate": "4.17%",
        "Target": "Selected Target",
        "MakesPhysicalContact": "No",
        "IsSuperMove": "No",
        "MaxMovePower": 90,
        "ZMovePowerOrEffect": "100"
    } */


    function extractFromImgSrc($cell) {
        let result = $cell.find('img').attr('src');
        result = path.parse(result).name;
        if (result === "other") {
            return "Status";
        }

        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    /**
     * @param {cheerio.Cheerio<cheerio.Element>} $cell
     */
    function extractInt($cell) {
        return parseInt($cell.text().trim());
    }

    addInfoByHeader('Battle Type', 'Type', extractFromImgSrc);
    addInfoByHeader('Category', 'Category', extractFromImgSrc);
    addInfoByHeader('Base Power', 'BasePower', extractInt);
    addInfoByHeader('Accuracy', 'Accuracy', extractInt);
    addInfoByHeader('Battle Effect:', 'BattleEffect');
    addInfoByHeader('Secondary Effect:', 'SecondaryEffect');
    addInfoByHeader('Effect Rate:', 'EffectRate');
    addInfoByHeader('Speed Priority', 'SpeedPriority');
    addInfoByHeader('Base Critical Hit Rate', 'CriticalHitRate');
    addInfoByHeader('Pokémon Hit in Battle', 'Target');
    addInfoByHeader('Physical Contact', 'MakesPhysicalContact');
    addInfoByHeader('MaxMove Power:', 'MaxMovePower', extractInt);
    addInfoByHeader('Z-Move Power:', "ZMovePowerOrEffect");

    bar.increment(1, {current: pathFragment});

    return entry;
}

(async () => {
    await main()
})().catch(err => {
    console.error(err);
}).finally(() => {
    progressMultiBar.stop()
});