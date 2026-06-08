const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('{/* Render UK Report if available */}'));
const endIdx = lines.findIndex(l => l.includes('{/* RIGHT COLUMN: Hong Kong SFC Licensed Entity Check Workspace */}'));

if (startIdx !== -1 && endIdx !== -1) {
    const newUKColumn = `            {/* MCP Agent Status Logs Panel UK */}
            {ukAgentLogs.length > 0 && (
              <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-5 shadow-lg font-mono text-[11px] leading-relaxed animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-2xs">
                      MCP Agent Execution logs (UK)
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-3xs font-semibold px-2 py-0.5 bg-slate-800 rounded text-slate-400 uppercase">
                    {loadingUK ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                        PLANNING LOOP ACTIVE
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                        LOOP COMPLETE
                      </>
                    )}
                  </span>
                </div>
                
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 select-text">
                  {ukAgentLogs.map((log, index) => {
                    let stepColor = "text-slate-400";
                    let stepName = log.step.toUpperCase();
                    
                    if (log.step === "planning") stepColor = "text-amber-400";
                    else if (log.step === "tool_call") stepColor = "text-fuchsia-400";
                    else if (log.step === "tool_exec") stepColor = "text-sky-400";
                    else if (log.step === "reasoning") stepColor = "text-indigo-400";
                    else if (log.step === "complete") stepColor = "text-emerald-400";
                    else if (log.step === "error") stepColor = "text-rose-400";
                    
                    return (
                      <div key={index} className="border-b border-slate-800/40 pb-1.5 last:border-0">
                        <div className="flex items-start gap-1.5">
                          <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                          <span className={\`font-bold uppercase tracking-wider text-[10px] shrink-0 \${stepColor}\`}>
                            {stepName}:
                          </span>
                          <span className="text-slate-300 flex-1">{log.message}</span>
                        </div>
                        {log.tool && (
                          <div className="pl-14 mt-1 text-slate-500 text-3xs flex flex-col gap-0.5">
                            <div><strong className="text-slate-400">Tool:</strong> <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">{log.tool}</code></div>
                            {log.args && Object.keys(log.args).length > 0 && (
                              <div><strong className="text-slate-400">Args:</strong> <code className="text-slate-400 text-[10px]">{JSON.stringify(log.args)}</code></div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Render UK Report if available */}
            {!loadingUK && <UKEntityCard entity={ukEntity} loading={loadingUK} />}
          </div>

`;
    lines.splice(startIdx, endIdx - startIdx, newUKColumn);
    fs.writeFileSync('src/App.tsx', lines.join('\n'));
    console.log("Successfully replaced lines.");
} else {
    console.log("Could not find boundaries.");
}
