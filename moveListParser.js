const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const cliProgress = require("cli-progress");
const { MoveNameFix } = require("./util");

const inputPath = "./rawHTML"
const outputPath = "./genMoveLists"

//Function layout
// Parse Page
// --Parse Name
// --Parse DexNum
// --Parse Forms (special case Deoxys Gen 3)
// --Parse Moves
// ----Parse Level Up Moves
// ------Parse Level Up Move
// ----Parse Egg Moves
// ------Parse Move
// ----Parse Tutor Moves
// ------Parse Move
// ----Parse Machine Moves
// ------Parse Move

// GEN 3 IS FUCKED, PULLED IN BULBAPEDIA TO FIX THIS
// UPDATE: GEN 3 HAS BEEN UPDATED AND IS NO LONGER FUCKED
//         PULLING IN BULBA FUCKED OTHER THINGS THO
//         gonna stop using bulba
// No event moves

class PokeMoveParser {
    $ = null;
    hasAltForms = false;
    name = "";
    dexNum = 0;
    forms = [];

    LoadPage(pagePath) {
        this.$ = cheerio.load(fs.readFileSync(pagePath));

        this.name = this.$('table.dextable tr:contains("Name")+tr td:nth-child(1)').first().text().trim();

        let $dexNums = this.$('table.dextable tr:contains("No.")+tr td:nth-child(3)');
        //console.log($dexNums.text());
        this.dexNum = parseInt($dexNums.text().match(/#(\d\d\d)/)[1], 10);

        this.forms = [];
        this.forms = this.ParseForms();
    }

    GetName() {
        return this.name;
    }

    GetDexNum() {
        return this.dexNum;
    }

    FormNameFix(formName) {
        if (formName.includes("Form") && !formName.includes("Forme"))
            formName = formName.substring(0, formName.indexOf(" Form"));

        formName = formName.replace(this.name, "").trim();

        formName = formName.replace(/ ?(Kantonian|Johtonian|Hoennian|Unovan) ?/, "").trim();

        if (formName == "Alola")
            formName = "Alolan";

        if (this.name == "Burmy" && formName == "No Cloak")
            formName = "Plant Cloak";
        else if (this.name == "Arceus")
            formName = formName.replace("-type", "");
        else if (this.name == "Silvally")
            formName = formName.replace("Type: ", "");
        else if (this.name == "Vivillon")
            formName = formName.replace(" Pattern", "").replace("é", "e");
        else if (this.name == "Darmanitan")
            formName = formName.replace("Standard Mode", "").trim();
        else if (this.name == "Wishiwashi" && formName == "School")
            formName = "Schooling";
        else if (this.name == "Furfrou" && formName == "Deputante Trim")
            formName = "Debutante Trim";
        else if (this.name == "Greninja" && formName == "Ash-")
            formName = "Ash";
        else if (this.name == "Unown" && formName == "Normal")
            formName = "A";
        else if (this.name == "Pikachu" && formName == "Ph. D.")
            formName = "Ph. D";
        else if (this.name == "Pikachu" && (formName == "Cosplay" || formName == "Partner  Only"))
            formName = "Normal";
        else if (this.name == "Eevee" && formName == "Partner  Only")
            formName = "Normal";
        else if (this.name == "Keldeo" && formName == "Ordinary")
            formName = "Normal";
        else if (this.name == "Xerneas" && formName == "Neutral Mode")
            formName = "Normal";
        else if (this.name == "Xerneas" && formName == "Active Mode")
            formName = "Active";
        else if (this.name == "Zygarde" && formName == "Normal")
            formName = "50% Forme"
        else if (this.name == "Sinistea" || this.name == "Polteageist")
            formName = "Normal";
        else if (this.name == "Genesect")
            formName = "Normal";
        else if (this.name == "Morpeko")
            formName = formName.replace(" Mode", "");

        if (formName == "")
            formName = "Normal";

        //Only works once the forms for the pokemon have been determined
        //...by running them through this function.
        //So, this check doesn't work on the first run, which is intentional.
        if (this.forms.length != 0 && formName == "Normal")
            return this.GetDefaultForm();

        return formName;
    }

    ParseForms() {
        let query = 'table.dextable tr:contains("Alternate Forms")';
        if (this.name == "Indeedee" || this.name == "Meowstic" || this.name == "Pyroar")
            query = 'table.dextable tr:contains("Gender Differences")';

        let $formHeader = this.$(query);
        //console.log($formHeader);

        let forms = [];
        if ($formHeader.length == 0)
            forms = ["Normal"];
        else {
            forms = [...new Set($formHeader.next('tr')
                .find('td.pkmn b')
                .map((i, e) => {
                    return this.$(e).text();
                }).get())];
        }

        forms = forms.map(f => this.FormNameFix(f));

        if (this.dexNum == 25)
            forms = [...new Set(["Normal", ...forms])];

        //Mega form(s) check!
        if (this.$('td.fooevo b:contains("Mega Evolution")') != 0) {
            forms.push(...((this.name == "Charizard" || this.name == "Mewtwo") ? ["Mega X", "Mega Y"] : ["Mega"]));
        }

        //GMax form check!
        if (this.$('h2:contains("Gigantamax")').length != 0) {
            forms.push(...((this.name == "Urshifu") ? ["Gigantamax Single Strike Style", "Gigantamax Rapid Strike Style"] : ["Gigantamax"]));
        }

        //Fix form ordering for certain Pokemon
        if (forms.length > 1 && (this.name == "Aegislash" || this.name == "Zygarde" || this.name == "Pumpkaboo" || this.name == "Gourgeist")) {
            let temp = forms[0];
            forms[0] = forms[1];
            forms[1] = temp;
        }

        return forms;
    }

    GetForms() {
        return this.forms;
    }

    GetDefaultForm() {
        return this.forms[0];
    }

    GetLevelUpMoves() {
        /*
        LevelUpMoves: [
            { 
                Form: "form",
                LevelUpMoves: [
                    { 
                        Name: "name", 
                        Level: number 
                    }, 
                    ...
                ] 
            },
            ...
        ]
        */

        let result = [];
        let $levelUpTables = this.$('table.dextable').has('td:contains("Level Up")');

        $levelUpTables.each((i, table) => {
            let $table = this.$(table);
            let headerText = $table.find('td:contains("Level Up")').text();

            if (headerText == "Level Up - Shadow Rid")
                headerText = "Level Up - Shadow Rider";

            if (headerText.includes("Alola"))
                headerText = "Alolan";

            if (headerText.includes("Galar"))
                headerText = "Galarian";

            let form = this.GetDefaultForm();

            let formIndex = this.forms.findIndex(s => headerText.includes(s));
            if (formIndex != -1) {
                form = this.forms[formIndex];
            }

            if (this.name == "Meloetta" || (this.name == "Darmanitan" && form == "Zen Mode"))
                form = this.GetDefaultForm();

            let LevelUpMoves = $table.find('tr~tr:nth-child(2n-1)').map((i, e) => {
                let $tr = this.$(e);
                return {
                    Name: MoveNameFix($tr.find('a').first().text()),
                    Level: $tr.find('td').first().text()
                }
            }).get();

            if (this.name == "Giratina") {
                result.push({
                    Form: "Origin Forme",
                    LevelUpMoves
                });
            }

            result.push({
                Form: form,
                LevelUpMoves
            });

        });

        return result;
    }

    GetEggMoves() {
        return this.GetNonLevelUpMoves(this.$('table.dextable').has('td.fooevo:contains("Egg Move")'), 1);
    }

    GetTutorMoves() {
        return this.GetNonLevelUpMoves(this.$('table.dextable').has('td.fooevo:contains("Tutor")'), 1);
    }

    GetMachineMoves() {
        return this.GetNonLevelUpMoves(this.$('table.dextable').has('td.fooevo:contains("Technical"), td.fooevo:contains("TM")'), 2);
    }

    GetNonLevelUpMoves($tables, nameCol = 1) {
        /*
        Moves: [
            {
                Name: "name",
                Forms: [
                    "form1", 
                    "form2"
                ]
        }
        */

        let results = [];

        $tables.each((i, e) => {
            this.$(e).find('tr~tr:nth-child(2n-1)').each((i, tr) => {
                let $tr = this.$(tr);

                let name = MoveNameFix($tr.find(`td:nth-child(${nameCol})`).first().text());

                //console.log($tr.find('td:last-child').find('img').length);

                let forms = $tr.find('td:last-child').find('img').map((i, img) => {
                    let form = this.$(img).attr("alt");
                    if (!form)
                        form = this.$(img).attr("title");
                    return form;
                }).get().map(f => this.FormNameFix(f));

                //console.log(forms);

                if (forms.length == 0) {
                    forms = this.GetForms();
                }

                let existing = results.find(r => r.Name == name);
                if (!existing) {
                    results.push({
                        Name: name,
                        Forms: forms
                    });
                }
                else {
                    existing.Forms.push(...forms.filter(f => !existing.Forms.includes(f)));
                }
            })
        })

        return results;
    }

    GetPokemonData() {
        return {
            Name: this.GetName(),
            DexNum: this.GetDexNum(),
            DefaultForm: this.GetDefaultForm(),
            AltForms: this.GetForms(),
            LevelUpMoveLists: this.GetLevelUpMoves(),
            EggMoves: this.GetEggMoves(),
            TutorMoves: this.GetTutorMoves(),
            MachineMoves: this.GetMachineMoves()
        }
    }
}

class Gen3MoveParser extends PokeMoveParser {

    LoadPage(pagePath) {
        this.$ = cheerio.load(fs.readFileSync(pagePath));

        this.name = this.$('table tr:contains("English name")+tr td:nth-child(4)').first().text().trim();

        let $dexNum = this.$('table tr:contains("National No.")+tr td:nth-child(2)');
        //console.log($dexNums.text());
        this.dexNum = parseInt($dexNum.text().trim().match(/(\d\d\d)/)[1], 10);

        this.forms = this.ParseForms();
    }

    ParseForms() {
        if (this.name == "Deoxys")
            return ["Normal Forme", "Attack Forme", "Defense Forme", "Speed Forme"];

        if (this.name == "Unown")
            return ["A"];

        return ["Normal"];
    }

    GetLevelUpMoves() {
        /*
        LevelUpMoves: [
            { 
                Form: "form",
                LevelUpMoves: [
                    { 
                        Name: "name", 
                        Level: number 
                    }, 
                    ...
                ] 
            },
            ...
        ]
        */

        let result = [];
        let $levelUpTables = this.$('table.dextable').filter((i, e) => {
            return this.$(e).find('thead tr:first-child').text().match(/Level Up|^Leaf Green$|^Emerald$/);
        });

        $levelUpTables.each((i, table) => {
            let $table = this.$(table);
            let headerText = $table.find('thead tr:first-child').text();

            let forms = this.forms;
            if (this.name == "Deoxys") {
                forms = this.GetDeoxysForms(headerText);
                //console.log(headerText);
            }
            //console.log(this.name + ' ' + String(forms));

            let LevelUpMoves = $table.find('tbody tr:nth-child(2n-1)').map((i, e) => {
                let $tr = this.$(e);
                return {
                    Name: MoveNameFix($tr.find('a').first().text()),
                    Level: $tr.find('td').first().text()
                }
            }).get();

            forms.forEach(f => {
                result.push({
                    Form: f,
                    LevelUpMoves
                });
            })
        });

        return result;
    }

    GetNonLevelUpMoves($tables, nameCol = 1) {
        /*
        Moves: [
            {
                Name: "name",
                Forms: [
                    "form1", 
                    "form2"
                ]
        }
        */
        let results = [];

        $tables.each((i, e) => {
            let $table = this.$(e);
            let headerText = $table.find('thead tr:first-child').text();

            let forms = this.forms;
            if (this.name == "Deoxys") {
                forms = this.GetDeoxysForms(headerText);
            }

            $table.find('tbody tr:nth-child(2n-1)').each((i, tr) => {
                let $tr = this.$(tr);

                let name = MoveNameFix($tr.find(`td:nth-child(${nameCol})`).first().text());

                if (forms.length == 0) {
                    forms = this.GetForms();
                }

                let existing = results.find(r => r.Name == name);
                if (!existing) {
                    results.push({
                        Name: name,
                        Forms: forms
                    });
                }
                else {
                    existing.Forms.push(...forms.filter(f => !existing.Forms.includes(f)));
                }
            })
        })

        return results;
    }

    GetDeoxysForms(headerText) {
        let forms = [];

        if (headerText.includes("Ruby")) {
            forms.push("Normal Forme")
        }

        if (headerText.includes("Red")) {
            forms.push("Attack Forme")
        }

        if (headerText.includes("Green")) {
            forms.push("Defense Forme");
        }

        if (headerText.includes("Emerald")) {
            forms.push("Speed Forme");
        }

        if (forms.length == 0) {
            return this.forms;
        }

        return forms;
    }
}

const defaultParser = new PokeMoveParser();

const GenParsers = [
    { index: 1, parser: defaultParser },
    { index: 2, parser: defaultParser },
    { index: 3, parser: new Gen3MoveParser() },
    { index: 4, parser: defaultParser },
    { index: 5, parser: defaultParser },
    { index: 6, parser: defaultParser },
    { index: 7, parser: defaultParser },
    { index: 8, parser: defaultParser },
];

const generationPaths = [
    // { index: 1, path: "generation1" },
    // { index: 2, path: "generation2" },
    { index: 3, path: "generation3" },
    // { index: 4, path: "generation4" },
    // { index: 5, path: "generation5" },
    // { index: 6, path: "generation6" },
    // { index: 7, path: "generation7" },
    // { index: 8, path: "generation8" }
];

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath);

for (let genPath of generationPaths) {
    let folderPath = path.join(inputPath, genPath.path);

    if (!fs.existsSync(folderPath))
        console.error(`Path: ${folderPath} doesn't exist`);

    let parser = GenParsers.find(p => p.index == genPath.index).parser;
    //console.log(parser);

    let bar = new cliProgress.SingleBar({
        format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | Gen${genPath.index}: {current}`
    }, cliProgress.Presets.shades_classic);

    var files = fs.readdirSync(folderPath).filter(file => file != "mainPage.html");

    //files = files.slice(200,201);

    bar.start(files.length, 0, { current: " - " });

    var pokemonData = files.map(file => path.join(folderPath, file))
        .filter(filePath => fs.lstatSync(filePath).isFile())
        .map(filePath => {
            parser.LoadPage(filePath);
            bar.increment(1, { current: `${parser.GetName()} - ${parser.GetDexNum()}` });
            return parser.GetPokemonData();
        });

    bar.stop();

    //console.log(pokemonData.map(d => d.Name));

    let outFilePath = path.join(outputPath, genPath.path + ".json");

    fs.writeFileSync(outFilePath, JSON.stringify(pokemonData, null, 2));
}
