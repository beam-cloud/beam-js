const pkgJson = require(process.env["PKG_JSON_PATH"] || "../package.json");

// With dual outputs, keep paths as-is (pointing at dist/node and dist/browser)

delete pkgJson.devDependencies;
delete pkgJson.scripts.prepack;
delete pkgJson.scripts.prepublishOnly;
delete pkgJson.scripts.prepare;

console.log(JSON.stringify(pkgJson, null, 2));
