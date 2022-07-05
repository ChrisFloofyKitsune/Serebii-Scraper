To create your own FizzyDex files run the scripts in the following order:

1. scraper - creates /rawHTML/ folder and downloads Serebii pages into it
2. pokemonGenIndexParser - creates /data/pokemonGenIndex.json
3. infoListParser - creates /output/pokemonList.json, a list of info exluding move sets
4. moveListParser - creates /genMoveLists/ folder, and a move list file for each generation
5. moveListConsolidator - combines the generation move lists together into one master list, filling in any blanks left by cross-generational changes for: pre evo moves, TM/HM moves, and tutor moves

Important data is kept in the data folder

* pokemonGenIndex - generated file, notes which Pokemon appeared in which generation and that corresponding HTML file
* extraPokeFormInfo - handmade file, contains extra info to add to certain forms of pokemon `Property: [list of {Form}{Pokemon Name}: "Value"]`
* fizzyDexCustom - handmade file, COMPLETE infomation about any custom Pokemon and Forms that are to be added to the final output files
* evolutionChains - handmade file, list of evolution chains
* formChanges - handmade file, list of form changes

Supporting js code/definitions are kept in the src folder


OUTPUT

* pokemonList.json
* pokemonMoveList.json
