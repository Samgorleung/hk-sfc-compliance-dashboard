const fs = require("fs");

let content = fs.readFileSync("server.ts", "utf8");
content = content.replace(/source: "pre-cached"/g, 'source: "mongodb-hk_licensed_entities"');
content = content.replace(/if \(mongoUri && mongoUri\.trim\(\) !== ""\) \{/g, '{');
content = content.replace(/const mongoUri = process\.env\.MONGODB_URI;/g, 'const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";');
fs.writeFileSync("server.ts", content);
