const { readdir, readFile, writeFile } = require('fs/promises');
const cheerio = require('cheerio');
const { Bar, Presets } = require('cli-progress');
const path = require('path');

const htmlDir = path.resolve(__dirname, '../rawHTML/abilities/');
const progressBar = new Bar({ format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total} | {current}' }, Presets.shades_classic );
const outputPath = path.resolve(__dirname, '../output/abilityDex.json');

const mainPage = "https://www.serebii.net/abilitydex/";

async function main() {
    const filePaths = (await readdir(htmlDir)).filter(p => !p.includes('mainPage'));

    progressBar.start(filePaths.length, 0, { current: 'starting...' });

    const entries = await Promise.all(filePaths.map(p => parseFile(p)));

    entries.sort((a, b) => a.Name.localeCompare(b.Name));

    console.log("PARSING COMPLETE");

    progressBar.stop();

    await writeFile(outputPath, JSON.stringify(entries, null, 4));
}

/**
 * @typedef {object} AbilityEntry
 * @property {string} Name
 * @property {string} GameText
 * @property {string | undefined} EffectDetail
 * @property {string | undefined} OverworldEffect
 * @property {string} Link
 */

/**
 * @param {string} pathFragment 
 * @returns {AbilityEntry}
 */
async function parseFile(pathFragment) {
    const filePath = path.resolve(htmlDir, pathFragment);

    const $ = cheerio.load(await readFile(filePath));
    const $table = $('table.dextable:nth-of-type(3)')
    const rowAfterHeader = (header) => `tr:contains('${header}')+tr td:nth-child(1)`

    /** @type {AbilityEntry} */
    const entry = {
        Name: $table.find(rowAfterHeader('Name')).text(),
        GameText: $table.find(rowAfterHeader(`Game's Text`)).text()
    }

    const $detail = $table.find(rowAfterHeader('In-Depth Effect'));
    if ($detail.length) {
        entry.EffectDetail = $detail.text();
    }
    
    const $overworld = $table.find(rowAfterHeader('Overworld Effect'));
    if ($overworld.length) {
        entry.OverworldEffect = $overworld.text();
    }

    entry.Link = mainPage + pathFragment.replace('.html', '.shtml');

    progressBar.increment(1, { current: pathFragment });

    return entry;
}

(async () => { await main() })().catch(err => console.error(err)).finally(() => { progressBar.stop() });