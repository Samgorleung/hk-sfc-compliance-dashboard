import React, { useState } from "react";
import { Search, Loader2, Play, Building2, ShieldCheck } from "lucide-react";

interface CompanyFormProps {
  onSearchUK: (companyNumber: string) => void;
  loadingUK: boolean;
  onSelectUKDemo: (companyNumber: string) => void;
  demoCompaniesUK: Array<{ company_number: string; company_name: string }>;

  onSearchHK: (identifier: string) => void;
  loadingHK: boolean;
  onSelectHKDemo: (identifier: string) => void;
  demoCompaniesHK: Array<{ company_number: string; company_name: string }>;
}

export default function CompanyForm({
  onSearchUK,
  loadingUK,
  onSelectUKDemo,
  demoCompaniesUK,
  onSearchHK,
  loadingHK,
  onSelectHKDemo,
  demoCompaniesHK,
}: CompanyFormProps) {
  const [ukInput, setUkInput] = useState("");
  const [ukError, setUkError] = useState("");

  const [hkInput, setHkInput] = useState("");
  const [hkError, setHkError] = useState("");

  const handleUKSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUkError("");

    const formatted = ukInput.trim();
    if (!formatted) {
      setUkError("The UK company identifier is required for verification.");
      return;
    }

    if (formatted.length > 8) {
      setUkError("Standard UK corporate entity identifiers are limited to 8 characters.");
      return;
    }

    onSearchUK(formatted);
  };

  const handleHKSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHkError("");

    const formatted = hkInput.trim();
    if (!formatted) {
      setHkError("The HK licensed entity identifier is required for verification.");
      return;
    }

    onSearchHK(formatted);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* UK Corporate Entity Verification Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative flex flex-col justify-between">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-slate-800" />
            <h3 className="text-sm font-sans font-bold text-slate-800 tracking-tight uppercase">
              UK Corporate Registry Verification
            </h3>
          </div>
          <p className="text-xs font-sans text-slate-500 mb-5 leading-relaxed min-h-[48px]">
            Verification of official United Kingdom corporate registrations requires entering a unique 8-character UK Company Number (e.g., eight numeric digits or standard prefixes such as SC, NI, or OC). On submission, compliance engines analyze the active filings against dual jurisdictional parameters.
          </p>

          <form onSubmit={handleUKSubmit} className="mb-4">
            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                id="uk-corporate-entity-identifier-input"
                type="text"
                placeholder="UK Corporate Entity Identifier"
                value={ukInput}
                onChange={(e) => {
                  setUkInput(e.target.value);
                  if (ukError) setUkError("");
                }}
                disabled={loadingUK}
                className="block w-full pl-9 pr-4 py-2 font-mono text-xs text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg outline-hidden transition-all duration-200"
              />
            </div>
            
            <button
              id="verify-compliance-button"
              type="submit"
              disabled={loadingUK}
              className="w-full px-4 py-2 text-xs font-sans font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200"
            >
              {loadingUK ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Executing evaluation...
                </>
              ) : (
                "Verify UK Legal Standing"
              )}
            </button>

            {ukError && (
              <p className="mt-2 text-xs font-sans font-medium text-red-600 flex items-center gap-1">
                {ukError}
              </p>
            )}
          </form>
        </div>

        {demoCompaniesUK.length > 0 && (
          <div className="border-t border-slate-200 pt-4 mt-2">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              Available UK Demo Indices
            </span>
            <div className="flex flex-wrap gap-1.5">
              {demoCompaniesUK.map((dem) => (
                <button
                  key={dem.company_number}
                  type="button"
                  onClick={() => {
                    setUkInput(dem.company_number);
                    onSelectUKDemo(dem.company_number);
                  }}
                  disabled={loadingUK}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Play className="w-2.5 h-2.5 text-slate-400" />
                  {dem.company_name} ({dem.company_number})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hong Kong SFC Licensed Entity Check Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative flex flex-col justify-between">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-slate-800" />
            <h3 className="text-sm font-sans font-bold text-slate-800 tracking-tight uppercase">
              Hong Kong SFC Licensed Entity Check
            </h3>
          </div>
          <p className="text-xs font-sans text-slate-500 mb-5 leading-relaxed min-h-[48px]">
            Verification of Hong Kong SFC licensed corporations requires inputting a dedicated Central Entity Reference (CEREF) code or name. Registered entries are cross-referenced with licensing databases to execute immediate regulatory due diligence mapping.
          </p>

          <form onSubmit={handleHKSubmit} className="mb-4">
            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                id="hk-corporate-entity-identifier-input"
                type="text"
                placeholder="Hong Kong SFC CEREF (e.g. AAL982)"
                value={hkInput}
                onChange={(e) => {
                  setHkInput(e.target.value);
                  if (hkError) setHkError("");
                }}
                disabled={loadingHK}
                className="block w-full pl-9 pr-4 py-2 font-mono text-xs text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-lg outline-hidden transition-all duration-200"
              />
            </div>
            
            <button
              id="verify-hk-licensing-button"
              type="submit"
              disabled={loadingHK}
              className="w-full px-4 py-2 text-xs font-sans font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors duration-200"
            >
              {loadingHK ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Executing evaluation...
                </>
              ) : (
                "Verify HK Licensing Standing"
              )}
            </button>

            {hkError && (
              <p className="mt-2 text-xs font-sans font-medium text-red-600 flex items-center gap-1">
                {hkError}
              </p>
            )}
          </form>
        </div>

        {demoCompaniesHK.length > 0 && (
          <div className="border-t border-slate-200 pt-4 mt-2">
            <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
              Available Hong Kong SFC Demo Indices
            </span>
            <div className="flex flex-wrap gap-1.5">
              {demoCompaniesHK.map((dem) => (
                <button
                  key={dem.company_number}
                  type="button"
                  onClick={() => {
                    setHkInput(dem.company_number);
                    onSelectHKDemo(dem.company_number);
                  }}
                  disabled={loadingHK}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Play className="w-2.5 h-2.5 text-slate-400" />
                  {dem.company_name} ({dem.company_number})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
