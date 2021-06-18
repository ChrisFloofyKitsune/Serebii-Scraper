const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const { toArabic }  = require("roman-numerals");

const { CURRENT_GENERATION, PokemonNameFix } = require("./util");

class PokeParser {
    $ = null;
    hasAltForms = false;
    name = "";
    dexNum = 0;
    forms = [];

    generation = 0;

    LoadPage(pagePath) {
        this.$ = cheerio.load(fs.readFileSync(pagePath));

        this.name = PokemonNameFix(this.$('table.dextable tr:contains("Name")+tr td:nth-child(1)').first().text().trim());

        let $dexNums = this.$('table.dextable tr:contains("No.")+tr td:nth-child(3)');
        //console.log($dexNums.text());
        this.dexNum = parseInt($dexNums.text().match(/#(\d\d\d)/)[1], 10);

        this.forms = [];
        this.forms = this.ParseForms();

        this.generation = parseInt(pagePath.match(/generation(\d)/)[1]);
    }

    GetName() {
        return this.name;
    }

    GetDexNum() {
        return this.dexNum;
    }

    FormNameFix(formName) {
        if (formName.includes("Form") && !formName.includes("Forme"))
            formName = formName.replace(" Form", "");

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
        //Unown gets special handling for the lols and because we have all their sprites.
        if (this.name == "Unown") {
            return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'.split('');
        }

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

        //Other 'Mega' Forms...
        //Primal
        if (this.$('td.fooevo b:contains("Primal Reversion")') != 0) {
            forms.push("Primal");
        }
        
        //Ultra Burst
        if (this.$('td.fooevo b:contains("Ultra Burst")') != 0) {
            forms.push("Ultra");
        }

        //GMax form check!
        if (this.$('h2:contains("Gigantamax")').length != 0) {
            forms.push(...((this.name == "Urshifu") ? ["Gigantamax Single Strike Style", "Gigantamax Rapid Strike Style"] : ["Gigantamax"]));
        }

        //Fix the legendary bird trio because Serebii messed up on their pages.
        if (this.generation >= 8 && this.GetName().match(/Zapdos|Articuno|Moltres/)) {
            forms.push("Galarian");
        }

        //Add in listings for a few special forms...
        const additionalForms = [
            { Name: "Pichu", Form: "Spiky-eared"},
            { Name: "Greninja", Form: "Battle Bond"},
            { Name: "Rockruff", Form: "Own Tempo"}
        ]
        
        if (this.generation >= 4) {
            let additionalForm = additionalForms.find(af => af.Name == this.name);
            if (additionalForm) {
                forms.push(additionalForm.Form);
            }
        }

        //Can't forget the Cosplay Pikachus!
        if (this.generation >= 6 && this.name == "Pikachu") {
            forms.push(...["Rock Star", "Belle", "Pop Star", "Ph. D", "Libre"])
        }
        //PIKACHU IS GOING TO BE THE END OF ME

        //Fix form ordering (and thus what is the default form) for certain Pokemon because "those are the default forms Chris"
        if (forms.length > 1 && (this.name == "Aegislash" || this.name == "Zygarde" || this.name == "Pumpkaboo" || this.name == "Gourgeist")) {
            let temp = forms[0];
            forms[0] = forms[1];
            forms[1] = temp;
        }

        //Get rid of duplicates
        return [...new Set(forms)];
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
            Forms: this.GetForms()
        }
    }
}

module.exports = {
    PokeParser
}