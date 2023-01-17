const fs = require("fs");
const cheerio = require("cheerio");

const {PokemonNameFix} = require("./util");

class PokeParser {
    /** @type {cheerio.CheerioAPI} */
    $ = null;
    name = "";
    dexNum = 0;
    /** @type {string[]} */
    forms = [];

    generation = 0;

    LoadPage(pagePath) {
        this.generation = parseInt(pagePath.match(/generation(\d)/)[1]);

        this.$ = cheerio.load(fs.readFileSync(pagePath));

        if (this.generation !== 3) {
            this.name = PokemonNameFix(this.$('table.dextable tr:contains("Name")+tr td:nth-child(1)').first().text().trim());

            let $dexNums = this.$('table.dextable tr:contains("No.")+tr td:nth-child(3)');
            this.dexNum = parseInt($dexNums.text().match(/#(\d+)/)[1], 10);
        } else {
            // Serebii started at gen 3. There is some... "early installment weirdness" to account for in page layout.
            this.name = PokemonNameFix(this.$('table tr:contains("English name")+tr td:nth-child(4)').first().text().trim());

            let $dexNum = this.$('table tr:contains("National No.")+tr td:nth-child(2)');
            this.dexNum = parseInt($dexNum.text().trim().match(/(\d\d\d)/)[1], 10);
        }

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
            formName = formName.replace(" Form", "");

        formName = formName.replace(this.name, "").trim();

        formName = formName.replace(/ ?(Kantonian|Johtonian|Hoennian|Unovan|Kalosian) ?/, "").trim();

        if (formName === "Alola")
            formName = "Alolan";

        /** @type {{
         *    name: string,
         *    form: (string | true | function(f:string):boolean),
         *    result: (string | function(f:string):string)
         *  }[]}*/
        const fixesList = [
            {name: "Burmy", form: "No Cloak", result: "Plant Cloak"},
            {name: "Wormadam", form: f => f && !f.includes("Cloak"), result: f => f + " Cloak"},
            {name: "Arceus", form: true, result: f => f.replace("-type", "")},
            {name: "Silvally", form: true, result: f => f.replace("Type: ", "")},
            {name: "Vivillon", form: true, result: f => f.replace(" Pattern", "").replace("é", "e")},
            {name: "Darmanitan", form: true, result: f => f.replace("Standard Mode", "").trim()},
            {name: "Wishiwashi", form: "School", result: "Schooling"},
            {name: "Furfrou", form: "Deputante Trim", result: "Debutante Trim"},
            {name: "Greninja", form: "Ash-", result: "Ash"},
            {name: "Unown", form: "Normal", result: "A"},
            {name: "Pikachu", form: "Ph. D.", result: "Ph. D"},
            {name: "Pikachu", form: "Cosplay", result: "Normal"},
            {name: "Pikachu", form: "Partner  Only", result: "Normal"},
            {name: "Eevee", form: "Partner  Only", result: "Normal"},
            {name: "Keldeo", form: "Ordinary", result: "Normal"},
            {name: "Xerneas", form: "Neutral Mode", result: "Normal"},
            {name: "Xerneas", form: "Active Mode", result: "Active"},
            {name: "Zygarde", form: "Normal", result: "50% Forme"},
            {name: "Sinistea", form: true, result: "Normal"},
            {name: "Polteageist", form: true, result: "Normal"},
            {name: "Genesect", form: true, result: "Normal"},
            {name: "Morpeko", form: true, result: f => f.replace(" Mode", "")},
            {name: "Tauros", form: f => /Paldean\S/.test(f), result: f => f.replace("Paldean", "Paldean ")},
            {name: "Tauros", form: "Regular", result: "Normal"},
            {name: "Tauros", form: "Paldean", result: "Paldean Combat Breed"},
            {name: "Tauros", form: "Blaze Breed", result: "Paldean Blaze Breed"},
            {name: "Tauros", form: "Aqua Breed", result: "Paldean Aqua Breed"},
            {name: "Decidueye", form: "Alolan", result: "Normal"}
        ]

        const fix = fixesList.find(f =>
            this.name === f.name &&
            (typeof f.form === "function" ?
                f.form(formName) : (formName === f.form || f.form === true))
        );

        if (!!fix) {
            // console.log("Applying fix: ", fix, " to pokemon: ", this.name, " form:", formName);
            formName = (typeof fix.result === "function" ? fix.result(formName) : fix.result);
        }

        if (formName === "")
            formName = "Normal";

        if (this.forms.length !== 0 && formName === "Normal")
            return this.GetDefaultForm();

        return formName;
    }

    ParseForms() {
        if (this.generation <= 3) {
            // Forms didn't exist until gen3... in which they were only for Deoxys via hacky weirdness
            if (this.name === "Deoxys")
                return ["Normal Forme", "Attack Forme", "Defense Forme", "Speed Forme"];

            if (this.name === "Unown")
                return ["A"];

            return ["Normal"];
        }

        //Unown gets special handling for the lols and because we have all their sprites.
        if (this.name === "Unown") {
            return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'.split('');
        }

        let query = 'table.dextable tr:contains("Alternate Forms")';
        if (
            this.name === "Indeedee" ||
            this.name === "Meowstic" ||
            this.name === "Pyroar" ||
            this.name === "Basculegion" ||
            this.name === "Oinkologne"
        )
            query = 'table.dextable tr:contains("Gender Differences")';

        let $formHeader = this.$(query);
        //console.log($formHeader);

        /** @type{[]}*/
        let forms;
        if ($formHeader.length === 0)
            forms = ["Normal"];
        else {
            forms = [...new Set($formHeader.next('tr')
                .find('td.pkmn b')
                .map((i, e) => {
                    return this.$(e).text();
                }).get())];
        }

        forms = forms.map(f => this.FormNameFix(f));

        //PIKACHUUUUU
        if (this.dexNum === 25)
            forms = Array.from(new Set(["Normal", ...forms]));

        //Mega form(s) check!
        if (this.$('td.fooevo b:contains("Mega Evolution")').length !== 0) {
            forms.push(...((this.name === "Charizard" || this.name === "Mewtwo") ? ["Mega X", "Mega Y"] : ["Mega"]));
        }

        //Other 'Mega' Forms...
        //Primal
        if (this.$('td.fooevo b:contains("Primal Reversion")').length !== 0) {
            forms.push("Primal");
        }

        //Ultra Burst
        if (this.$('td.fooevo b:contains("Ultra Burst")').length !== 0) {
            forms.push("Ultra");
        }

        //GMax form check!
        if (this.$('h2:contains("Gigantamax")').length !== 0) {
            forms.push(...((this.name === "Urshifu") ? ["Gigantamax Single Strike Style", "Gigantamax Rapid Strike Style"] : ["Gigantamax"]));
        }

        //Add in listings for a few special forms...
        const additionalForms = [
            {Name: "Pichu", Form: "Spiky-eared"},
            {Name: "Greninja", Form: "Battle Bond"},
            {Name: "Rockruff", Form: "Own Tempo"}
        ]

        if (this.generation >= 4) {
            let additionalForm = additionalForms.find(af => af.Name === this.name);
            if (additionalForm) {
                forms.push(additionalForm.Form);
            }
        }

        //Can't forget the Cosplay Pikachus!
        if (this.generation >= 6 && this.name === "Pikachu") {
            forms.push(...["Rock Star", "Belle", "Pop Star", "Ph. D", "Libre"])
        }
        //PIKACHU IS GOING TO BE THE END OF ME

        //Fix form ordering (and thus what is the default form) for certain Pokemon because "those are the default forms Chris"
        if (forms.length > 1 && (this.name === "Aegislash" || this.name === "Zygarde" || this.name === "Pumpkaboo" || this.name === "Gourgeist" || this.name === "Maushold")) {
            let temp = forms[0];
            forms[0] = forms[1];
            forms[1] = temp;
        }

        //Get rid of duplicates
        return Array.from(new Set(forms));
    }

    GetForms() {
        return this.forms;
    }

    GetDefaultForm() {
        return this.forms[0];
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
