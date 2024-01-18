const execSync = require('child_process').execSync;

// Don't run scrapers unless Serebii has pushed out updates
console.log("Running main scraper");
execSync("node ./scraper.js", { stdio: "inherit" });

console.log("Running move scraper");
execSync("node ./moveScraper.js", { stdio: "inherit" });

console.log("Running ability scraper");
execSync("node ./abilityScraper.js", { stdio: "inherit" });
