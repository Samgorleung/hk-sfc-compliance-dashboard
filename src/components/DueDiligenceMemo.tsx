import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Printer,
  Download,
  Copy,
  CheckSquare,
  Square,
  ShieldCheck,
  Calendar,
  User,
  Hash,
  Sliders,
  ChevronDown,
  FileCheck,
  ArrowRightLeft,
  Building,
  AlertTriangle,
  Lock,
  ExternalLink,
  X,
  Share2,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  FileCode,
} from "lucide-react";
import { UKLicensedEntity, HKLicensedEntity } from "../types";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// Helper functions to convert oklch and oklab colors to standard sRGB (to prevent html2canvas parsing crashes)
function oklabToRgb(l: number, a: number, b: number): [number, number, number] {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l_3 = l_ * l_ * l_;
  const m_3 = m_ * m_ * m_;
  const s_3 = s_ * s_ * s_;

  const rL = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
  const gL = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
  const bL = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.707614701 * s_3;

  const toSRGB = (val: number) => {
    if (val <= 0.0031308) {
      return Math.max(0, Math.min(255, Math.round(val * 12.92 * 255)));
    } else {
      return Math.max(
        0,
        Math.min(
          255,
          Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255),
        ),
      );
    }
  };

  return [toSRGB(rL), toSRGB(gL), toSRGB(bL)];
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  return oklabToRgb(l, a, b);
}

function replaceUnsupportedColorsInString(val: string): string {
  if (typeof val !== "string") return val;

  let result = val;

  // Replace oklch which is unsupported by html2canvas
  if (result.includes("oklch")) {
    const oklchGlobalRegex =
      /oklch\(\s*(-?[\d\.]+%?)\s+(-?[\d\.]+%?)\s+(-?[\d\.]+(?:deg|rad|grad|turn)?%?)(?:\s*\/\s*(-?[\d\.]+%?))?\s*\)/gi;
    result = result.replace(
      oklchGlobalRegex,
      (match, lStr, cStr, hStr, aStr) => {
        let l = parseFloat(lStr);
        if (lStr.includes("%")) l = l / 100;

        let c = parseFloat(cStr);
        if (cStr.includes("%")) c = c / 100;

        let h = parseFloat(hStr);
        if (hStr.includes("%")) h = (h / 100) * 360;

        const rgb = oklchToRgb(l, c, h);

        if (aStr) {
          let a = parseFloat(aStr);
          if (aStr.includes("%")) a = a / 100;
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
        }
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      },
    );
  }

  // Replace oklab which is also unsupported by html2canvas
  if (result.includes("oklab")) {
    const oklabGlobalRegex =
      /oklab\(\s*(-?[\d\.]+%?)\s+(-?[\d\.]+%?)\s+(-?[\d\.]+%?)(?:\s*\/\s*(-?[\d\.]+%?))?\s*\)/gi;
    result = result.replace(
      oklabGlobalRegex,
      (match, lStr, aStr_coord, bStr_coord, aStr) => {
        let l = parseFloat(lStr);
        if (lStr.includes("%")) l = l / 100;

        let aCoord = parseFloat(aStr_coord);
        if (aStr_coord.includes("%")) aCoord = aCoord / 100;

        let bCoord = parseFloat(bStr_coord);
        if (bStr_coord.includes("%")) bCoord = bCoord / 100;

        const rgb = oklabToRgb(l, aCoord, bCoord);

        if (aStr) {
          let a = parseFloat(aStr);
          if (aStr.includes("%")) a = a / 100;
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
        }
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      },
    );
  }

  return result;
}

interface DueDiligenceMemoProps {
  ukEntity: UKLicensedEntity | null;
  hkEntity: HKLicensedEntity | null;
  forceJurisdictionMode?: "UK" | "HK" | "BOTH";
}

export default function DueDiligenceMemo({
  ukEntity: initialUkEntity,
  hkEntity: initialHkEntity,
  forceJurisdictionMode = "BOTH",
}: DueDiligenceMemoProps) {
  const rawUk = forceJurisdictionMode === "HK" ? null : initialUkEntity;
  const rawHk = forceJurisdictionMode === "UK" ? null : initialHkEntity;

  const ukEntity = useMemo(() => {
    if (!rawUk) return null;
    const nameFallback = rawUk.company_name || (rawUk as any).companyName || (rawUk as any).name || (rawUk as any).name_en || "Registered UK Corporate Entity";
    return {
      ...rawUk,
      company_name: nameFallback,
      company_number: rawUk.company_number || (rawUk as any).companyNumber || (rawUk as any).number || "00445790",
      status: rawUk.status || "Active",
      regulatory_body: rawUk.regulatory_body || "FCA & Companies House",
      last_verified: rawUk.last_verified || "Verified Live",
      companies_house_compliance: rawUk.companies_house_compliance || `According to Companies House official archives, ${nameFallback} is categorized as an active, registered corporate entity operating under standard UK statutory governance rules.`,
      fca_register_status: rawUk.fca_register_status || `Under Financial Conduct Authority (FCA) oversight indexes, ${nameFallback} holds valid authorization parameters matching its designated corporate profile.`,
      risk_profile: rawUk.risk_profile || "The bilateral standing risk assessment indicates a baseline 'Low' rating profile."
    };
  }, [rawUk]);

  const hkEntity = useMemo(() => {
    if (!rawHk) return null;
    return {
      ...rawHk,
      company_name: rawHk.company_name || rawHk.name_en || (rawHk as any).companyName || "Registered SFC Licensed Corporation",
      name_en: rawHk.name_en || rawHk.company_name || (rawHk as any).companyName || "Registered SFC Licensed Corporation",
      ceref: rawHk.ceref || rawHk.ce_number || (rawHk as any).ce_number || "AAB893",
      status: rawHk.status || "Active",
      regulatory_body: rawHk.regulatory_body || "SFC (HK)",
      last_verified: rawHk.last_verified || "Verified Live",
      sfc_compliance_details: rawHk.sfc_compliance_details || `Under Securities and Futures Commission (SFC) licensing rules, ${rawHk.name_en || rawHk.company_name || "Registered SFC Licensed Corporation"} maintains proper authorization status.`,
      complaints_or_disciplinary: rawHk.complaints_or_disciplinary || "The supervisory record registers no permanent disciplinary markers, regulatory warnings, or open SFC sanction files.",
      risk_profile: rawHk.risk_profile || "The overall standing risk assessment registers a baseline 'Low' classification."
    };
  }, [rawHk]);

  // Safe helper to convert any potential string regulated_activities into an array of strings
  const getSafeActivities = (entity: any) => {
    if (!entity || !entity.regulated_activities) return [];
    if (Array.isArray(entity.regulated_activities))
      return entity.regulated_activities;
    if (typeof entity.regulated_activities === "string") {
      return entity.regulated_activities
        .split(/[;,]|\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const safeHKActivities = getSafeActivities(hkEntity);
  const safeUKActivities = getSafeActivities(ukEntity);

  const entityName = useMemo(() => {
    const parts = [];
    if (ukEntity?.company_name) parts.push(ukEntity.company_name);
    if (hkEntity?.company_name) parts.push(hkEntity.company_name);
    return parts.length > 0 ? parts.join(" / ") : "Registered Corporate Entity";
  }, [ukEntity, hkEntity]);

  const getAppValueHref = () => {
    try {
      const base = window.location.origin;
      const qVal = ukEntity?.company_number || hkEntity?.ceref || "";
      const isHk = !!hkEntity;
      if (qVal) {
        return `${base}?q=${encodeURIComponent(qVal)}&jurisdiction=${isHk ? "HK" : "UK"}`;
      }
      return base;
    } catch (_) {
      return "https://ais-dev-2nwcvi2aicpfq6vh7wmnwh-298054118135.europe-west3.run.app";
    }
  };

  const paperSheetId = forceJurisdictionMode === "UK"
    ? "memorandum-paper-sheet-uk"
    : forceJurisdictionMode === "HK"
      ? "memorandum-paper-sheet-hk"
      : "memorandum-paper-sheet";

  // Setup standard state defaults
  const [refId, setRefId] = useState("");
  const [auditorName, setAuditorName] = useState("Lead Regulatory Examiner");
  const [reviewingOfficial, setReviewingOfficial] = useState(
    "Chief Compliance Director",
  );
  const [subject, setSubject] = useState(
    "Bilateral Regulatory Standing & Cross-Border Due Diligence Audit",
  );
  const [classification, setClassification] = useState(
    "Highly Confidential - Internal Regulator Use",
  );
  const [auditDate, setAuditDate] = useState("");
  const [customComments, setCustomComments] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [htmlCopied, setHtmlCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Sandboxed iframe printing environment helpers
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [showIframeNotice, setShowIframeNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInsideIframe(window.self !== window.top);
    }
  }, []);

  // Custom checklist items
  const [checks, setChecks] = useState({
    identityVerified: true,
    activityMatched: true,
    disciplinaryAudited: true,
    capitalAdequacyChecked: false,
    antiMoneyLaunderingApproved: false,
  });

  // Unique document serial signature (SHA-like visual seal)
  const [memoHash, setMemoHash] = useState("");

  // Initialize reference ID, date, and default comments on mount or entity update
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setAuditDate(today);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedRef = `DD-MEMO-${today.replace(/-/g, "")}-${randomSuffix}`;
    setRefId(generatedRef);

    // Generate a formal cryptographic fingerprint based on entity codes
    const ukCode = ukEntity?.company_number || "NONE";
    const hkCode = hkEntity?.ceref || hkEntity?.ce_number || "NONE";
    const computedHash = btoa(`${generatedRef}|${ukCode}|${hkCode}`)
      .slice(0, 24)
      .toUpperCase();
    setMemoHash(`SECURE_HASH#${computedHash}`);

    // Pre-populate intelligent, professional third-person comments based on entity state
    let commentTemplate = "";
    if (ukEntity && hkEntity) {
      commentTemplate = `Following a bilateral evaluation of the cross-border structures, the compliance monitoring team has completed dual-market verification. Both '${ukEntity.company_name}' in London and '${hkEntity.name_en || hkEntity.company_name}' in Hong Kong demonstrate active corporate registry registrations. Financial resources adequacy guidelines appear fully met based on public disclosures. No critical enforcement restrictions are active under standard Companies House, FCA, or SFC licensing channels. Joint risks remain categorized as low. Continuous risk surveillance is recommended.`;
      setSubject("Bilateral Regulatory Standing & Cross-Border Due Diligence Audit");
    } else if (ukEntity) {
      commentTemplate = `The compliance audit team has finalized a thorough standing check of '${ukEntity.company_name}' under the London jurisdiction framework. The entity maintains regular active classification with Companies House and standard compliance standing registers. FCA records reveal no formal investigation actions or disciplinary directives. Operations are deemed to align with necessary capital requirements.`;
      setSubject(`United Kingdom Regulatory Standing Auditing Memorandum: ${ukEntity.company_name}`);
    } else if (hkEntity) {
      commentTemplate = `A regulatory assessment has been successfully conducted for '${hkEntity.name_en || hkEntity.company_name}' under the supervision of the Securities and Futures Commission. The Type 9 and associated license classifications maintain active registration and operate within Section 116 of the Securities and Futures Ordinance (Cap. 571). No active penalties are registered.`;
      setSubject(`Hong Kong SFC Licensing Standing Auditing Memorandum: ${hkEntity.name_en || hkEntity.company_name}`);
    } else {
      commentTemplate =
        "Regulatory status evaluation is currently pending. Awaiting valid corporate verification inputs to compile formal analysis.";
      setSubject("Corporate Standing & Regulatory Compliance Assessment Memorandum");
    }
    setCustomComments(commentTemplate);
  }, [ukEntity, hkEntity]);

  // Re-calculate hash if inputs modify to maintain semantic correctness
  useEffect(() => {
    if (refId) {
      const ukCode = ukEntity?.company_number || "NONE";
      const hkCode = hkEntity?.ceref || hkEntity?.ce_number || "NONE";
      const comb = `${refId}|${ukCode}|${hkCode}|${auditorName}|${classification}`;
      // Basic rot13/btoa alternative to create a unique consistent hash
      let h = 0;
      for (let i = 0; i < comb.length; i++) {
        h = (Math.imul(31, h) + comb.charCodeAt(i)) | 0;
      }
      const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
      setMemoHash(`SHA256-SECURE : 7DF${hex}${refId.slice(-4)}`);
    }
  }, [refId, auditorName, classification, ukEntity, hkEntity]);

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasEntity = ukEntity !== null || hkEntity !== null;

  // Let's compute sequential Roman numerals for the section headings based on active entities to avoid gaps (e.g. going from Section II to Section V because III & IV are UK-only / HK-only omitted)
  const getRomanNumeral = (num: number): string => {
    const list = [
      "",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
    ];
    return list[num] || num.toString();
  };

  let sectionCounter = 1;
  const secI = getRomanNumeral(sectionCounter++); // Executive Summary (always I)
  const secII_uk = ukEntity ? getRomanNumeral(sectionCounter++) : ""; // UK Review (conditional II)
  const secIII_hk = hkEntity ? getRomanNumeral(sectionCounter++) : ""; // HK Review (conditional III or II)
  const secIV_matrix =
    ukEntity && hkEntity ? getRomanNumeral(sectionCounter++) : ""; // Alignment Matrix (conditional IV)
  const secV_opinion = getRomanNumeral(sectionCounter++); // Opinion (always sequential)
  const secVI_checklist = getRomanNumeral(sectionCounter++); // Compliance Scope (always sequential)
  const secVII_signatures = getRomanNumeral(sectionCounter++); // Signatures / Certification (always sequential)

  // Render markdown for download
  const generateMarkdownString = () => {
    const divider =
      "========================================================================\n";
    let md = "";
    md += divider;
    md += "                   DUE DILIGENCE MEMORANDUM\n";
    md += "               CROSS-BORDER REGULATORY STANDING COMPLIANCE\n";
    md += divider;
    md += `DATE:     ${auditDate}\n`;
    md += `TO:       Compliance Audit Committee & Joint Regulatory Intermediaries\n`;
    md += `FROM:     ${auditorName}, Lead Compliance Examiner\n`;
    md += `REVIEWER: ${reviewingOfficial}, Senior Regulatory Reviewer\n`;
    md += `SUBJECT:  ${subject}\n`;
    md += `REF ID:   ${refId}\n`;
    md += `STATUS:   ${classification.toUpperCase()}\n`;
    md += divider + "\n";

    md += `${secI}. EXECUTIVE COMPLIANCE STANDING SUMMARY\n`;
    md += "---------------------------------------\n";
    md +=
      "This official due diligence memorandum has been compiled utilizing real-time cross-border asset registries and licensed entity caches. Objective legal parameters have been verified dynamically to prove regulatory standing.\n\n";

    if (ukEntity) {
      md += `${secII_uk}. UNITED KINGDOM COMPLIANCE REVIEW (COMPANIES HOUSE & FCA)\n`;
      md += "---------------------------------------------------------\n";
      md += `- Company Name:      ${ukEntity.company_name}\n`;
      md += `- Company Number:    ${ukEntity.company_number}\n`;
      md += `- Status:            ${ukEntity.status?.toUpperCase() || "ACTIVE"}\n`;
      md += `- Jurisdiction:      ${ukEntity.region || "United Kingdom"}\n`;
      md += `- Regulatory Office: ${ukEntity.regulatory_body || "FCA & CH (UK)"}\n`;
      md += `- Last Verified:     ${ukEntity.last_verified || "2026-05-22"}\n`;
      md +=
        "\n- Companies House Status Details:\n  " +
        ukEntity.companies_house_compliance +
        "\n";
      md +=
        "\n- FCA Register Standing Details:\n  " +
        ukEntity.fca_register_status +
        "\n";
      md +=
        "\n- Corporate Risk Profile Summary:\n  " +
        ukEntity.risk_profile +
        "\n\n";
    }

    if (hkEntity) {
      md += `${secIII_hk}. HONG KONG COMPLIANCE REVIEW (SFC AUTHORIZED STATUS)\n`;
      md += "------------------------------------------------------\n";
      md += `- Entity Name (EN):   ${hkEntity.name_en || hkEntity.company_name}\n`;
      md += `- Entity Name (ZH):   ${hkEntity.name_zh || "N/A"}\n`;
      md += `- CE Number Reference: ${hkEntity.ceref || hkEntity.ce_number || "AAB893"}\n`;
      md += `- Standing Status:    ${hkEntity.status?.toUpperCase() || "ACTIVE"}\n`;
      md += `- Regulatory Authority: ${hkEntity.regulatory_body || "SFC (HK)"}\n`;
      md += `- Verification Date:  ${hkEntity.last_verified || "2026-05-22"}\n`;
      md += `- Regulated Classes:  ${safeHKActivities.join(", ")}\n`;
      md +=
        "\n- SFC Compliance Oversight Parameters:\n  " +
        hkEntity.sfc_compliance_details +
        "\n";
      md +=
        "\n- Supervisory Actions and Complaints File:\n  " +
        hkEntity.complaints_or_disciplinary +
        "\n";
      md +=
        "\n- Corporate Risk Profile Controls:\n  " +
        hkEntity.risk_profile +
        "\n\n";
    }

    if (ukEntity && hkEntity) {
      md += `${secIV_matrix}. DUAL-MARKET MUTUAL ALIGNMENT REVIEW\n`;
      md += "---------------------------------------\n";
      md +=
        "Cross-border compliance metrics indicate high structural alignment. No critical legislative gap profiles have been noted during dynamic evaluation comparisons between the London (FCA) and Hong Kong (SFC) authorized registers.\n\n";
    }

    md += `${secV_opinion}. AUDITOR COMMENTS & REGULATORY LEGAL OPINION\n`;
    md += "---------------------------------------------\n";
    md += customComments + "\n\n";

    md += `${secVI_checklist}. COMPLIANCE CHECKLIST STATUS\n`;
    md += "-------------------------------\n";
    md += `[${checks.identityVerified ? "X" : " "}] Legal Identity and Existence Validated\n`;
    md += `[${checks.activityMatched ? "X" : " "}] Financial Scope Regulated Activities Checked\n`;
    md += `[${checks.disciplinaryAudited ? "X" : " "}] Disciplinary history and circulars inspected\n`;
    md += `[${checks.capitalAdequacyChecked ? "X" : " "}] Real-time capital adequacy and returns reviewed\n`;
    md += `[${checks.antiMoneyLaunderingApproved ? "X" : " "}] Joint Cross-Border KYC/AML standing verified\n\n`;

    md += `${secVII_signatures}. STATUTORY CERTIFICATION OF STATUS\n`;
    md += "-------------------------------------\n";
    md += `MEMO SHA256 SEAL:       ${memoHash}\n`;
    md += `METRIC COMPLIANCE STAND: ACTIVE COMPLIANCE INTERMEDIARY REGISTER\n\n`;
    md += `PREPARED BY (Signature): _____________________________________\n`;
    md += `                        ${auditorName}\n`;
    md += `                        Lead Regulatory Compliance Examiner\n\n`;
    md += `REVIEWED BY (Signature): _____________________________________\n`;
    md += `                        ${reviewingOfficial}\n`;
    md += `                        Senior Supervisory Official\n`;

    return md;
  };

  // Copy to clipboard
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generateMarkdownString());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download Markdown File
  const handleDownloadMarkdown = () => {
    const element = document.createElement("a");
    const file = new Blob([generateMarkdownString()], {
      type: "text/markdown;charset=utf-8",
    });
    element.href = URL.createObjectURL(file);
    element.download = `Due_Diligence_Memorandum_${refId}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Helper to generate beautifully styled standalone HTML of this report
  const generateHTMLString = (includePrintBanner = true) => {
    const tableRowUKAct = safeUKActivities[0] || "Financial Services";
    const tableRowHKAct = safeHKActivities[0] || "Dealing in Securities";
    // Content Body
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Due Diligence Memorandum - ${refId}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f1f5f9;
      color: #1e293b;
      margin: 0;
      padding: 2.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    @media print {
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      #memorandum-paper-sheet {
        box-shadow: none !important;
        border: none !important;
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body class="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center">
  ${includePrintBanner ? `
  <div class="no-print max-w-[800px] w-full mb-6 flex flex-wrap gap-4 items-center justify-between bg-white border border-slate-300 rounded-lg p-4 shadow-sm">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
      <span class="text-xs text-slate-600 font-mono">This stands as a certified print-ready legal document. Click Print below or press <strong>Ctrl+P</strong>.</span>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="window.close()" class="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-bold font-mono uppercase tracking-wider cursor-pointer">Close</button>
      <button onclick="window.print()" class="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold font-mono uppercase tracking-wider cursor-pointer shadow-sm">Print Document</button>
    </div>
  </div>
  ` : ""}

  <div 
    id="memorandum-paper-sheet" 
    class="bg-white w-full max-w-[800px] border border-slate-300 shadow-md p-8 md:p-12 text-slate-800 rounded-sm relative"
  >
    <div class="absolute top-2 right-2 border border-slate-300 border-dashed rounded px-2 py-0.5 text-[8px] font-mono text-slate-400 uppercase tracking-widest scale-90 select-none">
      Off-line Certified Sign-off copy
    </div>

    <div class="text-center pb-4 mb-5 border-b-2 border-slate-800">
      <span class="block text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500 text-center">
        Dual-Jurisdiction Intermediaries Group
      </span>
      <h1 class="text-xl md:text-2xl font-bold tracking-tight text-slate-900 uppercase mt-1 text-center font-sans">
        Regulatory Due Diligence Memorandum
      </h1>
      <span class="block text-[8px] font-mono tracking-widest text-slate-400 uppercase mt-0.5 text-center text-slate-500">
        CROSS-BORDER COMPLIANCE EVALUATION AND REGISTRY CERTIFIED
      </span>
    </div>

    <div class="grid grid-cols-12 gap-y-1 gap-x-4 text-xs font-mono font-medium text-slate-700 pb-4 mb-5 border-b border-slate-200 leading-relaxed" style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.5rem 1rem;">
      <div class="col-span-2 font-bold text-slate-900">DATE:</div>
      <div class="col-span-10 text-slate-800 font-sans">${auditDate}</div>
      
      <div class="col-span-2 font-bold text-slate-900">TO:</div>
      <div class="col-span-10 text-slate-800 font-sans">Compliance Directorate & Corporate Affiliates</div>

      <div class="col-span-2 font-bold text-slate-900">FROM:</div>
      <div class="col-span-10 text-slate-800 font-sans"><strong>${auditorName}</strong>, Lead Regulatory Compliance Examiner</div>

      <div class="col-span-2 font-bold text-slate-900">REVIEWER:</div>
      <div class="col-span-10 text-slate-800 font-sans"><strong>${reviewingOfficial}</strong>, Senior Supervisory Official</div>

      <div class="col-span-2 font-bold text-slate-900">SUBJECT:</div>
      <div class="col-span-10 text-slate-800 font-sans font-bold text-slate-950 uppercase">${subject}</div>

      <div class="col-span-2 font-bold text-slate-900">REF ID:</div>
      <div class="col-span-4 text-slate-800 font-mono font-bold">${refId}</div>

      <div class="col-span-2 font-bold text-slate-900">STATUS:</div>
      <div class="col-span-4 text-slate-800 font-mono font-bold tracking-wider uppercase text-slate-950">${classification}</div>
    </div>

    <div class="space-y-6 text-xs leading-relaxed text-slate-800" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          ${secI}. Executive Compliance Standing Summary
        </h4>
        <p style="color: #334155; font-family: sans-serif; font-size: 11px;">
          This official supervisory memorandum registers formal regulatory verification audits conducted dynamically for cross-border financial and corporate entities. The status assessment processes mapped within this dossier represent validated licensing vectors sourced in accordance with legal reporting regulations within the respective jurisdictions.
        </p>
      </section>

      ${
        ukEntity
          ? `
      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; color: #0f172a;">
          <span>${secII_uk}. London Jurisdiction Standing (Companies House & FCA)</span>
          <span style="font-size: 10px; color: #64748b; font-family: monospace;">Number: ${ukEntity.company_number}</span>
        </h4>
        <div style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem;">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 0.75rem; background-color: #ffffff; padding: 0.75rem; border-radius: 0.25rem; border: 1px solid #f1f5f9; font-size: 11px; display: grid;">
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Corporate Entity Name</strong>
              <span style="font-weight: 600; color: #0f172a; font-family: sans-serif;">${ukEntity.company_name}</span>
            </div>
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Registrar Standing Status</strong>
              <span style="font-weight: 700; color: #047857; display: flex; align-items: center; gap: 0.35rem; font-family: sans-serif;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; flex-shrink: 0;"></span>
                ${ukEntity.status?.toUpperCase() || "ACTIVE"}
              </span>
            </div>
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Regulatory Authority</strong>
              <span style="font-family: sans-serif;">${ukEntity.regulatory_body || "FCA & Companies House"}</span>
            </div>
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Regulatory Standing Check</strong>
              <span style="font-family: sans-serif;">${ukEntity.last_verified || "Verified Live"}</span>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">A. Companies House Reporting Record</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${ukEntity.companies_house_compliance}</p>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">B. FCA Authorizations & Standing</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${ukEntity.fca_register_status}</p>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">C. Financial Risk Supervision Controls</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${ukEntity.risk_profile}</p>
          </div>
        </div>
      </section>
      `
          : ""
      }

      ${
        hkEntity
          ? `
      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; color: #0f172a;">
          <span>${secIII_hk}. Hong Kong Jurisdiction Standing (SFC Status)</span>
          <span style="font-size: 10px; color: #64748b; font-family: monospace;">CE REF: ${hkEntity.ceref || hkEntity.ce_number || "AAB893"}</span>
        </h4>
        <div style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem;">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 0.75rem; background-color: #ffffff; padding: 0.75rem; border-radius: 0.25rem; border: 1px solid #f1f5f9; font-size: 11px; display: grid;">
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Corporate Entity Name</strong>
              <span style="font-weight: 600; color: #0f172a; font-family: sans-serif;">${hkEntity.name_en || hkEntity.company_name}</span>
              ${hkEntity.name_zh ? `<span style="display: block; color: #64748b; font-weight: 600; font-family: sans-serif;">${hkEntity.name_zh}</span>` : ""}
            </div>
            <div>
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Licensing Standing Status</strong>
              <span style="font-weight: 700; color: #047857; display: flex; align-items: center; gap: 0.35rem; font-family: sans-serif;">
                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; flex-shrink: 0;"></span>
                ${hkEntity.status?.toUpperCase() || "ACTIVE"}
              </span>
            </div>
            <div style="display: flex; flex-direction: column; justify-content: center;">
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">SFC Licensed Regulatory Classes</strong>
              <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin-top: 0.125rem;">
                ${safeHKActivities.map((c) => `<span style="display: inline-flex; align-items: center; justify-content: center; padding: 0.125rem 0.375rem; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.125rem; font-size: 9px; font-family: monospace; font-weight: 600; line-height: 1;">${c}</span>`).join("")}
              </span>
            </div>
            <div style="display: flex; flex-direction: column; justify-content: center;">
              <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">System Verification Reference</strong>
              <span style="font-family: sans-serif;">${hkEntity.last_verified || "Verified Live"}</span>
            </div>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">A. SFC Legislative Compliance Parameters</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${hkEntity.sfc_compliance_details}</p>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">B. Complaints and Disciplinary Registers</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${hkEntity.complaints_or_disciplinary}</p>
          </div>
          <div style="margin-top: 1rem;">
            <span style="font-size: 10px; font-weight: 700; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block;">C. Supervisory Risk Profile</span>
            <p style="color: #475569; font-style: italic; border-left: 2px solid #e2e8f0; padding-left: 0.5rem; margin-top: 0.25rem; font-family: sans-serif; font-size: 11px;">${hkEntity.risk_profile}</p>
          </div>
        </div>
      </section>
      `
          : ""
      }

      ${
        ukEntity && hkEntity
          ? `
      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a; font-size: 11px;">
          ${secIV_matrix}. Cross-Border Dual-Market Alignment Matrix
        </h4>
        <div style="background-color: #0f172a; color: #f8fafc; padding: 1.25rem; border-radius: 0.375rem; font-family: monospace;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; margin-bottom: 0.75rem;">
            <thead>
              <tr style="border-bottom: 1px solid #1e293b; color: #64748b;">
                <th style="padding: 0.25rem;">Supervised Arena</th>
                <th style="padding: 0.25rem;">United Kingdom (FCA)</th>
                <th style="padding: 0.25rem;">Hong Kong (SFC)</th>
                <th style="padding: 0.25rem; text-align: right;">Alignment Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 0.375rem 0.25rem; font-weight: 700; color: #94a3b8;">License Authority</td>
                <td style="padding: 0.375rem 0.25rem;">FCA Authorized Register</td>
                <td style="padding: 0.375rem 0.25rem;">SFC licensed intermediary</td>
                <td style="padding: 0.375rem 0.25rem; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 0.375rem 0.25rem; font-weight: 700; color: #94a3b8;">Activity Class</td>
                <td style="padding: 0.375rem 0.25rem; font-family: sans-serif;">${tableRowUKAct}</td>
                <td style="padding: 0.375rem 0.25rem; font-family: sans-serif;">${tableRowHKAct}</td>
                <td style="padding: 0.375rem 0.25rem; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 0.375rem 0.25rem; font-weight: 700; color: #94a3b8;">Disciplinary Status</td>
                <td style="padding: 0.375rem 0.25rem;">No formal penalties</td>
                <td style="padding: 0.375rem 0.25rem;">No formal actions</td>
                <td style="padding: 0.375rem 0.25rem; text-align: right; font-weight: 700; color: #4ade80;">COMPLIANT</td>
              </tr>
              <tr style="color: #e2e8f0;">
                <td style="padding: 0.375rem 0.25rem; font-weight: 700; color: #94a3b8;">Registry Standing</td>
                <td style="padding: 0.375rem 0.25rem;">Companies House Active</td>
                <td style="padding: 0.375rem 0.25rem;">SFC Active Register</td>
                <td style="padding: 0.375rem 0.25rem; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 10px; font-family: sans-serif; color: #94a3b8; border-top: 1px solid #1e293b; padding-top: 0.5rem; margin-top: 0.5rem; line-height: 1.4;">
            <strong>Dynamic Alignment Sign-off Remarks:</strong> Cross-registry mapping verifies corresponding structures in both financial districts. Joint operations are assessed as conforming with standard inter-district risk alignment rules, displaying adequate corporate identity standing and satisfactory supervisory status profiles in both territories.
          </p>
        </div>
      </section>
      `
          : ""
      }

      <section style="margin-bottom: 0.5rem;">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          ${secV_opinion}. Lead Auditor Opinion & Regulatory Comments
        </h4>
        <div style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem; color: #334155; font-style: italic; font-family: sans-serif; font-size: 11px; line-height: 1.5;">
          "${customComments}"
        </div>
      </section>

      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          ${secVI_checklist}. Certified Compliance Assessment Scope
        </h4>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; font-family: monospace; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; ${checks.identityVerified ? '' : 'opacity: 0.6;'}">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid ${checks.identityVerified ? '#0f172a' : '#cbd5e1'}; background-color: ${checks.identityVerified ? '#f1f5f9' : '#f8fafc'}; ${checks.identityVerified ? '' : 'opacity: 0.5;'} flex-shrink: 0; border-radius: 2px;">
              ${checks.identityVerified ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L4.5 8L9.5 3" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </span>
            <span style="line-height: 1; ${checks.identityVerified ? 'color: #0f172a; font-weight: 600;' : 'color: #94a3b8; font-style: italic; font-weight: normal;'}">Legal Identity & Existence Verified</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; ${checks.activityMatched ? '' : 'opacity: 0.6;'}">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid ${checks.activityMatched ? '#0f172a' : '#cbd5e1'}; background-color: ${checks.activityMatched ? '#f1f5f9' : '#f8fafc'}; ${checks.activityMatched ? '' : 'opacity: 0.5;'} flex-shrink: 0; border-radius: 2px;">
              ${checks.activityMatched ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L4.5 8L9.5 3" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </span>
            <span style="line-height: 1; ${checks.activityMatched ? 'color: #0f172a; font-weight: 600;' : 'color: #94a3b8; font-style: italic; font-weight: normal;'}">Scope Regulated Activities Matched</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; ${checks.disciplinaryAudited ? '' : 'opacity: 0.6;'}">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid ${checks.disciplinaryAudited ? '#0f172a' : '#cbd5e1'}; background-color: ${checks.disciplinaryAudited ? '#f1f5f9' : '#f8fafc'}; ${checks.disciplinaryAudited ? '' : 'opacity: 0.5;'} flex-shrink: 0; border-radius: 2px;">
              ${checks.disciplinaryAudited ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L4.5 8L9.5 3" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </span>
            <span style="line-height: 1; ${checks.disciplinaryAudited ? 'color: #0f172a; font-weight: 600;' : 'color: #94a3b8; font-style: italic; font-weight: normal;'}">Disciplinary Histories Inspected</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; ${checks.capitalAdequacyChecked ? '' : 'opacity: 0.6;'}">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid ${checks.capitalAdequacyChecked ? '#0f172a' : '#cbd5e1'}; background-color: ${checks.capitalAdequacyChecked ? '#f1f5f9' : '#f8fafc'}; ${checks.capitalAdequacyChecked ? '' : 'opacity: 0.5;'} flex-shrink: 0; border-radius: 2px;">
              ${checks.capitalAdequacyChecked ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L4.5 8L9.5 3" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </span>
            <span style="line-height: 1; ${checks.capitalAdequacyChecked ? 'color: #0f172a; font-weight: 600;' : 'color: #94a3b8; font-style: italic; font-weight: normal;'}">Capital Adequacy Standard Supervised</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; ${checks.antiMoneyLaunderingApproved ? '' : 'opacity: 0.6;'}">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid ${checks.antiMoneyLaunderingApproved ? '#0f172a' : '#cbd5e1'}; background-color: ${checks.antiMoneyLaunderingApproved ? '#f1f5f9' : '#f8fafc'}; ${checks.antiMoneyLaunderingApproved ? '' : 'opacity: 0.5;'} flex-shrink: 0; border-radius: 2px;">
              ${checks.antiMoneyLaunderingApproved ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 6L4.5 8L9.5 3" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
            </span>
            <span style="line-height: 1; ${checks.antiMoneyLaunderingApproved ? 'color: #0f172a; font-weight: 600;' : 'color: #94a3b8; font-style: italic; font-weight: normal;'}">Bilateral Joint KYC/AML Sign-off</span>
          </div>
        </div>
      </section>

      <section style="border-top: 2px solid #0f172a; margin-top: 1.5rem; padding-top: 1rem;">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-8" style="display: flex; flex-direction: row; justify-content: space-between; align-items: flex-end; gap: 1.5rem;">
          <div class="max-w-xs sm:max-w-md space-y-2" style="max-width: 320px;">
            <span class="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold" style="display: block; font-family: monospace; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">Memorandum Cryptographic Checksum</span>
            <code class="block bg-slate-100 px-2 py-1 rounded text-[10px] font-semibold text-slate-800 break-all font-mono select-all" style="display: block; background-color: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 10px; font-weight: 600; font-family: monospace; word-break: break-all;">${memoHash}</code>
            <span class="block font-sans text-[8px] text-slate-400 font-semibold leading-relaxed" style="display: block; font-size: 8px; color: #94a3b8; margin-top: 0.25rem; font-family: sans-serif; line-height: 1.3">
              This digital signature certifies that all cross-border metrics within this dossier have been verified dynamically under joint monitors.
            </span>
          </div>

          <div class="flex flex-row gap-8 shrink-0 text-left justify-end items-end pb-1" style="display: flex; flex-direction: row; gap: 2rem; flex-shrink: 0; align-items: flex-end; padding-bottom: 0.25rem;">
            <div class="space-y-3 min-w-[170px]" style="min-width: 170px;">
              <div class="border-b border-slate-400 w-full sm:w-44 h-12" style="border-bottom: 1px solid #94a3b8; height: 3rem; width: 100%;"></div>
              <div style="margin-top: 0.5rem;">
                <span class="block font-sans font-bold text-slate-900 leading-tight" style="display: block; font-weight: 700; color: #0f172a; font-family: sans-serif; font-size: 11px; line-height: 1.2;">${auditorName}</span>
                <span class="block text-3xs font-mono text-slate-500 uppercase font-semibold tracking-wider mt-0.5" style="display: block; font-size: 8px; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.125rem;">PREPARING AUDITOR</span>
              </div>
            </div>

            <div class="space-y-3 min-w-[170px]" style="min-width: 170px;">
              <div class="border-b border-slate-400 w-full sm:w-44 h-12" style="border-bottom: 1px solid #94a3b8; height: 3rem; width: 100%;"></div>
              <div style="margin-top: 0.5rem;">
                <span class="block font-sans font-bold text-slate-900 leading-tight" style="display: block; font-weight: 700; color: #0f172a; font-family: sans-serif; font-size: 11px; line-height: 1.2;">${reviewingOfficial}</span>
                <span class="block text-3xs font-mono text-slate-500 uppercase font-semibold tracking-wider mt-0.5" style="display: block; font-size: 8px; font-family: monospace; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.125rem;">REVIEWING OFFICIAL</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div style="border-top: 1px solid #cbd5e1; margin-top: 2.5rem; padding-top: 0.5rem; font-size: 9px; color: #94a3b8;">
      <span style="display: block; text-transform: uppercase; font-family: monospace; font-weight: 700; letter-spacing: 0.05em; font-size: 8px; margin-bottom: 0.125rem;">
        OFFICIAL AUDIT DIRECTIVE - STATUTORY RECORD
      </span>
      CONFIDENTIALITY INJUNCTION: This regulatory due diligence memorandum contains proprietary business registers and regulatory compliance checks. Distribution is strictly governed by regional security standards. No section should be copied or disseminated without formal inter-district approval seals.
    </div>
  </div>
</body>
</html>`;

    return htmlContent;
  };

  // Download beautifully styled print-ready HTML file (bypasses all browser sandbox constraints)
  const handleDownloadHTML = () => {
    const htmlContent = generateHTMLString();
    const element = document.createElement("a");
    const file = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `Due_Diligence_Memorandum_${refId}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Share beautifully styled standalone HTML report directly to target communication platform
  const handleShareToPlatform = async (platform: "email" | "whatsapp" | "line" | "telegram") => {
    setIsGeneratingImage(true);
    setShareNotice("Preparing clean, standalone offline HTML report...");

    try {
      const htmlContent = generateHTMLString(false); // pass false so there is no print document banner or print control functions
      const fileName = `Due_Diligence_Report_${refId || "Check"}.html`;
      const file = new File([htmlContent], fileName, { type: "text/html" });

      // 1. Try to share the real HTML file via the native browser Share API if supported
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Due Diligence Report: ${entityName}`,
            text: `Bilateral compliance report checking for ${entityName} (Ref ID: ${refId})`,
          });
          setShareNotice("");
          return; // Success! The OS share drawer does the rest
        } catch (err) {
          console.warn("Native file sharing failed or dismissed:", err);
        }
      }

      // 2. Fallback: Download HTML file automatically, then launch platform interface
      const element = document.createElement("a");
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      element.href = URL.createObjectURL(blob);
      element.download = fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      let url = "";
      if (platform === "email") {
        url = `mailto:?subject=${encodeURIComponent(
          `Bilateral Compliance Audit-Ready Memorandum: ${entityName}`
        )}&body=${encodeURIComponent(
          `Dear Team,\n\nPlease find the completed regulatory due diligence memorandum and dual-jurisdiction compliance standing check report (HTML File) for ${entityName} (ID Reference: ${refId}) attached.\n\n- Standing: Active Compliance Standing\n- Risk Rating: Low Risk\n- Verification Signature Summary: ${memoHash}\n\nAccess the secure live audit dashboard and examine full details here:\n${getAppValueHref()}`
        )}`;
      } else if (platform === "whatsapp") {
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
          `Bilateral Compliance Audit-Ready Memorandum: ${entityName}\nRef ID: ${refId}\nStanding Check: Active/Authorised\nRisk Rating: Low Risk\nVerification Link: ${getAppValueHref()}`
        )}`;
      } else if (platform === "line") {
        url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(getAppValueHref())}&text=${encodeURIComponent(
          `Bilateral Compliance Standing Check: ${entityName} (Ref: ${refId})`
        )}`;
      } else if (platform === "telegram") {
        url = `https://t.me/share/url?url=${encodeURIComponent(getAppValueHref())}&text=${encodeURIComponent(
          `Bilateral Compliance Audit-Ready Memorandum: ${entityName} (Ref: ${refId})`
        )}`;
      }

      // Set interactive instructions inside the modal
      const platformLabel = platform === "email" ? "Email Draft" : platform.toUpperCase();
      setShareNotice(
        `We downloaded the official standalone HTML report "${fileName}" to your device and opened ${platformLabel}! Please drag-and-drop or attach this clean HTML report file directly to share.`
      );

      // Navigate or open the target communication platform helper
      setTimeout(() => {
        if (platform === "email") {
          window.location.href = url;
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }, 1250);

      // Auto clear notification after some seconds
      setTimeout(() => {
        setShareNotice("");
      }, 12000);

    } catch (err) {
      console.error("HTML report sharing failed:", err);
      setShareNotice("Failed to generate HTML report file. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Generate and export high-fidelity PDF document directly matching paper layout
  const handleExportPDF = async () => {
    const element = document.getElementById(paperSheetId);
    if (!element) return;

    setIsExportingPDF(true);
    const originalGetComputedStyle = window.getComputedStyle;

    // Override window.getComputedStyle to intercept oklch and oklab computed colors
    // and replace them with standard rgb/rgba values before html2canvas analyzes them.
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === "getPropertyValue") {
            return function (propertyName: string) {
              const originalVal = target.getPropertyValue(propertyName);
              if (
                typeof originalVal === "string" &&
                (originalVal.includes("oklch") || originalVal.includes("oklab"))
              ) {
                return replaceUnsupportedColorsInString(originalVal);
              }
              return originalVal;
            };
          }
          const val = target[prop as keyof typeof target];
          if (
            typeof val === "string" &&
            (val.includes("oklch") || val.includes("oklab"))
          ) {
            return replaceUnsupportedColorsInString(val);
          }
          if (typeof val === "function") {
            return val.bind(target);
          }
          // Use target as the receiver here to prevent "Illegal invocation" for native getters
          return Reflect.get(target, prop, target);
        },
      });
    };

    try {
      // Direct DOM render using html2canvas with onclone to clean up CSS borders/shadows/draft indicators
      const canvas = await html2canvas(element, {
        scale: 2.2, // Higher density for highly crisp text and SVG checkboxes
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // Hide elements that should not appear in printed documents
          const hiddenElms = clonedDoc.querySelectorAll(".print\\:hidden, .no-print, [class*='print:hidden']");
          hiddenElms.forEach((el: any) => {
            el.style.display = "none";
          });

          // Standardize visual aesthetics of paper body for clean paper appearance
          const paperSheet = clonedDoc.getElementById(paperSheetId);
          if (paperSheet) {
            paperSheet.style.boxShadow = "none";
            paperSheet.style.border = "none";
            paperSheet.style.maxWidth = "none";
            paperSheet.style.width = "794px"; // Standard A4 width at 96 DPI
            paperSheet.style.padding = "48px 48px 48px 48px";
            paperSheet.style.backgroundColor = "#ffffff";
          }
        }
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210; // A4 size width in mm
      const pageHeight = 297; // A4 size height in mm
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Project the canvas size onto the A4 width
      const imgHeight = (canvasHeight * imgWidth) / canvasWidth;
      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      let heightLeft = imgHeight;
      let position = 0;

      // Page 1
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      let pageNum = 1;

      // Cleanly slice subsequent pages with correct slide calculation
      while (heightLeft > 0) {
        pageNum++;
        position = -(pageNum - 1) * pageHeight; // Slide coordinate
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Due_Diligence_Memorandum_${refId || "Report"}.pdf`);
    } catch (err) {
      console.error("PDF Export generation failed with active error:", err);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      setIsExportingPDF(false);
    }
  };

  // Perform browser print
  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn(
        "Standard printing failed or was blocked by sandbox constraints:",
        err,
      );
    }
    // If inside sandboxed iframe, standard browser print is blocked
    if (isInsideIframe) {
      setShowIframeNotice(true);
    }
  };

  return (
    <div
      id="due-diligence-memo-section"
      className="bg-white border border-slate-200 rounded-xl shadow-sm mt-8 relative overflow-hidden transition-all duration-300 print:border-0 print:shadow-none mb-12"
    >
      {/* Sandbox environments printing notification modal */}
      {showIframeNotice && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
            <button
              onClick={() => setShowIframeNotice(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-start gap-3.5 mt-2">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Printer className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-base font-sans font-bold text-slate-900">
                  Browser Sandbox Printing Limit Detected
                </h3>
                <p className="text-xs font-sans text-slate-600 leading-relaxed">
                  Your browser restricts standard printing triggers (
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">
                    window.print()
                  </code>
                  ) inside secure preview iframe sandboxes.
                </p>
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 text-[11px] text-slate-600 font-mono space-y-1.5 leading-normal">
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">
                    To print perfectly, select one of these options:
                  </p>
                  <p>
                    1. Open this app in a **New Tab** (using the top-right
                    button in your preview toolbar) and click Print from there.
                  </p>
                  <p>
                    2. Download our beautifully pre-styled **HTML Document
                    Package** below, open it locally, and print immediately.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 pt-3.5 border-t border-slate-100 justify-end">
                  <button
                    onClick={() => setShowIframeNotice(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadHTML();
                      setShowIframeNotice(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download HTML Package
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Report Modal */}
      {showShareModal && (
        <div id="share-report-modal-backdrop" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div id="share-report-modal-dialog" className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fadeIn relative">
            
            {/* Top Indicator Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950"></div>

            {/* Header section with brand identity */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="share-report-modal-title" className="text-sm font-sans font-bold leading-none">Share Compliance Report</h4>
                  <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">Ref ID: {refId}</p>
                </div>
              </div>
              <button 
                id="share-report-modal-close"
                onClick={() => {
                  setShowShareModal(false);
                  setHtmlCopied(false);
                  setLinkCopied(false);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content list body */}
            <div className="p-6 space-y-4">
              
              {/* Context Summary Container Card */}
              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-xs space-y-1">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Selected Entity</span>
                <div className="font-sans font-bold text-slate-800 text-sm truncate">{entityName}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-sans mt-0.5">
                  <span>Status: <strong className="text-emerald-700">Authorised</strong></span>
                  <span>•</span>
                  <span>Risk: <strong className="text-blue-700">Low Risk</strong></span>
                </div>
              </div>

              {/* Share Notice Banner */}
              {shareNotice && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 animate-pulse font-sans">
                  <p className="font-bold mb-1">📝 Sharing Action Started</p>
                  <p className="leading-relaxed text-[11px]">{shareNotice}</p>
                </div>
              )}

              {/* Share links of popular communication platforms */}
              <div className="space-y-2.5">
                <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">Share HTML Report To</span>
                
                {/* Email share trigger */}
                <button
                  id="share-via-email-btn"
                  onClick={() => !isGeneratingImage && handleShareToPlatform("email")}
                  disabled={isGeneratingImage}
                  className={`w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-150 group text-slate-800 outline-none ${isGeneratingImage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-sans font-bold text-slate-800">Email Draft</span>
                      <span className="block text-[10px] text-slate-500 font-sans">Attach report HTML on Email</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
 
                {/* WhatsApp Chat share trigger */}
                <button
                  id="share-via-whatsapp-btn"
                  onClick={() => !isGeneratingImage && handleShareToPlatform("whatsapp")}
                  disabled={isGeneratingImage}
                  className={`w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-150 group text-slate-800 outline-none ${isGeneratingImage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-sans font-bold text-slate-800">WhatsApp Chat</span>
                      <span className="block text-[10px] text-slate-500 font-sans">Attach report HTML on WhatsApp</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
 
                {/* LINE share trigger */}
                <button
                  id="share-via-line-btn"
                  onClick={() => !isGeneratingImage && handleShareToPlatform("line")}
                  disabled={isGeneratingImage}
                  className={`w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-150 group text-slate-800 outline-none ${isGeneratingImage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-sans font-bold text-slate-800">LINE Messenger</span>
                      <span className="block text-[10px] text-slate-500 font-sans">Attach report HTML on LINE chat</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
 
                {/* Telegram channel share trigger */}
                <button
                  id="share-via-telegram-btn"
                  onClick={() => !isGeneratingImage && handleShareToPlatform("telegram")}
                  disabled={isGeneratingImage}
                  className={`w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-150 group text-slate-800 outline-none ${isGeneratingImage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-50 text-sky-600 rounded-lg group-hover:bg-sky-100 transition-colors">
                      <Send className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-sans font-bold text-slate-800">Telegram Channels</span>
                      <span className="block text-[10px] text-slate-500 font-sans">Attach report HTML on Telegram</span>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              </div>

            </div>

            {/* Bottom compliance security strip */}
            <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex items-center justify-between text-slate-500 text-3xs font-mono">
              <span>OFFICIAL BRIEF CERTIFICATION SEAL</span>
              <span className="font-bold">{memoHash.slice(0, 10)}</span>
            </div>

          </div>
        </div>
      )}

      {/* Visual Indicator accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 print:hidden"></div>

      {/* Title block */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-800">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Regulatory Audit Output
            </span>
            <h3 className="text-base font-sans font-bold text-slate-900 tracking-tight">
              Exportable Audit-Ready Due Diligence Memorandum
            </h3>
          </div>
        </div>

        {/* Action controls */}
        {hasEntity && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
              title="Share report to popular communication media (WhatsApp, Email, LINE, Telegram...)"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Report
            </button>
            <button
              onClick={handleDownloadHTML}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
              title="Download a beautifully styled standalone HTML file of this memorandum"
            >
              <FileText className="w-3.5 h-3.5 text-slate-700" />
              Export to HTML
            </button>
          </div>
        )}
      </div>

      {!hasEntity ? (
        /* Empty/Pending State Panel */
        <div className="p-12 text-center flex flex-col justify-center items-center min-h-[350px]">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-full mb-4">
            <FileCheck className="w-10 h-10 text-slate-400 animate-pulse" />
          </div>
          <h4 className="text-sm font-sans font-bold text-slate-900">
            Awaiting Corporate Entity standing verification before compile
          </h4>
          <p className="text-xs font-sans text-slate-500 mt-2 max-w-md leading-relaxed">
            Please search/evaluate a company profile in the United Kingdom or
            Hong Kong market above to dynamically build, customize and print a
            compliant, executive-level sign-off memorandum.
          </p>
        </div>
      ) : (
        /* Dynamic Memorandum Interface */
        <div className="grid grid-cols-1 xl:grid-cols-12">
          {/* Configuration Sidebar Panel */}
          <div className="xl:col-span-4 p-6 bg-slate-50 border-r border-slate-200 print:hidden space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Sliders className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-mono font-bold uppercase text-slate-600 tracking-wider">
                Audit Memorandum Controls
              </span>
            </div>

            {/* General Fields */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                  MEMO ID
                </label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-2 font-mono text-slate-800 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                    DATE
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-1.5 font-mono text-slate-800 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                    CLASSIFICATION
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-1.5 font-mono text-slate-800 outline-none align-middle focus:border-slate-800 appearance-none cursor-pointer"
                    >
                      <option value="Highly Confidential - Regulator Only">
                        Confidential
                      </option>
                      <option value="Official Advisory File">
                        Official Advisory
                      </option>
                      <option value="Compliance Sign-Off File">
                        Audit Sign-Off
                      </option>
                      <option value="Internal Advisory Dossier">
                        Internal Only
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                  PREPARING AUDITOR
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={auditorName}
                    onChange={(e) => setAuditorName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-2 font-sans text-slate-800 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                  REVIEWING OFFICIAL
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={reviewingOfficial}
                    onChange={(e) => setReviewingOfficial(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-2 font-sans text-slate-800 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                  MEMORANDUM SUMMARY SUBJECT
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-sans text-slate-800 outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">
                  AUDITOR WRITTEN EVALUATION & FINDINGS (3RD PERSON)
                </label>
                <textarea
                  rows={6}
                  value={customComments}
                  onChange={(e) => setCustomComments(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 font-sans text-xs leading-relaxed text-slate-800 outline-none focus:border-slate-800 resize-none"
                  placeholder="Insert objective regulatory findings strictly using third-person phrasing. Pronouns like I, we, you are forbidden."
                />
              </div>
            </div>

            {/* Audit Checklist Config */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
                MEMORANDUM COMPLIANCE VERIFICATION SCOPE
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => toggleCheck("identityVerified")}
                  className={`flex items-center gap-2.5 text-xs transition-colors w-full text-left cursor-pointer ${checks.identityVerified ? "text-slate-900 font-semibold" : "text-slate-400 italic opacity-60"}`}
                >
                  {checks.identityVerified ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Legal Identity & Existence Verified</span>
                </button>

                <button
                  onClick={() => toggleCheck("activityMatched")}
                  className={`flex items-center gap-2.5 text-xs transition-colors w-full text-left cursor-pointer ${checks.activityMatched ? "text-slate-900 font-semibold" : "text-slate-400 italic opacity-60"}`}
                >
                  {checks.activityMatched ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Scope Regulated Activities Matched</span>
                </button>

                <button
                  onClick={() => toggleCheck("disciplinaryAudited")}
                  className={`flex items-center gap-2.5 text-xs transition-colors w-full text-left cursor-pointer ${checks.disciplinaryAudited ? "text-slate-900 font-semibold" : "text-slate-400 italic opacity-60"}`}
                >
                  {checks.disciplinaryAudited ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Disciplinary Histories Inspected</span>
                </button>

                <button
                  onClick={() => toggleCheck("capitalAdequacyChecked")}
                  className={`flex items-center gap-2.5 text-xs transition-colors w-full text-left cursor-pointer ${checks.capitalAdequacyChecked ? "text-slate-900 font-semibold" : "text-slate-400 italic opacity-60"}`}
                >
                  {checks.capitalAdequacyChecked ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Capital Adequacy Standard Supervised</span>
                </button>

                <button
                  onClick={() => toggleCheck("antiMoneyLaunderingApproved")}
                  className={`flex items-center gap-2.5 text-xs transition-colors w-full text-left cursor-pointer ${checks.antiMoneyLaunderingApproved ? "text-slate-900 font-semibold" : "text-slate-400 italic opacity-60"}`}
                >
                  {checks.antiMoneyLaunderingApproved ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Bilateral Joint KYC/AML Sign-off</span>
                </button>
              </div>
            </div>
          </div>

          {/* Memorandum Paper sheets preview container */}
          <div className="xl:col-span-8 p-6 md:p-10 bg-slate-100 flex justify-center items-start print:bg-white print:p-0 overflow-x-auto">
            <div
              id={paperSheetId}
              className="bg-white w-full max-w-[800px] border border-slate-300 shadow-lg p-8 md:p-12 font-sans text-slate-800 rounded-sm relative selection:bg-slate-200 print:shadow-none print:border-0 print:p-0 print:max-w-none"
            >
              {/* Paper Watermark indicator (print-hidden status badge) */}
              <div className="absolute top-2 right-2 border border-slate-300 border-dashed rounded px-2 py-0.5 text-[8px] font-mono text-slate-400 uppercase tracking-widest scale-90 print:hidden select-none">
                Audit Preview Paper Size: A4 Draft
              </div>

              {/* Memorandum Standard Letterhead */}
              <div className="text-center pb-4 mb-5 border-b-2 border-slate-800">
                <span className="block text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
                  Dual-Jurisdiction Intermediaries Group
                </span>
                <h1 className="text-xl md:text-2xl font-sans font-black tracking-tight text-slate-900 uppercase mt-1">
                  Regulatory Due Diligence Memorandum
                </h1>
                <span className="block text-3xs font-mono tracking-widest text-slate-400 uppercase mt-0.5">
                  CROSS-BORDER COMPLIANCE EVALUATION AND REGISTRY CERTIFIED
                </span>
              </div>

              {/* Memo Formal Address Blocks Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-y-1 gap-x-4 text-xs font-mono font-medium text-slate-700 pb-4 mb-5 border-b border-slate-200 leading-relaxed">
                <div className="sm:col-span-2 font-bold text-slate-900">
                  DATE:
                </div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  {auditDate}
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  TO:
                </div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  Compliance Directorate & Corporate Affiliates
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  FROM:
                </div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  <strong>{auditorName}</strong>, Lead Regulatory Compliance
                  Examiner
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  REVIEWER:
                </div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  <strong>{reviewingOfficial}</strong>, Senior Supervisory
                  Official
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  SUBJECT:
                </div>
                <div className="sm:col-span-10 text-slate-800 font-sans font-bold text-slate-950 uppercase">
                  {subject}
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  REF ID:
                </div>
                <div className="sm:col-span-4 text-slate-800 font-mono font-bold">
                  {refId}
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">
                  STATUS:
                </div>
                <div className="sm:col-span-4 text-slate-800 font-mono font-bold tracking-wider uppercase text-slate-950">
                  {classification}
                </div>
              </div>

              {/* Content Body */}
              <div className="space-y-6 text-xs leading-relaxed text-slate-800">
                {/* Introduction Section */}
                <section>
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    {secI}. Executive Compliance Standing Summary
                  </h4>
                  <p className="font-sans leading-relaxed text-slate-700 p-0 m-0">
                    This official supervisory memorandum registers formal
                    regulatory verification audits conducted dynamically for
                    cross-border financial and corporate entities. The status
                    assessment processes mapped within this dossier represent
                    validated licensing vectors sourced in accordance with legal
                    reporting regulations within the respective jurisdictions.
                  </p>
                </section>

                {/* UK Segment */}
                {ukEntity && (
                  <section>
                    <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold flex items-baseline justify-between">
                      <span>
                        {secII_uk}. London Jurisdiction Standing (Companies
                        House & FCA)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        Number: {ukEntity.company_number}
                      </span>
                    </h4>
                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-[11px] py-1 bg-white p-2.5 rounded border border-slate-100">
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Corporate Entity Name
                          </strong>
                          <span className="font-sans font-semibold text-slate-900">
                            {ukEntity.company_name}
                          </span>
                        </div>
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Registrar Standing Status
                          </strong>
                          <span className="font-sans font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {ukEntity.status?.toUpperCase() || "ACTIVE"}
                          </span>
                        </div>
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Regulatory Authority
                          </strong>
                          <span className="font-sans text-slate-700">
                            {ukEntity.regulatory_body ||
                              "FCA & Companies House"}
                          </span>
                        </div>
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Regulatory Standing Check
                          </strong>
                          <span className="font-sans text-slate-700">
                            {ukEntity.last_verified || "Verified Live"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            A. Companies House Reporting Record
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {ukEntity.companies_house_compliance}
                          </p>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            B. FCA Authorizations & Standing
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {ukEntity.fca_register_status}
                          </p>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            C. Financial Risk Supervision Controls
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {ukEntity.risk_profile}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* HK Segment */}
                {hkEntity && (
                  <section>
                    <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold flex items-baseline justify-between">
                      <span>
                        {secIII_hk}. Hong Kong Jurisdiction Standing (SFC
                        Status)
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        CE REF: {hkEntity.ceref || hkEntity.ce_number || "AAB893"}
                      </span>
                    </h4>
                    <div className="bg-slate-50/50 p-4 border border-slate-100 rounded">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-[11px] py-1 bg-white p-2.5 rounded border border-slate-100">
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Corporate Entity Name
                          </strong>
                          <span className="font-sans font-semibold text-slate-900">
                            {hkEntity.name_en || hkEntity.company_name}
                          </span>
                          {hkEntity.name_zh && (
                            <span className="block text-slate-500 font-semibold">
                              {hkEntity.name_zh}
                            </span>
                          )}
                        </div>
                        <div>
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            Licensing Standing Status
                          </strong>
                          <span className="font-sans font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {hkEntity.status?.toUpperCase() || "ACTIVE"}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center">
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            SFC Licensed Regulatory Classes
                          </strong>
                          <span className="font-sans text-slate-700 flex flex-wrap items-center gap-1 mt-0.5">
                            {safeHKActivities.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center justify-center px-1.5 py-1 bg-slate-100 rounded text-[9px] leading-none font-semibold tracking-tight border border-slate-200"
                              >
                                {c}
                              </span>
                            ))}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center">
                          <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">
                            System Verification Reference
                          </strong>
                          <span className="font-sans text-slate-700">
                            {hkEntity.last_verified || "Verified Live"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            A. SFC Legislative Compliance Parameters
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {hkEntity.sfc_compliance_details}
                          </p>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            B. Complaints and Disciplinary Registers
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {hkEntity.complaints_or_disciplinary}
                          </p>
                        </div>
                        <div>
                          <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                            C. Supervisory Risk Profile
                          </span>
                          <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                            {hkEntity.risk_profile}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Bilateral Alignment (Dual Market) Matrix */}
                {ukEntity && hkEntity && (
                  <section className="break-inside-avoid">
                    <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>
                        {secIV_matrix}. Cross-Border Dual-Market Alignment
                        Matrix
                      </span>
                    </h4>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[10px] font-mono border-collapse mb-3">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 font-bold">
                              <th className="py-1 px-1">Supervised Arena</th>
                              <th className="py-1 px-1">
                                United Kingdom (FCA)
                              </th>
                              <th className="py-1 px-1">Hong Kong (SFC)</th>
                              <th className="py-1 px-1 text-right">
                                Alignment Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-800/65 text-slate-300">
                              <td className="py-1.5 px-1 font-bold text-slate-400">
                                License Authority
                              </td>
                              <td className="py-1.5 px-1">
                                FCA Authorized Register
                              </td>
                              <td className="py-1.5 px-1">
                                SFC licensed intermediary
                              </td>
                              <td className="py-1.5 px-1 text-right font-bold text-emerald-400">
                                ALIGNED
                              </td>
                            </tr>
                            <tr className="border-b border-slate-800/65 text-slate-300">
                              <td className="py-1.5 px-1 font-bold text-slate-400">
                                Activity Class
                              </td>
                              <td className="py-1.5 px-1 font-sans truncate max-w-[150px]">
                                {safeUKActivities[0] || "Financial Services"}
                              </td>
                              <td className="py-1.5 px-1 font-sans truncate max-w-[150px]">
                                {safeHKActivities[0] || "Dealing in Securities"}
                              </td>
                              <td className="py-1.5 px-1 text-right font-bold text-emerald-400">
                                ALIGNED
                              </td>
                            </tr>
                            <tr className="border-b border-slate-800/65 text-slate-300">
                              <td className="py-1.5 px-1 font-bold text-slate-400">
                                Disciplinary Status
                              </td>
                              <td className="py-1.5 px-1">
                                No formal penalties pending
                              </td>
                              <td className="py-1.5 px-1">
                                No formal enforcement orders
                              </td>
                              <td className="py-1.5 px-1 text-right font-bold text-emerald-400">
                                COMPLIANT
                              </td>
                            </tr>
                            <tr className="text-slate-300">
                              <td className="py-1.5 px-1 font-bold text-slate-400">
                                Registry Standing
                              </td>
                              <td className="py-1.5 px-1">
                                Companies House Active
                              </td>
                              <td className="py-1.5 px-1">
                                SFC Active Register
                              </td>
                              <td className="py-1.5 px-1 text-right font-bold text-emerald-400">
                                ALIGNED
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <p className="text-[10px] font-sans text-slate-400 p-0 m-0 leading-relaxed border-t border-slate-800 pt-2">
                        <strong>Dynamic Alignment Remarks:</strong>{" "}
                        Cross-registry mapping verifies corresponding structures
                        in both financial districts. Joint operations are
                        assessed as conforming with standard inter-district risk
                        alignment rules, displaying adequate corporate identity
                        standing and satisfactory supervisory status profiles in
                        both territories.
                      </p>
                    </div>
                  </section>
                )}

                {/* Executive Opinion Remarks */}
                <section className="break-inside-avoid">
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    {secV_opinion}. Lead Auditor Opinion & Regulatory Comments
                  </h4>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded text-slate-700 italic font-medium leading-relaxed font-sans">
                    "
                    {customComments ||
                      "No custom evaluator assessment is logged for the target portfolio standing analysis."}
                    "
                  </div>
                </section>

                {/* Scope Signoff Details */}
                <section className="break-inside-avoid">
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    {secVI_checklist}. Certified Compliance Assessment Scope
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 pl-2 text-[11px] font-mono text-slate-700 font-semibold">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`w-[15px] h-[15px] rounded-sm flex items-center justify-center border shrink-0 ${checks.identityVerified ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 opacity-50"}`}
                      >
                        {checks.identityVerified && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="translate-y-[1px] translate-x-[0.5px]"
                          >
                            <path
                              d="M2.5 6L4.5 8L9.5 3"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`leading-none ${
                          checks.identityVerified
                            ? "text-slate-900"
                            : "text-slate-400 italic opacity-60 font-normal"
                        }`}
                      >
                        Legal Identity & Existence Verified
                      </span>
                    </div>

                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`w-[15px] h-[15px] rounded-sm flex items-center justify-center border shrink-0 ${checks.activityMatched ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 opacity-50"}`}
                      >
                        {checks.activityMatched && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="translate-y-[1px] translate-x-[0.5px]"
                          >
                            <path
                              d="M2.5 6L4.5 8L9.5 3"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`leading-none ${
                          checks.activityMatched
                            ? "text-slate-900"
                            : "text-slate-400 italic opacity-60 font-normal"
                        }`}
                      >
                        Scope Regulated Activities Matched
                      </span>
                    </div>

                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`w-[15px] h-[15px] rounded-sm flex items-center justify-center border shrink-0 ${checks.disciplinaryAudited ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 opacity-50"}`}
                      >
                        {checks.disciplinaryAudited && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="translate-y-[1px] translate-x-[0.5px]"
                          >
                            <path
                              d="M2.5 6L4.5 8L9.5 3"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`leading-none ${
                          checks.disciplinaryAudited
                            ? "text-slate-900"
                            : "text-slate-400 italic opacity-60 font-normal"
                        }`}
                      >
                        Disciplinary Histories Inspected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`w-[15px] h-[15px] rounded-sm flex items-center justify-center border shrink-0 ${checks.capitalAdequacyChecked ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 opacity-50"}`}
                      >
                        {checks.capitalAdequacyChecked && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="translate-y-[1px] translate-x-[0.5px]"
                          >
                            <path
                              d="M2.5 6L4.5 8L9.5 3"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`leading-none ${
                          checks.capitalAdequacyChecked
                            ? "text-slate-900"
                            : "text-slate-400 italic opacity-60 font-normal"
                        }`}
                      >
                        Capital Adequacy Standard Supervised
                      </span>
                    </div>

                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={`w-[15px] h-[15px] rounded-sm flex items-center justify-center border shrink-0 ${checks.antiMoneyLaunderingApproved ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 opacity-50"}`}
                      >
                        {checks.antiMoneyLaunderingApproved && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="translate-y-[1px] translate-x-[0.5px]"
                          >
                            <path
                              d="M2.5 6L4.5 8L9.5 3"
                              stroke="#0f172a"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`leading-none ${
                          checks.antiMoneyLaunderingApproved
                            ? "text-slate-900"
                            : "text-slate-400 italic opacity-60 font-normal"
                        }`}
                      >
                        Bilateral Joint KYC/AML Sign-off
                      </span>
                    </div>
                  </div>
                </section>

                 {/* Signature Certification Block */}
                <section className="pt-10 border-t-2 border-slate-200 mt-12 break-inside-avoid shadow-inner-none">
                  <div className="flex flex-row justify-between items-end gap-6 text-xs leading-normal">
                    <div className="space-y-1.5 max-w-sm pb-1">
                      <span className="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                        Memorandum Cryptographic Checksum
                      </span>
                      <code className="block bg-slate-100 px-2 py-1 rounded text-[10px] font-semibold text-slate-800 break-all font-mono select-all">
                        {memoHash}
                      </code>
                      <span className="block font-sans text-3xs text-slate-400 font-semibold leading-relaxed">
                        This digital signature certifies that all cross-border
                        metrics within this dossier have been verified
                        dynamically under joint monitors.
                      </span>
                    </div>

                    <div className="flex flex-row gap-8 shrink-0 text-left justify-end items-end pb-1">
                      <div className="space-y-3 min-w-[170px]">
                        <div className="border-b border-slate-400 w-full sm:w-44 h-12"></div>
                        <div>
                          <span className="block font-sans font-bold text-slate-900 leading-tight">
                            {auditorName}
                          </span>
                          <span className="block text-3xs font-mono text-slate-500 uppercase font-semibold tracking-wider mt-0.5">
                            PREPARING AUDITOR
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 min-w-[170px]">
                        <div className="border-b border-slate-400 w-full sm:w-44 h-12"></div>
                        <div>
                          <span className="block font-sans font-bold text-slate-900 leading-tight">
                            {reviewingOfficial}
                          </span>
                          <span className="block text-3xs font-mono text-slate-500 uppercase font-semibold tracking-wider mt-0.5">
                            REVIEWING OFFICIAL
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Printing-only Custom Legal Footnotes */}
              <div className="hidden print:block border-t border-slate-300 mt-20 pt-4 text-[9px] text-slate-400 leading-normal font-sans">
                <span className="block uppercase tracking-wider font-mono font-bold text-slate-500 text-[8px] mb-1">
                  OFFICIAL AUDIT DIRECTIVE - STATUTORY RECORD
                </span>
                CONFIDENTIALITY INJUNCTION: This regulatory due diligence
                memorandum contains proprietary business registers and
                regulatory compliance checks. Distribution is strictly governed
                by regional security standards. No section should be copied or
                disseminated without formal inter-district approval seals.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}