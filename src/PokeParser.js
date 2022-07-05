const fs = require("fs");
const cheerio = require("cheerio");

const { CURRENT_GENERATION, PokemonNameFix } = require("./util");

class PokeParser {
    $ = null;
    hasAltForms = false;
    name = "";
    dexNum = 0;
    forms = [];

    generation = 0;

    LoadPage(pagePath) {
        this.generation = parseInt(pagePath.match(/generation(\d)/)[1]);

        this.$ = cheerio.load(fs.readFileSync(pagePath));

        this.name = PokemonNameFix(this.$('table.dextable tr:contains("Name")+tr td:nth-child(1)').first().text().trim());

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
        if (this.name == "Indeedee" || this.name == "Meowstic" || this.name == "Pyroar" || this.name == "Basculegion")
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

        //PIKACHUUUUU
        if (this.dexNum == 25)
            forms = Array.from(new Set(["Normal", ...forms]));

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