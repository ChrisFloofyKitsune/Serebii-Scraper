const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const cliProgress = require("cli-progress");

const inputPath = "./rawHTML"
const outputPath = "./pokemonGenIndex.json"

const generationPaths = [
    { index: 1, path: "generation1" },
    { index: 2, path: "generation2" },
    { index: 3, path: "generation3" },
    { index: 4, path: "generation4" },
    { index: 5, path: "generation5" },
    { index: 6, path: "generation6" },
    { index: 7, path: "generation7" },
    { index: 8, path: "generation8" }
];

/* 
    {
        "###": [1, 2, 3, 4, 5, 6, 7, 8] //List of generations the pokemon appears in.
    }

*/

let output = { };

for (let genPath of generationPaths) {
    let folderPath = path.join(inputPath, genPath.path);

    if (!fs.existsSync(folderPath))
        console.error(`Path: ${folderPath} doesn't exist`);

    let bar = new cliProgress.SingleBar({
        format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | Gen${genPath.index}: {current}`
    }, cliProgress.Presets.shades_classic);

    var files = fs.readdirSync(folderPath).filter(file => file != "mainPage.html");

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
    const $ = cheerio.load(fs.readFileSync(filePath));

    let dexNum;
    if (genIndex == 3) {
        let $dexNum = $('table tr:contains("National No.")+tr td:nth-child(2)');
        dexNum = parseInt($dexNum.text().trim().match(/(\d\d\d)/)[1], 10);
    } else {
        let $dexNums = $('table.dextable tr:contains("No.")+tr td:nth-child(3)');
        dexNum = parseInt($dexNums.text().match(/#(\d\d\d)/)[1], 10);
    }

    CreateOrAddGenIndex(dexNum, genIndex);

    return dexNum;
}

function CreateOrAddGenIndex(dexNum, genIndex) {
    if (!output[dexNum]) {
        output[dexNum] = [];
    }

    output[dexNum].push(genIndex);
}

fs.writeFileSync(outputPath, JSON.stringify(output), null, 2);