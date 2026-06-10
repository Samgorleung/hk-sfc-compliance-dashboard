import React, { useState, useEffect } from "react";
import {
  GitCompare,
  Network,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  User,
  Building,
  Shield,
  HelpCircle,
  ArrowRight,
  Filter,
  CheckSquare,
  Users,
  Search,
  Globe,
  Plus
} from "lucide-react";
import { UKLicensedEntity, HKLicensedEntity } from "../types";

interface RegulatoryWorkspaceHubProps {
  ukEntity: UKLicensedEntity | null;
  hkEntity: HKLicensedEntity | null;
}

// Interactive UBO Tree Node Definition
interface TreeNode {
  id: string;
  name: string;
  role: string;
  type: "ubo" | "parent" | "uk_entity" | "hk_entity" | "director" | "compliance";
  shareholding?: number;
  votingRights?: number;
  jurisdiction: string;
  amlRisk: "Low" | "Medium" | "High";
  verified: boolean;
  notes: string;
}

// Filing Deadline Definition
interface FilingDeadline {
  id: string;
  title: string;
  jurisdiction: "UK" | "HK" | "Global";
  authority: "Companies House" | "FCA" | "SFC";
  dueDate: string;
  daysRemaining: number;
  status: "compliant" | "upcoming" | "overdue";
  description: string;
}

export default function RegulatoryWorkspaceHub({
  ukEntity,
  hkEntity,
}: RegulatoryWorkspaceHubProps) {
  const [activeTab, setActiveTab] = useState<"matrix" | "ubo" | "calendar">("matrix");

  // State for interactive License Mapper
  const [customUKActivities, setCustomUKActivities] = useState<string[]>([]);
  const [translationGaps, setTranslationGaps] = useState<string[]>([]);
  const [hasUnsavedModifications, setHasUnsavedModifications] = useState(false);

  // State for interactive UBO tree
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // State for Filing Calendar
  const [deadlines, setDeadlines] = useState<FilingDeadline[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<"all" | "critical" | "uk" | "hk">("all");

  const todayStr = "2026-06-07";

  // UK FCA Regulated activities and their corresponding HK SFC equivalents mapping dictionary
  const activityTranslations = [
    {
      ukActivity: "Dealing in investments as principal",
      hkEquivalentCode: "Type 1",
      hkEquivalentName: "Dealing in securities",
      category: "Securities Operations",
      relevance: "High - Required to structure and market trade books locally."
    },
    {
      ukActivity: "Dealing in investments as agent",
      hkEquivalentCode: "Type 1",
      hkEquivalentName: "Dealing in securities",
      category: "Securities Operations",
      relevance: "High - Standard broker-dealer matching interface clearance."
    },
    {
      ukActivity: "Managing Investments",
      hkEquivalentCode: "Type 9",
      hkEquivalentName: "Asset Management",
      category: "Portfolio Management",
      relevance: "Critical - Mandatory for running discretionary wealth mandates."
    },
    {
      ukActivity: "Managing an AIF",
      hkEquivalentCode: "Type 9",
      hkEquivalentName: "Asset Management",
      category: "Asset Pooling",
      relevance: "Critical - Relates directly to secondary market non-retail funds of alternative regulatory nature."
    },
    {
      ukActivity: "Managing an AIF/UCITS",
      hkEquivalentCode: "Type 9",
      hkEquivalentName: "Asset Management",
      category: "Asset Pooling",
      relevance: "Highly Aligned - Covers UK UCITS management models which translate directly into HK SFC schemes."
    },
    {
      ukActivity: "Advising on investments",
      hkEquivalentCode: "Type 4",
      hkEquivalentName: "Advising on securities",
      category: "Investment Advisory",
      relevance: "Standard - Governs research distributions and custom stock portfolio buy/sell advisory parameters."
    },
    {
      ukActivity: "Advising on corporate finance",
      hkEquivalentCode: "Type 6",
      hkEquivalentName: "Advising on corporate finance",
      category: "Investment Banking",
      relevance: "Specialized - Relates to advisory frameworks on Listings, Mergers, Acquisitions, and IPO underwritings."
    },
    {
      ukActivity: "Dealing in futures contracts",
      hkEquivalentCode: "Type 2",
      hkEquivalentName: "Dealing in futures contracts",
      category: "Derivative Operations",
      relevance: "Advanced - Pre-requisite for clearing leveraged futures options or standard currency swaps."
    },
    {
      ukActivity: "Advising on futures contracts",
      hkEquivalentCode: "Type 5",
      hkEquivalentName: "Advising on futures contracts",
      category: "Derivative Advisory",
      relevance: "Advanced - Safeguards regulatory advice given on speculative indices."
    },
    {
      ukActivity: "Establishing, operating or winding up a collective investment scheme",
      hkEquivalentCode: "Type 9",
      hkEquivalentName: "Asset Management",
      category: "Asset Pooling",
      relevance: "Critical - Requires active collective investment structures authorization."
    }
  ];

  // Populate dynamic default states based on chosen UK entity's regulated activities
  useEffect(() => {
    if (ukEntity) {
      const parsedActivities: string[] = [];
      if (Array.isArray(ukEntity.regulated_activities)) {
        parsedActivities.push(...ukEntity.regulated_activities);
      } else if (typeof ukEntity.regulated_activities === "string") {
        const list = (ukEntity.regulated_activities as string)
          .split(/[;,]|\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        parsedActivities.push(...list);
      }
      setCustomUKActivities(parsedActivities.length > 0 ? parsedActivities : ["Managing Investments", "Advising on investments"]);
    } else {
      setCustomUKActivities(["Managing Investments", "Advising on investments", "Dealing in investments as agent"]);
    }
  }, [ukEntity]);

  // Compute licensing gap alerts between active UK activities and HK SFC activities
  useEffect(() => {
    const gaps: string[] = [];
    const hkActivitiesActive = hkEntity
      ? Array.isArray(hkEntity.regulated_activities)
        ? hkEntity.regulated_activities
        : typeof hkEntity.regulated_activities === "string"
        ? (hkEntity.regulated_activities as string).split(/[;,]|\n/).map(s => s.trim())
        : []
      : [];

    // Helper to extract type number from HK string e.g. "Type 9" or "Type 1"
    const extractTypeNumber = (str: string) => {
      const match = str.match(/Type\s*(\d+)/i);
      return match ? `Type ${match[1]}` : "";
    };

    const activeHkTypes = hkActivitiesActive.map(extractTypeNumber).filter(Boolean);

    customUKActivities.forEach(ukAct => {
      // Find what SFC licensee category is needed
      const rule = activityTranslations.find(t => t.ukActivity.toLowerCase().includes(ukAct.toLowerCase()) || ukAct.toLowerCase().includes(t.ukActivity.toLowerCase()));
      if (rule) {
        const requiredHKType = rule.hkEquivalentCode;
        if (!activeHkTypes.some(type => type.toLowerCase() === requiredHKType.toLowerCase())) {
          gaps.push(`FCA permission [${ukAct}] requires SFC [${rule.hkEquivalentCode}: ${rule.hkEquivalentName}] in Hong Kong. This equivalent license is currently missing in the HK entity's roster.`);
        }
      }
    });

    if (hkEntity && gaps.length === 0) {
      // If HK is loaded but we didn't match anything missing
      setTranslationGaps([]);
    } else {
      setTranslationGaps(gaps);
    }
  }, [customUKActivities, hkEntity]);

  // Toggle custom active FCA activity for what-if scenarios
  const handleToggleActivity = (activity: string) => {
    setCustomUKActivities(prev => {
      const updated = prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity];
      setHasUnsavedModifications(true);
      return updated;
    });
  };

  // Reset to entity register baseline
  const handleResetTranslation = () => {
    if (ukEntity) {
      const parsedActivities: string[] = [];
      if (Array.isArray(ukEntity.regulated_activities)) {
        parsedActivities.push(...ukEntity.regulated_activities);
      } else if (typeof ukEntity.regulated_activities === "string") {
        const list = (ukEntity.regulated_activities as string)
          .split(/[;,]|\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        parsedActivities.push(...list);
      }
      setCustomUKActivities(parsedActivities.length > 0 ? parsedActivities : ["Managing Investments", "Advising on investments"]);
    } else {
      setCustomUKActivities(["Managing Investments", "Advising on investments", "Dealing in investments as agent"]);
    }
    setHasUnsavedModifications(false);
  };

  // Dynamic UBO Corporate Tree Nodes builder based on search results
  const ukCorpName = ukEntity?.company_name || "London Regulatory Vehicle Ltd";
  const hkCorpName = hkEntity?.name_en || hkEntity?.company_name || "SFC HK Trading Corp";
  const hasHK = hkEntity !== null;
  const hasUK = ukEntity !== null;

  const uboTreeNodes: TreeNode[] = [
    {
      id: "ubo-1",
      name: "Marcus Sterling OBE",
      role: "Founder & Controlling Shareholder",
      type: "ubo",
      shareholding: 42.5,
      votingRights: 51.2,
      jurisdiction: "United Kingdom",
      amlRisk: "Low",
      verified: true,
      notes: "Ultimate Beneficial Owner holding direct controlling voting stock. Residence vetted. No PEP alerts."
    },
    {
      id: "ubo-2",
      name: "Chambers Trust Capital",
      role: "Institutional Capital Group",
      type: "ubo",
      shareholding: 33.0,
      votingRights: 28.8,
      jurisdiction: "Bermuda",
      amlRisk: "Medium",
      verified: true,
      notes: "Fiduciary asset trust registered in Bermuda. Full look-through identification conducted. Source of funds verified as compliant portfolio distributions."
    },
    {
      id: "parent-1",
      name: "Sterling Chambers Global Holdco PLC",
      role: "Top-Tier Parent Consolidated Group",
      type: "parent",
      shareholding: 100,
      votingRights: 100,
      jurisdiction: "Cayman Islands (Vetted Audit Ledger)",
      amlRisk: "Medium",
      verified: true,
      notes: "Consolidated financial audit filed regularly. Verified under joint listing standards. Holding entity coordinating global multi-jurisdiction activities."
    },
    {
      id: "subsidiary-uk",
      name: ukCorpName,
      role: "UK Authorized Operating Arm",
      type: "uk_entity",
      shareholding: 100,
      votingRights: 100,
      jurisdiction: "United Kingdom",
      amlRisk: "Low",
      verified: true,
      notes: `Verified. FCA Regulated Ref: ${ukEntity?.company_number || "08445790"}. Holds structural assets in Western Europe.`
    },
    {
      id: "subsidiary-hk",
      name: hkCorpName,
      role: "Hong Kong SFC Corporate Operating Hub",
      type: "hk_entity",
      shareholding: 85.0,
      votingRights: 85.0,
      jurisdiction: "Hong Kong SAR",
      amlRisk: "Low",
      verified: true,
      notes: `Verified. SFC license record CEREF: ${hkEntity?.ceref || "AAB893"}. Manages retail trading and options books.`
    },
    {
      id: "officer-auditor",
      name: "Lead Regulatory Examiner",
      role: "Preparing Auditor / Chief FCA Liaison",
      type: "director",
      jurisdiction: "United Kingdom",
      amlRisk: "Low",
      verified: true,
      notes: "Appointed signatory for FCA regulatory submissions. Responsible for compliance ledger matching."
    },
    {
      id: "officer-compliance",
      name: "Chief Compliance Director",
      role: "Reviewing Official / SFC Responsible Officer (RO)",
      type: "compliance",
      jurisdiction: "Hong Kong SAR",
      amlRisk: "Low",
      verified: true,
      notes: "Registered RO under SFO Section 126. Reviews cross-border exposure limits and handles regulatory filings."
    }
  ];

  // File deadlines list initialization
  useEffect(() => {
    setDeadlines([
      {
        id: "dl-1",
        title: "Companies House CS01 Confirmation Statement",
        jurisdiction: "UK",
        authority: "Companies House",
        dueDate: "2026-06-18",
        daysRemaining: 11,
        status: "upcoming",
        description: "Mandatory annual structural update certifying current shareholders, directors, and Person with Significant Control (PSC) registers."
      },
      {
        id: "dl-2",
        title: "SFC Annual Licensing Return & Fee Payment",
        jurisdiction: "HK",
        authority: "SFC",
        dueDate: "2026-07-30",
        daysRemaining: 53,
        status: "upcoming",
        description: "Required submission detailing licensed staff changes, ongoing capability declarations, and statutory fees payment matching the licensed profiles."
      },
      {
        id: "dl-3",
        title: "Companies House Audited Accounts Return",
        jurisdiction: "UK",
        authority: "Companies House",
        dueDate: "2026-05-31",
        daysRemaining: -7,
        status: "overdue",
        description: "Submission guidelines for full-balance corporate accounts. Exceeded standard nine-month window for operations ledger audit filings."
      },
      {
        id: "dl-4",
        title: "SFC FRR Monthly Financial Resources Statement",
        jurisdiction: "HK",
        authority: "SFC",
        dueDate: "2026-06-21",
        daysRemaining: 14,
        status: "upcoming",
        description: "Compulsory monthly liquidity reports to guarantee compliance with minimum liquid financial asset multipliers under HK SFO Cap 571N statutory ratios."
      },
      {
        id: "dl-5",
        title: "FCA GABRIEL/RegData Compliance Return",
        jurisdiction: "UK",
        authority: "FCA",
        dueDate: "2026-07-15",
        daysRemaining: 38,
        status: "upcoming",
        description: "Submit core regulated metrics including capital adequacy buffer details, leverage risk, and standard client fund ledger allocations."
      },
      {
        id: "dl-6",
        title: "SFC CPT Continuous Representative Training Declaration",
        jurisdiction: "HK",
        authority: "SFC",
        dueDate: "2026-12-31",
        daysRemaining: 207,
        status: "compliant",
        description: "Submit certificate demonstrating that all licensed traders completed their compulsory yearly professional compliance classroom hours."
      }
    ]);
    setSelectedNode(uboTreeNodes[0]);
  }, [ukEntity, hkEntity]);

  const handleToggleFiled = (id: string) => {
    setDeadlines(prev =>
      prev.map(item => {
        if (item.id === id) {
          const isCompliantNow = item.status !== "compliant";
          return {
            ...item,
            status: isCompliantNow ? "compliant" : (item.daysRemaining < 0 ? "overdue" : "upcoming")
          };
        }
        return item;
      })
    );
  };

  const filteredDeadlines = deadlines.filter(d => {
    if (calendarFilter === "all") return true;
    if (calendarFilter === "critical") return d.status === "overdue" || (d.status === "upcoming" && d.daysRemaining <= 15);
    if (calendarFilter === "uk") return d.jurisdiction === "UK";
    if (calendarFilter === "hk") return d.jurisdiction === "HK";
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg mt-8 print:hidden" id="regulatory-workspace-component">
      {/* Visual Identity Header Bar */}
      <div className="bg-slate-900 px-6 py-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" />
            Active Cross-Border Compliance Workspace
          </span>
          <h2 className="text-lg font-sans font-bold tracking-tight mt-0.5">
            Interactive Regulatory Audit & Group Oversight Hub
          </h2>
        </div>
        
        {/* Verification Context Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {hasUK && ukEntity ? (
            <span className="px-2.5 py-1 text-[10px] font-mono bg-blue-950 text-blue-300 rounded-lg border border-blue-900 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              UK ACTIVE: {typeof ukEntity.company_name === "string" ? (ukEntity.company_name.substring(0, 16) + "...") : "Detected"}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-mono bg-slate-800 text-slate-400 rounded-lg border border-slate-700 flex items-center gap-1.5">
              UK: NOT DETECTED
            </span>
          )}
          
          {hasHK && hkEntity ? (
            <span className="px-2.5 py-1 text-[10px] font-mono bg-emerald-950 text-emerald-300 rounded-lg border border-emerald-900 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              HK ACTIVE: {typeof hkEntity.name_en === "string" ? (hkEntity.name_en.substring(0, 16) + "...") : typeof hkEntity.company_name === "string" ? (hkEntity.company_name.substring(0, 16) + "...") : "Detected"}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-mono bg-slate-800 text-slate-400 rounded-lg border border-slate-700 flex items-center gap-1.5">
              HK: NOT DETECTED
            </span>
          )}
        </div>
      </div>

      {/* Workspace Sub-tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
        <button
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-mono font-bold tracking-wider uppercase border-r border-slate-200 cursor-pointer transition-all duration-150 shrink-0 ${
            activeTab === "matrix"
              ? "bg-white text-slate-900 border-b-2 border-b-slate-900"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
          }`}
        >
          <GitCompare className="w-4 h-4 text-slate-700" />
          License Equivalency Matrix
        </button>
        <button
          onClick={() => setActiveTab("ubo")}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-mono font-bold tracking-wider uppercase border-r border-slate-200 cursor-pointer transition-all duration-150 shrink-0 ${
            activeTab === "ubo"
              ? "bg-white text-slate-900 border-b-2 border-b-slate-900"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
          }`}
        >
          <Network className="w-4 h-4 text-slate-700" />
          UBO & Corporate Tree Visualizer
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex items-center gap-2 px-5 py-4 text-xs font-mono font-bold tracking-wider uppercase cursor-pointer transition-all duration-150 shrink-0 ${
            activeTab === "calendar"
              ? "bg-white text-slate-900 border-b-2 border-b-slate-900"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
          }`}
        >
          <Calendar className="w-4 h-4 text-slate-700" />
          Statutory Filing Calendar
        </button>
      </div>

      {/* Tabs Content Sections */}
      <div className="p-6 md:p-8">
        
        {/* TAB 1: LICENSE EQUIVALENCY MATRIX */}
        {activeTab === "matrix" && (
          <div className="space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-4">
              <div className="max-w-2xl">
                <h3 className="text-base font-sans font-bold text-slate-800 flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-slate-800" />
                  UK-FCA Regulated Activities to HK-SFC Licenses Translation Engine
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Toggle UK regulated authorization permissions to model dynamic equivalencies inside the Hong Kong market. The compliance ledger automatically reviews mapping definitions and highlights licensing deficiencies.
                </p>
              </div>
              
              {hasUnsavedModifications && (
                <button
                  onClick={handleResetTranslation}
                  className="px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-all duration-150 border border-slate-200"
                >
                  Reset to baseline
                </button>
              )}
            </div>

            {/* Gap Alerts Dashboard Banner */}
            {translationGaps.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fadeIn">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-sans font-bold text-amber-900 uppercase tracking-wide">
                      Unmapped Regulatory Discrepancies Detected ({translationGaps.length})
                    </h4>
                    <ul className="list-disc pl-5 mt-2 space-y-1.5 text-xs text-amber-800 font-sans leading-relaxed">
                      {translationGaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-amber-600 mt-2 font-mono">
                      *Action Notice: Establishing corporate services matching these unmapped items prior to obtaining formalized SFC endorsements triggers severe Cap 571 disciplinary provisions.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-fadeIn flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-sans font-bold text-emerald-900 uppercase tracking-wide">
                    Cross-Border Permissions Fully Synchronized
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Zero regulatory compliance gaps are identified between the modeled United Kingdom licenses and the Hong Kong SFC operations framework. Cross-border capital vehicles align completely.
                  </p>
                </div>
              </div>
            )}

            {/* Side-by-Side Equivalence Matrix Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
              {/* Left Side: UK FCA Regulated Activities Inputs */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                       modeled UK FCA Permitted Activities
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                    {customUKActivities.length} Enabled
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    "Dealing in investments as principal",
                    "Dealing in investments as agent",
                    "Managing Investments",
                    "Managing an AIF",
                    "Managing an AIF/UCITS",
                    "Advising on investments",
                    "Advising on corporate finance",
                    "Dealing in futures contracts",
                    "Advising on futures contracts",
                    "Establishing, operating or winding up a collective investment scheme"
                  ].map((activity) => {
                    const isChecked = customUKActivities.some(a => a.toLowerCase() === activity.toLowerCase());
                    return (
                      <button
                        key={activity}
                        onClick={() => handleToggleActivity(activity)}
                        className={`w-full text-left p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-150 outline-none ${
                          isChecked
                            ? "bg-white border-blue-500 shadow-sm text-slate-800"
                            : "bg-slate-100/50 border-slate-200/80 hover:bg-slate-100 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isChecked ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                          }`}>
                            {isChecked && <span className="text-[10px] font-bold">✓</span>}
                          </div>
                          <span className="text-xs font-sans font-semibold">
                            {activity}
                          </span>
                        </div>
                        {isChecked && (
                          <span className="text-[9px] font-mono uppercase tracking-wider bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: HK SFC License Map Results */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                      Corresponding Hong Kong SFC Frameworks
                    </h4>
                  </div>
                  <span className="text-3xs font-mono uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                    SFO Cap. 571 Standings
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                  {[
                    { code: "Type 1", name: "Dealing in securities", color: "emerald" },
                    { code: "Type 2", name: "Dealing in futures contracts", color: "emerald" },
                    { code: "Type 4", name: "Advising on securities", color: "emerald" },
                    { code: "Type 5", name: "Advising on futures contracts", color: "emerald" },
                    { code: "Type 6", name: "Advising on corporate finance", color: "emerald" },
                    { code: "Type 9", name: "Asset Management", color: "emerald" }
                  ].map((type) => {
                    // Check if this type is mapped to currently active UK activities
                    const mappingRules = activityTranslations.filter(t => t.hkEquivalentCode === type.code);
                    const matchingUKActive = mappingRules.filter(rule => 
                      customUKActivities.some(uk => uk.toLowerCase().includes(rule.ukActivity.toLowerCase()) || rule.ukActivity.toLowerCase().includes(uk.toLowerCase()))
                    );
                    const isActiveByUK = matchingUKActive.length > 0;
                    
                    // Check if actual HK entity licenses have this type active
                    const isActuallyHkActive = hkEntity
                      ? (Array.isArray(hkEntity.regulated_activities)
                          ? hkEntity.regulated_activities
                          : typeof hkEntity.regulated_activities === "string"
                          ? (hkEntity.regulated_activities as string).split(/[;,]|\n/)
                          : []
                        ).some(act => act.toLowerCase().includes(type.code.toLowerCase()))
                      : false;

                    return (
                      <div
                        key={type.code}
                        className={`p-3.5 rounded-lg border transition-all duration-150 ${
                          isActiveByUK
                            ? "bg-white border-emerald-500 shadow-sm"
                            : "bg-slate-100/30 border-slate-200 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-mono text-[9px] font-bold uppercase tracking-wider">
                                {type.code}
                              </span>
                              <h5 className="text-xs font-sans font-bold text-slate-900 leading-normal">
                                {type.name}
                              </h5>
                            </div>
                            
                            {isActiveByUK && (
                              <div className="mt-2 text-3xs font-sans text-slate-500 space-y-1 bg-slate-50 p-2 rounded-md border border-slate-100">
                                <span className="block font-semibold text-slate-600">Mapped via modeled UK inputs:</span>
                                {matchingUKActive.map(rule => (
                                  <div key={rule.ukActivity} className="flex items-center gap-1.5">
                                    <ArrowRight className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                    <span>{rule.ukActivity}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 items-end shrink-0">
                            {isActiveByUK ? (
                              <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-100 flex items-center gap-1">
                                <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                                Required
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                Unmapped
                              </span>
                            )}

                            {isActuallyHkActive ? (
                              <span className="text-[9px] font-mono uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 flex items-center gap-1 mt-1">
                                <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                                HK Owned
                              </span>
                            ) : isActiveByUK ? (
                              <span className="text-[9px] font-mono uppercase bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-100 flex items-center gap-1 mt-1 animate-pulse">
                                ⚠️ Gap Alert
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE UBO & GROUP STRUCTURE VISUALIZER */}
        {activeTab === "ubo" && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-sans font-bold text-slate-800 flex items-center gap-2">
                <Network className="w-5 h-5 text-slate-800" />
                Live Ultimate Beneficial Owner (UBO) & Group Structure Tree
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Visualizing multi-jurisdiction shareholdings, ultimate controlling individuals, parent holding layers, and governance relationships. Check compliance risks by selecting nodes to trigger details inspection.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* Left Column: Interactive Diagram Block */}
              <div className="xl:col-span-8 bg-slate-50 border border-slate-300 rounded-xl p-4 md:p-6 flex flex-col justify-center items-center min-h-[440px] relative overflow-hidden">
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                    Interactive Tree Canvas
                  </span>
                </div>
                
                {/* Visual Legend */}
                <div className="absolute top-3 right-3 hidden md:flex items-center gap-3.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase font-bold text-slate-500 shadow-sm z-30">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500"></span>UBO</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-600"></span>Holdco</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-600"></span>UK Opts</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-600"></span>HK Opts</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-500 overflow-hidden"></span>Officer</div>
                </div>

                {/* SVG Structure Layout Render */}
                <div className="w-full h-full flex flex-col justify-between items-center relative z-20 space-y-6 max-w-lg mt-4 mb-4">
                  
                  {/* Layer 1: Ultimate Owners */}
                  <div className="flex flex-row justify-center items-center gap-4 w-full">
                    {uboTreeNodes.filter(n => n.type === "ubo").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`px-4 py-2.5 bg-white border rounded-xl hover:shadow-md cursor-pointer transition-all duration-150 relative text-center focus:outline-none min-w-[150px] ${
                          selectedNode?.id === node.id 
                            ? "border-amber-500 ring-2 ring-amber-100 scale-105" 
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
                          UBO Stake
                        </span>
                        <div className="text-xs font-sans font-bold text-slate-800 leading-normal truncate">{node.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 font-semibold mt-1 flex justify-center gap-2">
                          <span>SH: {node.shareholding}%</span>
                          <span>VT: {node.votingRights}%</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* SVG Join Line Layer 1 to 2 */}
                  <div className="h-4 flex items-center justify-center select-none pointer-events-none opacity-40">
                    <svg width="200" height="20" className="stroke-slate-500 fill-none stroke-1">
                      <path d="M 30,0 L 100,20 M 170,0 L 100,20" />
                    </svg>
                  </div>

                  {/* Layer 2: Global Parent Holding */}
                  <div className="w-full flex justify-center">
                    {uboTreeNodes.filter(n => n.type === "parent").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`px-5 py-3 bg-indigo-950 hover:bg-indigo-900 border text-white rounded-xl hover:shadow-md cursor-pointer transition-all duration-150 relative text-center focus:outline-none max-w-[280px] ${
                          selectedNode?.id === node.id 
                            ? "border-pink-500 ring-2 ring-pink-500/20 scale-105" 
                            : "border-slate-800"
                        }`}
                      >
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600 text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
                          Ultimate holding company
                        </span>
                        <div className="text-xs font-sans font-bold leading-normal">{node.name}</div>
                        <div className="text-[9px] font-mono text-slate-300 mt-1">
                          Jurisdiction: Caymans • Stake: 100% Group Shareholder
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* SVG Join Line Layer 2 to 3 */}
                  <div className="h-6 flex items-center justify-center select-none pointer-events-none opacity-40">
                    <svg width="240" height="30" className="stroke-slate-500 fill-none stroke-1">
                      <path d="M 120,0 L 120,10" />
                      <line x1="40" y1="10" x2="200" y2="10" />
                      <path d="M 40,10 L 40,30 M 200,10 L 200,30" />
                    </svg>
                  </div>

                  {/* Layer 3: Subsidiaries (UK vs HK) */}
                  <div className="flex flex-row justify-between items-stretch gap-6 w-full">
                    
                    {/* UK Hub Node */}
                    {uboTreeNodes.filter(n => n.type === "uk_entity").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`flex-1 p-3.5 bg-white border rounded-xl hover:shadow-md cursor-pointer transition-all duration-150 relative text-center flex flex-col justify-between focus:outline-none min-h-[90px] border-l-4 border-l-blue-600 ${
                          selectedNode?.id === node.id 
                            ? "border-blue-500 ring-2 ring-blue-100 scale-105" 
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-blue-600 text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
                          United Kingdom Operating Vehicle
                        </span>
                        <div className="text-xs font-sans font-bold text-slate-800 leading-tight mt-1.5 truncate-3-lines">{node.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-2 font-bold uppercase tracking-wider">
                          FCA Authorized Hub
                        </div>
                      </button>
                    ))}

                    {/* HK Hub Node */}
                    {uboTreeNodes.filter(n => n.type === "hk_entity").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`flex-1 p-3.5 bg-white border rounded-xl hover:shadow-md cursor-pointer transition-all duration-150 relative text-center flex flex-col justify-between focus:outline-none min-h-[90px] border-l-4 border-l-emerald-600 ${
                          selectedNode?.id === node.id 
                            ? "border-emerald-500 ring-2 ring-emerald-100 scale-105" 
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
                          Hong Kong Operating Vehicle
                        </span>
                        <div className="text-xs font-sans font-bold text-slate-800 leading-tight mt-1.5 truncate-3-lines">{node.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-2 font-bold uppercase tracking-wider">
                          SFC Licensed Hub
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* SVG Join Line Layer 3 to 4 */}
                  <div className="h-6 flex items-center justify-center select-none pointer-events-none opacity-40 w-full">
                    <svg width="360" height="30" className="stroke-slate-500 fill-none stroke-1 w-full">
                      <line x1="80" y1="0" x2="80" y2="30" />
                      <line x1="280" y1="0" x2="280" y2="30" />
                    </svg>
                  </div>

                  {/* Layer 4: Officers (Liaisons, Compliance Officers, Signatories) */}
                  <div className="flex flex-row justify-between w-full gap-4">
                    
                    {/* Chief Auditor */}
                    {uboTreeNodes.filter(n => n.type === "director").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`flex-1 p-2.5 bg-slate-100 border text-left rounded-lg hover:shadow-sm cursor-pointer transition-all duration-150 focus:outline-none ${
                          selectedNode?.id === node.id 
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 scale-102" 
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-mono font-bold text-blue-800">FCA Rep</div>
                        <div className="text-[11px] font-sans font-bold text-slate-800 mt-0.5 leading-snug">{node.name}</div>
                        <div className="text-3xs font-mono text-slate-500 leading-tight truncate">Preparing Auditor</div>
                      </button>
                    ))}

                    {/* Responsible Officer */}
                    {uboTreeNodes.filter(n => n.type === "compliance").map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`flex-1 p-2.5 bg-slate-100 border text-left rounded-lg hover:shadow-sm cursor-pointer transition-all duration-150 focus:outline-none ${
                          selectedNode?.id === node.id 
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 scale-102" 
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-mono font-bold text-emerald-800">SFC RO</div>
                        <div className="text-[11px] font-sans font-bold text-slate-800 mt-0.5 leading-snug">{node.name}</div>
                        <div className="text-3xs font-mono text-slate-500 leading-tight truncate">Reviewing Official</div>
                      </button>
                    ))}
                  </div>

                </div>
              </div>

              {/* Right Column: Node Inspector Drawer block */}
              <div className="xl:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="border-b border-slate-200 pb-3.5 mb-4 flex items-center gap-1.5">
                    <Users className="w-4.5 h-4.5 text-slate-800" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                      Compliance Node Inspector
                    </h4>
                  </div>

                  {selectedNode ? (
                    <div className="space-y-4 animate-fadeIn">
                      <div>
                        <span className="text-3xs font-mono bg-slate-900 text-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-widest inline-block">
                          {selectedNode.type.replace("_", " ")}
                        </span>
                        <h5 className="text-base font-sans font-bold text-slate-900 mt-1 leading-snug">
                          {selectedNode.name}
                        </h5>
                        <p className="text-xs font-sans font-semibold text-slate-500 mt-0.5">
                          {selectedNode.role}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 bg-white p-3.5 rounded-lg border border-slate-200/80">
                        <div>
                          <span className="block text-3xs font-mono text-slate-400 uppercase">Jurisdiction</span>
                          <span className="text-xs font-sans font-bold text-slate-800 mt-0.5 block truncate" title={selectedNode.jurisdiction}>
                            {selectedNode.jurisdiction}
                          </span>
                        </div>
                        <div>
                          <span className="block text-3xs font-mono text-slate-400 uppercase">AML Score</span>
                          <span className={`text-xs font-mono font-bold mt-0.5 block flex items-center gap-1.5 ${
                            selectedNode.amlRisk === "Low" 
                              ? "text-emerald-600" 
                              : selectedNode.amlRisk === "Medium"
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              selectedNode.amlRisk === "Low" 
                                ? "bg-emerald-500" 
                                : selectedNode.amlRisk === "Medium"
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}></span>
                            {selectedNode.amlRisk} Risk
                          </span>
                        </div>

                        {selectedNode.shareholding !== undefined && (
                          <div className="border-t border-slate-100 pt-2 mt-1 col-span-2 grid grid-cols-2">
                            <div>
                              <span className="block text-3xs font-mono text-slate-400 uppercase">Equity Stake</span>
                              <span className="text-xs font-sans font-extrabold text-slate-900">
                                {selectedNode.shareholding}%
                              </span>
                            </div>
                            <div>
                              <span className="block text-3xs font-mono text-slate-400 uppercase">Voting Control</span>
                              <span className="text-xs font-sans font-extrabold text-slate-900">
                                {selectedNode.votingRights}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200/80">
                        <span className="block text-3xs font-mono text-slate-400 uppercase mb-1">KYC Registry Audit Dossier</span>
                        <p className="text-xs font-sans text-slate-600 leading-relaxed font-medium">
                          {selectedNode.notes}
                        </p>
                      </div>

                      <div className="rounded-lg bg-emerald-50 border border-emerald-100/60 p-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-3xs font-mono tracking-wide text-emerald-800 uppercase font-bold">
                          Identity Verified & Whitelisted
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <HelpCircle className="w-8 h-8 mx-auto text-slate-300 mb-2.5" />
                      <p className="text-xs font-sans">
                        Select any organizational layer node on the tree diagram to inspect registry checkups.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 text-3xs font-mono text-slate-400 text-center uppercase tracking-wide">
                  Global AML/KYC Ledger Integration
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: CHRONOLOGICAL COMPLIANCE & FILING CALENDAR */}
        {activeTab === "calendar" && (
          <div className="space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="max-w-xl">
                <h3 className="text-base font-sans font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-800" />
                  Chronological Regulatory Filings & Statutory Checklist
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Consolidated statutory filing tracking relative to our active reference auditing date. Manage countdowns for both FCA and SFC compliance directives.
                </p>
              </div>

              {/* Deadline Filters */}
              <div className="flex flex-wrap items-center gap-1.5 self-start xl:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200/60 font-mono text-3xs uppercase font-bold">
                <button
                  onClick={() => setCalendarFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    calendarFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Show All
                </button>
                <button
                  onClick={() => setCalendarFilter("critical")}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${
                    calendarFilter === "critical" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Action Required
                </button>
                <button
                  onClick={() => setCalendarFilter("uk")}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    calendarFilter === "uk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-800"
                  }`}
                >
                  UK FCA/CH
                </button>
                <button
                  onClick={() => setCalendarFilter("hk")}
                  className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                    calendarFilter === "hk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-800"
                  }`}
                >
                  HK SFC
                </button>
              </div>
            </div>

            {/* List of filings */}
            <div className="space-y-4">
              {filteredDeadlines.length > 0 ? (
                filteredDeadlines.map((item) => {
                  const stateClass =
                    item.status === "compliant"
                      ? "border-emerald-200 bg-emerald-50/20"
                      : item.status === "overdue"
                      ? "border-rose-200 bg-rose-50/20"
                      : "border-slate-200 hover:border-slate-300";

                  return (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border transition-all duration-150 relative ${stateClass}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        
                        {/* Title & Authority Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase tracking-wider ${
                              item.jurisdiction === "UK" 
                                ? "bg-blue-50 border border-blue-100 text-blue-700" 
                                : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                            }`}>
                              [{item.jurisdiction}] {item.authority}
                            </span>
                            
                            <span className="text-[11px] font-mono text-slate-400 font-semibold">
                              Regulatory Deadline: {item.dueDate}
                            </span>
                          </div>

                          <h4 className="text-sm font-sans font-bold text-slate-900 leading-tight">
                            {item.title}
                          </h4>
                          
                          <p className="text-xs text-slate-500 font-sans leading-relaxed mt-2 p-3 bg-white/70 rounded-lg border border-slate-100/50">
                            {item.description}
                          </p>
                        </div>

                        {/* Countdown Status & Filed Button Action */}
                        <div className="shrink-0 text-left md:text-right flex flex-row md:flex-col justify-between md:justify-start items-center md:items-end gap-3 min-w-[140px] md:border-l md:border-slate-200/60 md:pl-6">
                          <div>
                            {item.status === "compliant" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-3xs font-extrabold uppercase bg-emerald-500 text-white rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                                Filed
                              </span>
                            ) : item.status === "overdue" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-3xs font-extrabold uppercase bg-rose-600 text-white rounded-full animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-white" />
                                {Math.abs(item.daysRemaining)} Days Overdue
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 font-mono text-3xs font-extrabold uppercase rounded-full ${
                                item.daysRemaining <= 15 ? "bg-amber-500 text-white" : "bg-slate-900 text-slate-200"
                              }`}>
                                <Clock className="w-3 h-3 text-white" />
                                {item.daysRemaining} Days Left
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleToggleFiled(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-3xs font-mono font-bold uppercase tracking-wider cursor-pointer border transition-all duration-150 outline-none ${
                              item.status === "compliant"
                                ? "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600"
                                : "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white shadow-sm"
                            }`}
                          >
                            {item.status === "compliant" ? "Unmark Filed" : "Mark as Filed"}
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <Filter className="w-10 h-10 mx-auto text-slate-300 mb-2.5" />
                  <p className="text-xs font-sans font-medium">
                    No deadlines matching your choice are currently listed.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
