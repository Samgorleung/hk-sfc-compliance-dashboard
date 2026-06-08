const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.startsWith('// API endpoint to fetch company details and execute dual-market compliance mapping'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('async function seedSfcDatabase()'));

if (startIdx !== -1 && endIdx !== -1) {
    const newEndpoint = `// Stream Agent endpoint for UK
app.get("/api/agent-search-uk-stream", async (req, res) => {
  const q = (req.query.q || req.query.query || "").toString().trim();
  if (!q) {
    return res.status(400).json({ error: "The search query is required." });
  }

  res.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive"
  });

  const sendEvent = (data) => {
    res.write(\`data: \${JSON.stringify(data)}\\n\\n\`);
  };

  try {
    const rawResult = await executeUKAgentLoop(q, (stepData) => {
      sendEvent(stepData);
    });
    
    // Ensure array for result matching App.tsx expectations
    let parsedArray = [];
    if (Array.isArray(rawResult)) {
        parsedArray = rawResult;
    } else if (rawResult && typeof rawResult === "object") {
        parsedArray = [rawResult];
    } else if (typeof rawResult === "string") {
        try {
            const parsed = JSON.parse(rawResult);
            parsedArray = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_) { }
    }

    sendEvent({
      step: "complete",
      result: parsedArray,
      message: "UK Agent operations complete. Dual-market compliance records synced."
    });
  } catch (err) {
    console.error(\`[UK Agent Stream Error]:\`, err);
    sendEvent({
      step: "error",
      message: \`Critical UK agent workflow failure: \${err.message || err}\`
    });
  } finally {
    res.end();
  }
});
`;

    lines.splice(startIdx, endIdx - startIdx, newEndpoint);
    fs.writeFileSync('server.ts', lines.join('\n'));
    console.log("Successfully replaced lines.");
} else {
    console.log("Could not find boundaries: startIdx:", startIdx, "endIdx:", endIdx);
}
