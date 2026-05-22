const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const oldFunc = `async function generateContentWithRetry(params: any): Promise<any> {
  if (!ai) {
    throw new Error("Gemini AI instance is not initialized.");
  }
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    if (is429(err)) {
      const waitMs = parseRetryDelayMs(err);
      console.warn(\`Encountered 429 rate limit. Extracted retryDelay: \${waitMs}ms. Pausing and retrying once.\`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return await ai.models.generateContent(params);
    }
    throw err;
  }
}`;

const newFunc = `async function generateContentWithRetry(params: any, maxRetries = 3): Promise<any> {
  if (!ai) {
    throw new Error("Gemini AI instance is not initialized.");
  }
  let attempt = 0;
  let delay = 2000;
  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      if (is429(err) || err.status === 429) {
        attempt++;
        let waitMs = parseRetryDelayMs(err) || delay;
        console.warn(\`Encountered 429 rate limit. Attempt \${attempt} of \${maxRetries}. Pausing for \${waitMs}ms.\`);
        if (attempt >= maxRetries) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, waitMs));
        delay *= 2; // progressive backoff
      } else {
        throw err;
      }
    }
  }
}`;

if(!code.includes(oldFunc)) {
  console.log("Could not find old func. Regex matching...");
  const oldFuncRegex = /async function generateContentWithRetry[\s\S]*?throw err;\s*\}\s*\}/;
  code = code.replace(oldFuncRegex, newFunc);
} else {
  code = code.replace(oldFunc, newFunc);
}

fs.writeFileSync('server.ts', code);
