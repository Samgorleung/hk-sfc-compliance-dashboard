const fs = require("fs");

let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/\} else \{\s*return res\.json\(sanitizeComplianceObject\(\{\s*\.\.\.req\.body,\s*ce_number,\s*ceref: ce_number,\s*company_name: req\.body\.company_name,\s*name_en: req\.body\.company_name,\s*name_zh: req\.body\.name_zh,\s*source: "temp-in-memory"\s*\}\)\);\s*\}/g, "");

fs.writeFileSync("server.ts", content);
