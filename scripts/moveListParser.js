const fs = require("fs");
const path = require("path");
const cliProgress = require("cli-progress");
const {MoveNameFix} = require("../src/util.js");
const {PokeParser} = require("../src/PokeParser.js");
const genIndex = require("../data/pokemonGenIndex.json");

const inputPath = path.resolve(__dirname, "../rawHTML");
const outputPath = path.resolve(__dirname, "../genMoveLists");

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

class PokeMoveParser extends PokeParser {

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

            headerText = headerText.replace(/.*?Level Up - /, "");
            headerText = headerText.replace(/Ultra/g, "");

            if (headerText === "Shadow Rid")
                headerText = "Shadow Rider";

            if (headerText.includes("Alola"))
                headerText = "Alolan";

            if (headerText.includes("Galar"))
                headerText = "Galarian";

            if (this.GetName() === "Tauros") {
                if (headerText.includes("Paldean")) {
                    headerText = "Paldean Combat Breed"
                }
                if (headerText.includes("Blaze")) {
                    headerText = "Paldean Blaze Breed"
                }
                if (headerText.includes("Aqua")) {
                    headerText = "Paldean Aqua Breed"
                }
            }

            let form = this.GetDefaultForm();

            let formIndex = this.forms.findIndex(s => headerText.includes(s));
            if (formIndex !== -1) {
                form = this.forms[formIndex];
            }

            if (this.name === "Meloetta" || this.name === "Unown" || (this.name === "Darmanitan" && form === "Zen Mode"))
                form = this.GetDefaultForm();

            let LevelUpMoves = $table.find('tr~tr:nth-child(2n-1)').map((i, e) => {
                let $tr = this.$(e);
                let $td = $tr.find('td').first();

                // If we're on the PLA page, then there's an image in the level up table!
                if ($td.find('img').length > 0) {
                    return {
                        Name: MoveNameFix($tr.find('a').first().text()),
                        //Get the direct text descendant, the mastery level is wrapped an <i> tag
                        Level: $td.contents().filter((_, e) => e.type === "text").text()
                    }
                } else {
                    return {
                        Name: MoveNameFix($tr.find('a').first().text()),
                        Level: $td.text()
                    }
                }
            }).get();

            if (this.name === "Giratina") {
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

        const moveReminderMoves = this.GetNonLevelUpMoves(this.$('table.dextable').has('td:contains("Move Reminder")'));
        /** @type {Map<string, {Name: string, Level: "—"}[]>} */
        const formMoveMap = moveReminderMoves.reduce(
            /** @param formMap {Map<string, {Name: string, Level: "—"}[]>}
             @param entry {any}*/
            (formMap, entry) => {
                for (const form of entry.Forms) {
                    const formList = formMap.get(form) ?? [];
                    formList.push({
                        Name: entry.Name,
                        Level: "—"
                    })
                    formMap.set(form, formList);
                }
                return formMap;
            }, new Map());

        for (const [Form, LevelUpMoves] of formMoveMap.entries()) {
            result.push({
                Form, LevelUpMoves
            });
        }

        return result;
    }

    GetEggMoves() {
        return this.GetNonLevelUpMoves(this.$('table.dextable').has('td.fooevo:contains("Egg Move")'), 1);
    }

    GetTutorMoves() {
        return this.GetNonLevelUpMoves(this.$('table.dextable').has('td.fooevo:contains("Tutor"), td.fooevo:contains("Move Shop")'), 1);
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
            let $table = this.$(e);
            let bdspSpecialFormHandling = false;

            if (this.generation === 8) {
                if ($table.find('tr:first-child .fooevo:contains("BDSP")').length > 0) {
                    // BDSP has its own labeled TM sections
                    bdspSpecialFormHandling = true;
                }
            }

            $table.find('tr~tr:nth-child(2n-1)').each((i, tr) => {
                let $tr = this.$(tr);

                let name = MoveNameFix($tr.find(`td:nth-child(${nameCol})`).first().text());

                //console.log($tr.find('td:last-child').find('img').length);

                let forms = $tr.find('td:last-child').find('img').map((i, img) => {
                    let form = this.$(img).attr("alt");
                    if (!form)
                        form = this.$(img).attr("title");
                    return form;
                }).get().map(f => this.FormNameFix(f));

                if (forms.length > 0 && this.generation === 8) {
                    if ($table.find('tr:first-child .fooevo:contains("Egg")').length > 0) {
                        // BDSP has egg moves thrown in with no images at the end of the Egg Moves table.
                        bdspSpecialFormHandling = true;
                    }
                }

                //console.log(forms);

                // No specific form info found, assume that the move belongs to ALL the pokemon's forms!
                if (forms.length === 0) {

                    if (this.generation === 8) {
                        if (bdspSpecialFormHandling && this.name !== "Arceus") {
                            // reee serebii why are you like this with BDSP stuff!
                            // anyhow, get forms that only existed in Gen 4
                            const gen4IndexEntry = genIndex[this.GetDexNum().toString()].find(genEntry => genEntry.Gen === 4);
                            if (!gen4IndexEntry) {
                                console.error(`Could not find gen4 entry for ${this.GetName()}`);
                            }
                            forms = gen4IndexEntry.Forms;
                        } else {
                            // Also unless it's Gen8, then we exclude the Hisuian form if we're not on the PLA listing
                            let subpageId = $table.parent('div[id*="swsh"], div[id*="legends"]').attr('id');
                            if (subpageId && !subpageId.includes('legends')) {
                                forms = this.GetForms().filter(f => f !== 'Hisuian');
                            }
                        }
                    }

                    if (forms.length === 0) {
                        // if no special cases kicked in, just assume all forms
                        forms = this.GetForms();
                    }
                }

                let existing = results.find(r => r.Name === name);
                if (!existing) {
                    results.push({
                        Name: name,
                        Forms: forms
                    });
                } else {
                    existing.Forms.push(...forms.filter(f => !existing.Forms.includes(f)));
                }
            })
        })

        return results;
    }

    GetPokemonData() {
        return {
            ...super.GetPokemonData(),
            LevelUpMoveLists: this.GetLevelUpMoves(),
            EggMoves: this.GetEggMoves(),
            TutorMoves: this.GetTutorMoves(),
            MachineMoves: this.GetMachineMoves()
        }
    }
}

class Gen3MoveParser extends PokeMoveParser {

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
            return !!this.$(e).find('thead tr:first-child').text().match(/Level Up|^Leaf Green$|^Emerald$/);
        });

        $levelUpTables.each((i, table) => {
            let $table = this.$(table);
            let headerText = $table.find('thead tr:first-child').text();

            let forms = this.forms;
            if (this.name === "Deoxys") {
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
            if (this.name === "Deoxys") {
                forms = this.GetDeoxysForms(headerText);
            }

            $table.find('tbody tr:nth-child(2n-1)').each((i, tr) => {
                let $tr = this.$(tr);

                let name = MoveNameFix($tr.find(`td:nth-child(${nameCol})`).first().text());

                if (forms.length === 0) {
                    forms = this.GetForms();
                }

                let existing = results.find(r => r.Name === name);
                if (!existing) {
                    results.push({
                        Name: name,
                        Forms: forms
                    });
                } else {
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

        if (forms.length === 0) {
            return this.forms;
        }

        return forms;
    }
}

const defaultParser = new PokeMoveParser();

const GenParsers = [
    // {index: 1, parser: defaultParser},
    // {index: 2, parser: defaultParser},
    // {index: 3, parser: new Gen3MoveParser()},
    // {index: 4, parser: defaultParser},
    // {index: 5, parser: defaultParser},
    // {index: 6, parser: defaultParser},
    // {index: 7, parser: defaultParser},
    // {index: 8, parser: defaultParser},
    {index: 9, parser: defaultParser},
];

const generationPaths = [
    // { index: 1, path: "generation1" },
    // { index: 2, path: "generation2" },
    // { index: 3, path: "generation3" },
    // { index: 4, path: "generation4" },
    // { index: 5, path: "generation5" },
    // { index: 6, path: "generation6" },
    // { index: 7, path: "generation7" },
    // {index: 8, path: "generation8"},
    {index: 9, path: "generation9"},
];

if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath);

for (let genPath of generationPaths) {
    let folderPath = path.join(inputPath, genPath.path);

    if (!fs.existsSync(folderPath))
        console.error(`Path: ${folderPath} doesn't exist`);

    let parser = GenParsers.find(p => p.index === genPath.index).parser;
    //console.log(parser);

    let bar = new cliProgress.SingleBar({
        format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total} | Gen${genPath.index}: {current}`
    }, cliProgress.Presets.shades_classic);

    const files = fs.readdirSync(folderPath).filter(file => file !== "mainPage.html");

    //files = files.slice(200,201);

    bar.start(files.length, 0, {current: " - "});

    const pokemonData = files.map(file => path.join(folderPath, file))
        .filter(filePath => fs.lstatSync(filePath).isFile())
        .map(filePath => {
            try {
                parser.LoadPage(filePath);
                bar.increment(1, {current: `${parser.GetName()} - ${parser.GetDexNum()}`});
                return parser.GetPokemonData();
            } catch (err) {
                console.error(`\nCould not parse page: ${filePath}, skipping`)
                return null
            }

        }).filter(item => !!item);

    bar.stop();

    //console.log(pokemonData.map(d => d.Name));

    let outFilePath = path.join(outputPath, genPath.path + ".json");

    fs.writeFileSync(outFilePath, JSON.stringify(pokemonData, null, 2));
}
