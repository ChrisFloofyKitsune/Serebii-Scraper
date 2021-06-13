const cheerio = require("cheerio");
const fs = require("fs");
const { default: Axios } = require("axios");

const outputDir = "./output";
const testfile = "./testFile/vulpixSwSh.html"

const levelUpFormRegex = /(.+?)(?: Form)? Level Up/;

if (!fs.existsSync(outputDir))
    fs.mkdirSync(outputDir);

(async () => {
    // var response = await Axios.get("https://www.serebii.net/pokedex-swsh/vulpix/");
    // var $ = cheerio.load(response.data);
    var $ = cheerio.load(fs.readFileSync(testfile));
    var levelUpTables = $('table.dextable tr:contains("Level Up")');
    levelUpTables.each((i, table) => {
        var $table = $(table);
        console.log("Form: " + $table.text().match(levelUpFormRegex)[1]);
        
        var moves = $table.siblings('tr:nth-child(2n-1)');
        moves.each((i, move) => {
            var $move = $(move);
            console.log($move.find("td").first().text() + " " + $move.find("a").first().text());
        });
    })
    
})().catch(err => console.error(err));
