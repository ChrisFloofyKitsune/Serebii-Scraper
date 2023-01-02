const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const cliProgress = require("cli-progress");
const { PokeParser } = require("../src/PokeParser");

const inputPath = path.resolve(__dirname, "../rawHTML");
const outputPath = path.resolve(__dirname, "../data/pokemonGenIndex.json");

const generationPaths = [
    { index: 1, path: "generation1" },
    { index: 2, path: "generation2" },
    { index: 3, path: "generation3" },
    { index: 4, path: "generation4" },
    { index: 5, path: "generation5" },
    { index: 6, path: "generation6" },
    { index: 7, path: "generation7" },
    { index: 8, path: "generation8" },
    { index: 9, path: "generation9" },
];

/* 
    {
        "###": [{"1": "gen1filePath"}, {"2": "gen2filePath"}, etc}] //List of generations the pokemon appears in.
    }

*/

const pokeParser = new PokeParser();
let output = { };

for (let genPath of generationPaths) {
    let folderPath = path.join(inputPath, genPath.path);

    if (!fs.existsSync(folderPath))
        console.error(`Path: ${folderPath} doesn't exist`);

    let bar = new cliProgress.SingleBar({
        format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | Gen${genPath.index}: {current}`
    }, cliProgress.Presets.shades_classic);

    var files = fs.readdirSync(folderPath).filter(file => file !== "mainPage.html");

    //files = files.slice(200,201);

    bar.start(files.length, 0, { current: " - " });

    files.map(file => path.join(folderPath, file))
        .filter(filePath => fs.lstatSync(filePath).isFile())
        .forEach(filePath => {
            let dexNum = ParsePage(filePath, genPath.index);
            bar.increment(1, { current: `#${dexNum}` });
        });

    bar.stop();
}

function ParsePage(filePath, genIndex) {
    pokeParser.LoadPage(filePath);
    const data = pokeParser.GetPokemonData();

    CreateOrAddGenIndex(data, genIndex, filePath);

    return data.DexNum;
}

/**
 * 
 * @param {object} pokeData
 * @param {string} pokeData.Name
 * @param {number} pokeData.DexNum
 * @param {string} pokeData.DefaultForm
 * @param {string[]} pokeData.Forms
 * @param {number} genIndex
 * @param {string} filePath
 */
function CreateOrAddGenIndex(pokeData, genIndex, filePath) {
    let entry = {
        Gen: genIndex,
        Path: filePath.replace(inputPath, ""),
        Forms: pokeData.Forms
    };

    if (!output[pokeData.DexNum]) {
        output[pokeData.DexNum] = [];
    }

    output[pokeData.DexNum].push(entry);
}

fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));
