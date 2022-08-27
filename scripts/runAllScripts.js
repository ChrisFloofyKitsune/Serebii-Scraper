const execSync = require('child_process').execSync;

// Don't run scrapers automatically
console.log("Building pokemon info list...");
execSync("node ./pokemonGenIndexParser.js", { stdio: "inherit" });

// INFO/POKEMON LIST
console.log("Building pokemon info list...");
execSync("node ./infoListParser.js", { stdio: "inherit" });

// POKEMON MOVE LIST
console.log("Building pokemon move list...");
execSync("node ./moveListParser.js", { stdio: "inherit" });
execSync("node ./moveListConsolidator.js", { stdio: "inherit" });

// ABILITY DEX
console.log("Building ability dex...", { stdio: "inherit" });
execSync("node ./abilityParser.js", { stdio: "inherit" });

// MOVE DEX
console.log("Building move dex...");
execSync("node ./moveParser.js", { stdio: "inherit" });
execSync("node ./moveConsolidator.js", { stdio: "inherit" });
