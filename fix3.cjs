const fs = require("fs");

let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/      if \(client\) \{\n        try \{ await client.close\(\); \} catch \(_\) \{\}\n      \}\n    \}\n  \n\}\);/g, '      if (client) {\n        try { await client.close(); } catch (_) {}\n      }\n    }\n  }\n});');

fs.writeFileSync("server.ts", content);
