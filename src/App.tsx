import { useState, useEffect } from "react";
import { 
  Building2, 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Globe, 
  Scale, 
  ChevronRight, 
  Users, 
  RefreshCw, 
  Info, 
  Network,
  HelpCircle,
  Clock,
  ExternalLink,
  Activity,
  Database
} from "lucide-react";
import { ComplianceReport, HKLicensedEntity, UKLicensedEntity } from "./types";
import CompanyForm from "./components/CompanyForm";
import EntityOverview from "./components/EntityOverview";
import HKEntityCard from "./components/HKEntityCard";
import UKEntityCard from "./components/UKEntityCard";
import DueDiligenceMemo from "./components/DueDiligenceMemo";

export default function App() {
  // UK / US Market state
  const [loadingUK, setLoadingUK] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [ukEntity, setUkEntity] = useState<UKLicensedEntity | null>(null);
  const [ukErrorText, setUkErrorText] = useState<string | null>(null);
  const [ukErrorDetails, setUkErrorDetails] = useState<string | null>(null);
  
  // Hong Kong Market state
  const [loadingHK, setLoadingHK] = useState(false);
  const [hkEntity, setHkEntity] = useState<HKLicensedEntity | null>(null);
  const [multipleMatches, setMultipleMatches] = useState<any[]>([]);
  const [hkErrorText, setHkErrorText] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<{ step: string; message: string; timestamp: string; tool?: string; args?: any }[]>([]);
  const [ukAgentLogs, setUkAgentLogs] = useState<{ step: string; message: string; timestamp: string; tool?: string; args?: any }[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        if (data.hasApiKey) {
          setHasApiKey(true);
        }
      })
      .catch(err => console.error("Error checking system health status:", err));
  }, []);

  // Combined panel active sub-tabs for the UK setup
  const [activeTabUK, setActiveTabUK] = useState<"regulatory" | "risk" | "cross_border" | "officers">("regulatory");

  // Search logic for UK Entities using full real-time streaming agentic pipeline
  const handleSearchUK = async (companyNumber: string) => {
    setLoadingUK(true);
    setUkErrorText(null);
    setUkErrorDetails(null);
    setUkEntity(null);
    setUkAgentLogs([]);
    
    const eventSource = new EventSource(`/api/agent-search-uk-stream?q=${encodeURIComponent(companyNumber)}&force=true`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const logItem = {
          step: data.step,
          message: data.message || "",
          timestamp: new Date().toLocaleTimeString(),
          tool: data.tool,
          args: data.args
        };
        setUkAgentLogs(prev => [...prev, logItem]);

        if (data.step === "complete") {
          const parsedUK = data.result;
          if (Array.isArray(parsedUK) && parsedUK.length > 0) {
            setUkEntity(parsedUK[0]);
          } else if (parsedUK && typeof parsedUK === "object" && !Array.isArray(parsedUK)) {
            setUkEntity(parsedUK as any);
          }
          setLoadingUK(false);
          eventSource.close();
        } else if (data.step === "error") {
          setUkErrorText(data.message);
          setLoadingUK(false);
          eventSource.close();
        }
      } catch (parseErr) {
        console.error("Error parsing SSE data:", parseErr);
      }
    };

    eventSource.onerror = (err) => {
      console.error("UK Agent EventSource error:", err);
      setUkErrorText("An unexpected error occurred during the UK entity dual-registry stream assessment.");
      setUkErrorDetails(
        "Standard UK Companies House and FCA registry integration failed. Live SSE stream dropped."
      );
      setLoadingUK(false);
      eventSource.close();
    };
  };

  // Search logic for HK Licensed Entities using full real-time streaming agentic pipeline
  const handleSearchHK = async (identifier: string) => {
    setLoadingHK(true);
    setHkErrorText(null);
    setHkEntity(null);
    setMultipleMatches([]);
    setAgentLogs([]);

    // Open EventSource context
    const eventSource = new EventSource(`/api/agent-search-stream?q=${encodeURIComponent(identifier)}&force=true`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const logItem = {
          step: data.step,
          message: data.message || "",
          timestamp: new Date().toLocaleTimeString(),
          tool: data.tool,
          args: data.args
        };
        setAgentLogs(prev => [...prev, logItem]);

        if (data.step === "complete") {
          const parsedHK = data.result;
          if (Array.isArray(parsedHK)) {
            if (parsedHK.length === 1) {
              setHkEntity(parsedHK[0]);
              setMultipleMatches([]);
            } else if (parsedHK.length > 1) {
              setMultipleMatches(parsedHK);
              setHkEntity(null);
            } else {
              setHkEntity(null);
              setMultipleMatches([]);
            }
          } else if (parsedHK && typeof parsedHK === "object") {
            setHkEntity(parsedHK);
          }
          setLoadingHK(false);
          eventSource.close();
        } else if (data.step === "error") {
          setHkErrorText(data.message);
          setLoadingHK(false);
          eventSource.close();
        }
      } catch (parseErr) {
        console.error("Error parsing SSE data:", parseErr);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Agent EventSource error:", err);
      // Fallback: If SSE is blocked (e.g. by reverse proxies or local environment), fetch directly
      console.warn("Real-time telemetry event stream broken. Engaging backward compatible REST fetch pool...");
      fetch(`/api/search/hk?q=${encodeURIComponent(identifier)}&force=true`)
        .then(res => {
          if (!res.ok) throw new Error("A communication failure occurred with the SFC database check server.");
          return res.json();
        })
        .then(parsedHK => {
          if (Array.isArray(parsedHK)) {
            if (parsedHK.length === 1) {
              setHkEntity(parsedHK[0]);
              setMultipleMatches([]);
            } else if (parsedHK.length > 1) {
              setMultipleMatches(parsedHK);
              setHkEntity(null);
            } else {
              setHkEntity(null);
              setMultipleMatches([]);
            }
          } else if (parsedHK && typeof parsedHK === "object") {
            setHkEntity(parsedHK);
          }
        })
        .catch(fetchErr => {
          setHkErrorText(fetchErr.message || "An unexpected error occurred during the SFC licensed corporation check.");
        })
        .finally(() => {
          setLoadingHK(false);
          eventSource.close();
        });
    };
  };

  const handleSelectHKDemo = async (selectedCeNumber: string) => {
    setLoadingHK(true);
    setHkErrorText(null);
    try {
      console.log(`Executing background compliance sync request for target SFC reference: [${selectedCeNumber}].`);
      const syncResponse = await fetch(`/api/hk-entity/${encodeURIComponent(selectedCeNumber)}?force=true`);
      if (!syncResponse.ok) {
        console.warn(`Background compliance sync fetch request returned an error status: ${syncResponse.status}`);
      }
    } catch (err) {
      console.error("Background licensing sync network request encountered an unexpected connection failure:", err);
    } finally {
      setLoadingHK(false);
    }
    await handleSearchHK(selectedCeNumber);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16 selection:bg-slate-200">
      {/* Editorial Regulatory Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-inner">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
                Cross-Border Legal Registry Interface
              </span>
              <h1 className="text-xl font-sans font-bold text-slate-900 tracking-tight">
                Dual-Market Corporate Compliance Analytics
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
            {hasApiKey ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md shadow-2xs font-semibold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Paid API Key Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-1.5 py-1 text-slate-400">
                Using Base Key
              </span>
            )}
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-md border border-slate-200 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Systems Core Operational
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 print:pt-0">
        
        {/* Banner with Bilateral Context */}
        <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-sm relative overflow-hidden border border-slate-800 mb-8 print:hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800/30 rounded-full blur-2xl"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Globe className="w-4.5 h-4.5" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Dual-Market Objective Standards</span>
              </div>
              <h4 className="text-lg font-sans font-semibold tracking-tight text-white mb-2">
                Bilateral Compliance Oversight Portal
              </h4>
              <p className="text-xs font-sans text-slate-500 leading-relaxed m-0">
                This automated interface evaluates corporate legality standing in parallel across both the United Kingdom (Companies House & Securities frameworks) and Hong Kong (Securities and Futures Commission licenses). Each evaluated profile executes linguistic compliance evaluations strictly designed for regulatory assessment.
              </p>
            </div>
            <div className="text-right flex flex-col justify-between items-end text-3xs font-mono text-slate-500 shrink-0">
              <span>Jurisdiction Link: UK London - HK Central Link</span>
              <span>Classification Framework v2.85-prod</span>
            </div>
          </div>
        </div>

        {/* Dual Market Verification Selection Panels */}
        <div className="print:hidden">
          <CompanyForm 
            onSearchUK={handleSearchUK}
            loadingUK={loadingUK}
            onSelectUKDemo={handleSearchUK}

            onSearchHK={handleSearchHK}
            loadingHK={loadingHK}
            onSelectHKDemo={handleSelectHKDemo}
          />
        </div>

        {/* Dual-Market Side-by-Side Results Workspaces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 print:hidden">
          
          {/* LEFT COLUMN: United Kingdom & US Compliance Setup */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                London Jurisdiction Core
              </span>
              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full uppercase font-bold text-3xs">
                Companies House Mode
              </span>
            </div>

            {/* Error warnings for UK search */}
            {ukErrorText && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-slate-800 shadow-sm">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-sans font-bold text-red-950 uppercase tracking-wide">
                      Registry Verification Interruption
                    </h4>
                    <p className="text-xs font-sans text-red-900 mt-1 leading-relaxed">
                      {ukErrorText}
                    </p>
                    {ukErrorDetails && (
                      <p className="text-[10px] font-sans text-red-700 mt-2 leading-relaxed border-t border-red-200 pt-2 text-3xs">
                        {ukErrorDetails}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator for UK */}
            {loadingUK && !report && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
                <RefreshCw className="w-6 h-6 text-slate-900 animate-spin mx-auto mb-3" />
                <h3 className="text-xs font-sans font-semibold text-slate-900">
                  Running UK Cross-Border Compliance Engine...
                </h3>
              </div>
            )}

            {/* MCP Agent Status Logs Panel UK */}
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
                          <span className={`font-bold uppercase tracking-wider text-[10px] shrink-0 ${stepColor}`}>
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


          {/* RIGHT COLUMN: Hong Kong SFC Licensed Entity Check Workspace */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Hong Kong SFC Licensing Core
              </span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase font-bold text-3xs">
                SFC LIVE ENGINE MODE
              </span>
            </div>

            {/* Error warnings for HK check */}
            {hkErrorText && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-slate-800 shadow-sm animate-fadeIn">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-sans font-bold text-red-950 uppercase tracking-wide">
                      Licensing Verification Interruption
                    </h4>
                    <p className="text-xs font-sans text-red-900 mt-1 leading-relaxed">
                      {hkErrorText}
                    </p>
                    <p className="text-[10px] font-sans text-red-700 mt-2 leading-relaxed border-t border-red-200 pt-2 text-3xs">
                      The licensing lookup process failed to find a valid response or connect to regional endpoints. Backup procedures will activate fallback models to maintain standard assessment profiles.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MCP Agent Status Logs Panel */}
            {agentLogs.length > 0 && (
              <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-5 shadow-lg font-mono text-[11px] leading-relaxed animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-2xs">
                      MCP Agent Execution logs
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-3xs font-semibold px-2 py-0.5 bg-slate-800 rounded text-slate-400 uppercase">
                    {loadingHK ? (
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
                  {agentLogs.map((log, index) => {
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
                          <span className={`font-bold uppercase tracking-wider text-[10px] shrink-0 ${stepColor}`}>
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

            {/* Loading Indicator for HK */}
            {loadingHK && !hkEntity && (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm animate-pulse">
                <RefreshCw className="w-6 h-6 text-slate-900 animate-spin mx-auto mb-3" />
                <h3 className="text-xs font-sans font-semibold text-slate-900">
                  Running HK Licensing Database Evaluation...
                </h3>
              </div>
            )}

            {/* Render HK Results of Multi-match Search or Single-match Card */}
            {!loadingHK && multipleMatches.length > 1 && !hkEntity ? (
              <div id="hk-disambiguation-container" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <span className="px-2.5 py-1 bg-slate-900 text-white rounded font-mono text-[10px] uppercase font-bold tracking-wider shrink-0">
                    System Alert
                  </span>
                  <h3 className="text-sm font-sans font-bold text-slate-800">
                    Multiple Matching Records Discovered
                  </h3>
                </div>
                <p className="text-xs font-sans text-slate-500 mb-4 leading-relaxed">
                  Bilateral database scan matched multiple registered entities to your query. Please select the specific legal entity to execute regional regulatory evaluation.
                </p>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {multipleMatches.map((item, index) => {
                    const engName = item.company_name || item.name_en;
                    const chiName = item.name_zh || "";
                    const code = item.ce_number || item.ceref || "";
                    return (
                      <button
                        key={index}
                        id={`hk-disambiguation-item-${code}`}
                        onClick={async () => {
                          const targetCode = item.ce_number || item.ceref || "";
                          setLoadingHK(true);
                          try {
                            const res = await fetch(`/api/hk-entity/${encodeURIComponent(targetCode)}`);
                            if (res.ok) {
                              const data = await res.json();
                              if (data && data.length > 0) {
                                setHkEntity(data[0]);
                              } else {
                                setHkEntity(item);
                              }
                            } else {
                              setHkEntity(item);
                            }
                          } catch (err) {
                            console.error("Failed background synchronization fetch:", err);
                            setHkEntity(item);
                          } finally {
                            setLoadingHK(false);
                          }
                        }}
                        className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between gap-4 outline-none focus:border-slate-800"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="block text-xs font-sans font-bold text-slate-900 truncate">
                            {engName}
                          </span>
                          {chiName && (
                            <span className="block text-[11px] font-sans text-slate-500 font-semibold mt-0.5">
                              {chiName}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block text-[10px] font-mono bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded font-bold">
                            {code}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              !loadingHK && (
                <>
                  {multipleMatches.length > 1 && hkEntity && (
                    <div className="mb-4">
                      <button
                        id="hk-back-to-disambiguation-btn"
                        onClick={() => setHkEntity(null)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
                      >
                        ← Back to Selection List ({multipleMatches.length} Matched)
                      </button>
                    </div>
                  )}
                  <HKEntityCard entity={hkEntity} loading={loadingHK} />
                </>
              )
            )}

          </div>

        </div>

        {/* Global Cross-Border Audit Memorandum Exporter */}
        <DueDiligenceMemo ukEntity={ukEntity} hkEntity={hkEntity} />

      </main>

      {/* Corporate Compliance Officer Regulatory Disclaimer Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-300 text-slate-500 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
          <div className="md:col-span-2">
            <span className="block font-mono font-bold uppercase text-slate-700 tracking-wider mb-2">
              Statutory Compliance & Legal Disclaimer
            </span>
            <p className="p-0 m-0">
              Evaluations and compliance cross-mappings generated through this bilateral compliance system are computed utilizing objective corporate parameters and registers retrieved dynamically or via cached reference indices. No segment of this assessment represents formal legal counsel, dual-jurisdiction tax consulting, or direct validation of regulatory standing. Compliance officers and authorized regulatory bodies must establish manual verification procedures to confirm active cross-border standpoints in compliance with direct territorial guidelines.
            </p>
          </div>
          <div>
            <span className="block font-mono font-bold uppercase text-slate-700 tracking-wider mb-2">
              Corporate Intelligence Systems
            </span>
            <p className="p-0 m-0 text-3xs font-mono leading-relaxed">
              Bilateral Mapping Engine Version 2.85-PROD<br />
              Connected client-side MongoDB: Port 27017 Direct<br />
              SFC Registry Verification: SFC LIVE ENGINE MODE<br />
              Tone: Objective Regulatory-Aligned Corporate Profile
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
