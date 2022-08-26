const { readFile, writeFile } = require('fs/promises');
const path = require('path');

async function main() {
    /** @type {{Name: string, DexNum: number, Forms: {FormName: string}[]}[]} */
    const infoList = JSON.parse(await readFile(path.resolve(__dirname, '../output/pokemonList.json'), 'utf8'));
    await writeFile(
        path.resolve(__dirname, '../output/slimPokemonList.json'), 
        JSON.stringify(infoList.map(entry => ({ Name: entry.Name, DexNum: entry.DexNum, Forms: entry.Forms.map(f => f.FormName) })))
    );
}

(async () => await main())().catch(err => console.log(err));