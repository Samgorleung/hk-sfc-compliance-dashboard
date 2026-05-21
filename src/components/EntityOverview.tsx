import { CheckCircle2, AlertTriangle, Building2, Calendar, MapPin, Tag } from "lucide-react";
import { ComplianceReport } from "../types";

interface EntityOverviewProps {
  report: ComplianceReport;
  loading: boolean;
}

export default function EntityOverview({ report, loading }: EntityOverviewProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-8 bg-slate-200 rounded-md w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-12 bg-slate-200 rounded-md"></div>
          <div className="h-12 bg-slate-200 rounded-md"></div>
          <div className="h-12 bg-slate-200 rounded-md"></div>
          <div className="h-12 bg-slate-200 rounded-md"></div>
        </div>
      </div>
    );
  }

  const isStatusActive = report.status.toLowerCase() === "active";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 relative overflow-hidden transition-all duration-300 hover:border-slate-300">
      <div className="absolute top-0 left-0 w-1 h-full bg-slate-800"></div>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
        <div>
          <span className="text-xs font-mono font-medium tracking-wider text-slate-400 uppercase">
            Official Corporate Registration File
          </span>
          <h2 className="text-2xl font-sans font-semibold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-700" />
            {report.company_name}
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-full flex items-center gap-1.5 ${
            isStatusActive ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isStatusActive ? "bg-emerald-500" : "bg-amber-500"}`}></span>
            Entity Status: {report.status.toUpperCase()}
          </span>
          
          <span className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-full border ${
            report.fetched_live 
              ? "bg-slate-50 text-slate-700 border-slate-200" 
              : "bg-blue-50 text-blue-700 border-blue-100"
          }`}>
            {report.fetched_live ? "Origin: Live Registry API" : "Origin: Cached Profile"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">UK Entity Identifier</span>
          <p className="text-sm font-mono font-semibold text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100 inline-block">
            {report.company_number}
          </p>
        </div>

        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Incorporation Date</span>
          <p className="text-sm font-sans font-medium text-slate-700 flex items-center gap-1.5 py-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            {report.incorporation_date}
          </p>
        </div>

        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Jurisdiction Standing</span>
          <p className="text-sm font-sans font-medium text-slate-700 flex items-center gap-1.5 py-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {report.jurisdiction}
          </p>
        </div>

        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Accounts Schedule</span>
          <span className={`px-2.5 py-1 text-xs font-sans font-semibold rounded-md inline-flex items-center gap-1 mt-1 ${
            report.accounts_standing.status === "compliant"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-red-50 text-red-700 border border-red-100"
          }`}>
            {report.accounts_standing.status === "compliant" ? "Filing Standing: Compliant" : "Filing Standing: Overdue"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-slate-100 pt-5">
        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Registered Corporate Address</span>
          <p className="text-sm font-sans text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2 leading-relaxed">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            {report.registered_office}
          </p>
        </div>

        <div>
          <span className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Primary Industrial Category (SIC)</span>
          <div className="flex flex-wrap gap-1.5">
            {report.nature_of_business.map((sic, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-sans font-medium text-slate-700 shadow-sm">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                {sic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
