import React from "react";
import { ShieldCheck, Calendar, BookOpen, AlertCircle, FileText, Database, ShieldAlert, Activity } from "lucide-react";
import { HKLicensedEntity } from "../types";

interface HKEntityCardProps {
  entity: HKLicensedEntity | null;
  loading: boolean;
}

export default function HKEntityCard({ entity, loading }: HKEntityCardProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-slate-200 rounded-md w-1/2 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded-md w-full"></div>
          <div className="h-4 bg-slate-200 rounded-md w-5/6"></div>
          <div className="h-4 bg-slate-200 rounded-md w-4/5"></div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center flex flex-col justify-center items-center min-h-[300px]">
        <ShieldCheck className="w-10 h-10 text-slate-400 mb-3" />
        <h3 className="text-sm font-sans font-semibold text-slate-400">
          Hong Kong Registry Dossier Idle
        </h3>
        <p className="text-[11px] font-sans text-slate-400 mt-1 max-w-xs leading-relaxed">
          Provide a valid SFC CEREF (Central Entity Reference) code in the verification setup card above to query the live corporate compliance database.
        </p>
      </div>
    );
  }

  const isStatusActive = entity.status?.toLowerCase() === "active";
  const sourceNormalized = entity.source || "mongodb-hk_licensed_entities";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 hover:border-slate-300">
      <div className="absolute top-0 left-0 w-1 h-full bg-slate-800"></div>
      
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-slate-400" />
            SFC Authorized Licensing Dossier
          </span>
          <h2 className="text-xl font-sans font-bold text-slate-900 tracking-tight mt-1">
            {entity.name_en}
          </h2>
          {entity.name_zh && (
            <p className="text-sm font-sans font-semibold text-slate-500 mt-0.5">
              {entity.name_zh}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border flex items-center gap-1 ${
            isStatusActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
          }`}>
            <span className={`w-1 h-1 rounded-full ${isStatusActive ? "bg-emerald-500" : "bg-amber-500"}`}></span>
            {entity.status?.toUpperCase() || "ACTIVE"}
          </span>

          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
            <Database className="w-3 h-3 text-slate-400" />
            {sourceNormalized.replace("mongodb-hk_licensed_entities", "DB: SFC Registry")}
          </span>
        </div>
      </div>

      {/* Basic Meta Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Central Entity Ref (CEREF)</span>
          <p className="text-xs font-mono font-bold text-slate-800">
            {entity.ceref}
          </p>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Authorized License Date</span>
          <p className="text-xs font-mono font-medium text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {entity.licensed_date || "Continuous Active Since Registry"}
          </p>
        </div>
      </div>

      {/* Regulated Activities */}
      <div className="mb-6">
        <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">SFC Authorized Regulated Activities</span>
        <div className="flex flex-wrap gap-1.5">
          {entity.regulated_activities && entity.regulated_activities.length > 0 ? (
            entity.regulated_activities.map((act, index) => (
              <span key={index} className="px-2.5 py-1 text-xs font-sans font-semibold rounded-lg bg-slate-100 border border-slate-200 text-slate-800 shadow-sm">
                {act}
              </span>
            ))
          ) : (
            <span className="text-xs font-sans text-slate-500 italic">No activity classes declared.</span>
          )}
        </div>
      </div>

      {/* Comprehensive Paragraphs Narratives */}
      <div className="space-y-4 border-t border-slate-100 pt-5">
        
        {/* SFC Compliance Details Section */}
        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            SFC Regulatory Compliance Parameters
          </span>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs leading-relaxed text-slate-700 font-sans p-0 m-0">
              {entity.sfc_compliance_details}
            </p>
          </div>
        </div>

        {/* Complaints and Disciplinary Actions Section */}
        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            Supervisory Actions & Complaints File
          </span>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs leading-relaxed text-slate-700 font-sans p-0 m-0">
              {entity.complaints_or_disciplinary}
            </p>
          </div>
        </div>

        {/* Risk Profile & Controls Assessment */}
        <div>
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            Corporate Risk Profile & Supervision Controls
          </span>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs leading-relaxed text-slate-700 font-sans p-0 m-0">
              {entity.risk_profile}
            </p>
          </div>
        </div>

      </div>

      {/* Database sync parameters check log */}
      {entity.db_info && (
        <div className="mt-5 pt-3.5 border-t border-slate-100/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-slate-400" />
            {entity.db_info}
          </span>
          {entity.db_error && (
            <span className="text-red-500 font-bold">
              Notice: Standard Fallback Triggered
            </span>
          )}
        </div>
      )}
    </div>
  );
}
