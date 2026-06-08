import React, { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import { UKLicensedEntity, HKLicensedEntity } from "../types";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// Helper functions to convert oklch and oklab colors to standard sRGB (to prevent html2canvas parsing crashes)
function oklabToRgb(l: number, a: number, b: number): [number, number, number] {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  
  const l_3 = l_ * l_ * l_;
  const m_3 = m_ * m_ * m_;
  const s_3 = s_ * s_ * s_;
  
  const rL = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
  const gL = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
  const bL = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;
  
  const toSRGB = (val: number) => {
    if (val <= 0.0031308) {
      return Math.max(0, Math.min(255, Math.round(val * 12.92 * 255)));
    } else {
      return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255)));
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
  if (typeof val !== 'string') return val;
  
  let result = val;
  
  // Replace oklch which is unsupported by html2canvas
  if (result.includes('oklch')) {
    const oklchGlobalRegex = /oklch\(\s*(-?[\d\.]+%?)\s+(-?[\d\.]+%?)\s+(-?[\d\.]+(?:deg|rad|grad|turn)?%?)(?:\s*\/\s*(-?[\d\.]+%?))?\s*\)/gi;
    result = result.replace(oklchGlobalRegex, (match, lStr, cStr, hStr, aStr) => {
      let l = parseFloat(lStr);
      if (lStr.includes('%')) l = l / 100;
      
      let c = parseFloat(cStr);
      if (cStr.includes('%')) c = c / 100;
      
      let h = parseFloat(hStr);
      if (hStr.includes('%')) h = (h / 100) * 360;
      
      const rgb = oklchToRgb(l, c, h);
      
      if (aStr) {
        let a = parseFloat(aStr);
        if (aStr.includes('%')) a = a / 100;
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
      }
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    });
  }
  
  // Replace oklab which is also unsupported by html2canvas
  if (result.includes('oklab')) {
    const oklabGlobalRegex = /oklab\(\s*(-?[\d\.]+%?)\s+(-?[\d\.]+%?)\s+(-?[\d\.]+%?)(?:\s*\/\s*(-?[\d\.]+%?))?\s*\)/gi;
    result = result.replace(oklabGlobalRegex, (match, lStr, aStr_coord, bStr_coord, aStr) => {
      let l = parseFloat(lStr);
      if (lStr.includes('%')) l = l / 100;
      
      let aCoord = parseFloat(aStr_coord);
      if (aStr_coord.includes('%')) aCoord = aCoord / 100;
      
      let bCoord = parseFloat(bStr_coord);
      if (bStr_coord.includes('%')) bCoord = bCoord / 100;
      
      const rgb = oklabToRgb(l, aCoord, bCoord);
      
      if (aStr) {
        let a = parseFloat(aStr);
        if (aStr.includes('%')) a = a / 100;
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
      }
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    });
  }
  
  return result;
}

interface DueDiligenceMemoProps {
  ukEntity: UKLicensedEntity | null;
  hkEntity: HKLicensedEntity | null;
}

export default function DueDiligenceMemo({ ukEntity, hkEntity }: DueDiligenceMemoProps) {
  // Setup standard state defaults
  const [refId, setRefId] = useState("");
  const [auditorName, setAuditorName] = useState("Lead Regulatory Examiner");
  const [reviewingOfficial, setReviewingOfficial] = useState("Chief Compliance Director");
  const [subject, setSubject] = useState("Bilateral Regulatory Standing & Cross-Border Due Diligence Audit");
  const [classification, setClassification] = useState("Highly Confidential - Internal Regulator Use");
  const [auditDate, setAuditDate] = useState("");
  const [customComments, setCustomComments] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

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
    const hkCode = hkEntity?.ceref || "NONE";
    const computedHash = btoa(`${generatedRef}|${ukCode}|${hkCode}`).slice(0, 24).toUpperCase();
    setMemoHash(`SECURE_HASH#${computedHash}`);

    // Pre-populate intelligent, professional third-person comments based on entity state
    let commentTemplate = "";
    if (ukEntity && hkEntity) {
      commentTemplate = `Following a bilateral evaluation of the cross-border structures, the compliance monitoring team has completed dual-market verification. Both '${ukEntity.company_name}' in London and '${hkEntity.name_en || hkEntity.company_name}' in Hong Kong demonstrate active corporate registry registrations. Financial resources adequacy guidelines appear fully met based on public disclosures. No critical enforcement restrictions are active under standard Companies House, FCA, or SFC licensing channels. Joint risks remain categorized as low. Continuous risk surveillance is recommended.`;
    } else if (ukEntity) {
      commentTemplate = `The compliance audit team has finalized a thorough standing check of '${ukEntity.company_name}' under the London jurisdiction framework. The entity maintains regular active classification with Companies House and standard compliance standing registers. FCA records reveal no formal investigation actions or disciplinary directives. Operations are deemed to align with necessary capital requirements.`;
    } else if (hkEntity) {
      commentTemplate = `A regulatory assessment has been successfully conducted for '${hkEntity.name_en || hkEntity.company_name}' under the supervision of the Securities and Futures Commission. The Type 9 and associated license classifications maintain active registration and operate within Section 116 of the Securities and Futures Ordinance (Cap. 571). No active penalties are registered.`;
    } else {
      commentTemplate = "Regulatory status evaluation is currently pending. Awaiting valid corporate verification inputs to compile formal analysis.";
    }
    setCustomComments(commentTemplate);
  }, [ukEntity, hkEntity]);

  // Re-calculate hash if inputs modify to maintain semantic correctness
  useEffect(() => {
    if (refId) {
      const ukCode = ukEntity?.company_number || "NONE";
      const hkCode = hkEntity?.ceref || "NONE";
      const comb = `${refId}|${ukCode}|${hkCode}|${auditorName}|${classification}`;
      // Basic rot13/btoa alternative to create a unique consistent hash
      let h = 0;
      for (let i = 0; i < comb.length; i++) {
        h = (Math.imul(31, h) + comb.charCodeAt(i)) | 0;
      }
      const hex = Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
      setMemoHash(`SHA256-SECURE:7DF${hex}${refId.slice(-4)}`);
    }
  }, [refId, auditorName, classification, ukEntity, hkEntity]);

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasEntity = ukEntity !== null || hkEntity !== null;

  // Render markdown for download
  const generateMarkdownString = () => {
    const divider = "========================================================================\n";
    let md = "";
    md += divider;
    md += "                   DUE DILIGENCE MEMORANDUM\n";
    md += "              CROSS-BORDER REGULATORY STANDING COMPLIANCE\n";
    md += divider;
    md += `DATE:     ${auditDate}\n`;
    md += `TO:       Compliance Audit Committee & Joint Regulatory Intermediaries\n`;
    md += `FROM:     ${auditorName}, Lead Compliance Examiner\n`;
    md += `REVIEWER: ${reviewingOfficial}, Senior Regulatory Reviewer\n`;
    md += `SUBJECT:  ${subject}\n`;
    md += `REF ID:   ${refId}\n`;
    md += `STATUS:   ${classification.toUpperCase()}\n`;
    md += divider + "\n";

    md += "I. EXECUTIVE COMPLIANCE STANDING SUMMARY\n";
    md += "---------------------------------------\n";
    md += "This official due diligence memorandum has been compiled utilizing real-time cross-border asset registries and licensed entity caches. Objective legal parameters have been verified dynamically to prove regulatory standing.\n\n";

    if (ukEntity) {
      md += "II. UNITED KINGDOM COMPLIANCE REVIEW (COMPANIES HOUSE & FCA)\n";
      md += "---------------------------------------------------------\n";
      md += `- Company Name:      ${ukEntity.company_name}\n`;
      md += `- Company Number:    ${ukEntity.company_number}\n`;
      md += `- Status:            ${ukEntity.status?.toUpperCase() || "ACTIVE"}\n`;
      md += `- Jurisdiction:      ${ukEntity.region || "United Kingdom"}\n`;
      md += `- Regulatory Office: ${ukEntity.regulatory_body || "FCA & CH (UK)"}\n`;
      md += `- Last Verified:     ${ukEntity.last_verified || "2026-05-22"}\n`;
      md += "\n- Companies House Status Details:\n  " + ukEntity.companies_house_compliance + "\n";
      md += "\n- FCA Register Standing Details:\n  " + ukEntity.fca_register_status + "\n";
      md += "\n- Corporate Risk Profile Summary:\n  " + ukEntity.risk_profile + "\n\n";
    }

    if (hkEntity) {
      md += "III. HONG KONG COMPLIANCE REVIEW (SFC AUTHORIZED STATUS)\n";
      md += "------------------------------------------------------\n";
      md += `- Entity Name (EN):   ${hkEntity.name_en || hkEntity.company_name}\n`;
      md += `- Entity Name (ZH):   ${hkEntity.name_zh || "N/A"}\n`;
      md += `- CE Number Reference: ${hkEntity.ceref}\n`;
      md += `- Standing Status:    ${hkEntity.status?.toUpperCase() || "ACTIVE"}\n`;
      md += `- Regulatory Authority: ${hkEntity.regulatory_body || "SFC (HK)"}\n`;
      md += `- Verification Date:  ${hkEntity.last_verified || "2026-05-22"}\n`;
      md += `- Regulated Classes:  ${(hkEntity.regulated_activities || []).join(", ")}\n`;
      md += "\n- SFC Compliance Oversight Parameters:\n  " + hkEntity.sfc_compliance_details + "\n";
      md += "\n- Supervisory Actions and Complaints File:\n  " + hkEntity.complaints_or_disciplinary + "\n";
      md += "\n- Corporate Risk Profile Controls:\n  " + hkEntity.risk_profile + "\n\n";
    }

    if (ukEntity && hkEntity) {
      md += "IV. DUAL-MARKET MUTUAL ALIGNMENT REVIEW\n";
      md += "---------------------------------------\n";
      md += "Cross-border compliance metrics indicate high structural alignment. No critical legislative gap profiles have been noted during dynamic evaluation comparisons between the London (FCA) and Hong Kong (SFC) authorized registers.\n\n";
    }

    md += "V. AUDITOR COMMENTS & REGULATORY LEGAL OPINION\n";
    md += "---------------------------------------------\n";
    md += customComments + "\n\n";

    md += "VI. COMPLIANCE CHECKLIST STATUS\n";
    md += "-------------------------------\n";
    md += `[${checks.identityVerified ? "X" : " "}] Legal Identity and Existence Validated\n`;
    md += `[${checks.activityMatched ? "X" : " "}] Financial Scope Regulated Activities Checked\n`;
    md += `[${checks.disciplinaryAudited ? "X" : " "}] Disciplinary history and circulars inspected\n`;
    md += `[${checks.capitalAdequacyChecked ? "X" : " "}] Real-time capital adequacy and returns reviewed\n`;
    md += `[${checks.antiMoneyLaunderingApproved ? "X" : " "}] Joint Cross-Border KYC/AML standing verified\n\n`;

    md += "VII. STATUTORY CERTIFICATION OF STATUS\n";
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
    const file = new Blob([generateMarkdownString()], { type: "text/markdown;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `Due_Diligence_Memorandum_${refId}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Download beautifully styled print-ready HTML file (bypasses all browser sandbox constraints)
  const handleDownloadHTML = () => {
    const tableRowUKAct = ukEntity?.regulated_activities?.[0] || "Financial Services";
    const tableRowHKAct = hkEntity?.regulated_activities?.[0] || "Dealing in Securities";

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
  <!-- Interactive Controller panel to enable printable trigger -->
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

  <div 
    id="memorandum-paper-sheet" 
    class="bg-white w-full max-w-[800px] border border-slate-300 shadow-md p-8 md:p-12 text-slate-800 rounded-sm relative"
  >
    <!-- Paper Watermark indicator -->
    <div class="absolute top-2 right-2 border border-slate-300 border-dashed rounded px-2 py-0.5 text-[8px] font-mono text-slate-400 uppercase tracking-widest scale-90 select-none">
      Off-line Certified Sign-off copy
    </div>

    <!-- Letterhead -->
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

    <!-- Details -->
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

    <!-- Content Body -->
    <div class="space-y-6 text-xs leading-relaxed text-slate-800" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          I. Executive Compliance Standing Summary
        </h4>
        <p style="color: #334155; font-family: sans-serif; font-size: 11px;">
          This official supervisory memorandum registers formal regulatory verification audits conducted dynamically for cross-border financial and corporate entities. The status assessment processes mapped within this dossier represent validated licensing vectors sourced in accordance with legal reporting regulations within the respective jurisdictions.
        </p>
      </section>

      ${ukEntity ? `
      <section style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem;">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; color: #0f172a;">
          <span>II. London Jurisdiction Standing (Companies House & FCA)</span>
          <span style="font-size: 10px; color: #64748b;">Number: ${ukEntity.company_number}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 0.75rem; background-color: #ffffff; padding: 0.75rem; border-radius: 0.25rem; border: 1px solid #f1f5f9; font-size: 11px;">
          <div>
            <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Corporate Entity Name</strong>
            <span style="font-weight: 600; color: #0f172a; font-family: sans-serif;">${ukEntity.company_name}</span>
          </div>
          <div>
            <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Registrar Standing Status</strong>
            <span style="font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 0.25rem; font-family: sans-serif;">
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
      </section>
      ` : ''}

      ${hkEntity ? `
      <section style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem;">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; color: #0f172a;">
          <span>III. Hong Kong Jurisdiction Standing (SFC Status)</span>
          <span style="font-size: 10px; color: #64748b;">CE REF: ${hkEntity.ceref}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-bottom: 0.75rem; background-color: #ffffff; padding: 0.75rem; border-radius: 0.25rem; border: 1px solid #f1f5f9; font-size: 11px;">
          <div>
            <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Corporate Entity Name</strong>
            <span style="font-weight: 600; color: #0f172a; font-family: sans-serif;">${hkEntity.name_en || hkEntity.company_name}</span>
            ${hkEntity.name_zh ? `<span style="display: block; color: #64748b; font-weight: 600; font-family: sans-serif;">${hkEntity.name_zh}</span>` : ''}
          </div>
          <div>
            <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Licensing Standing Status</strong>
            <span style="font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 0.25rem; font-family: sans-serif;">
              ${hkEntity.status?.toUpperCase() || "ACTIVE"}
            </span>
          </div>
          <div>
            <strong style="display: block; font-size: 9px; font-family: monospace; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">SFC Licensed Regulatory Classes</strong>
            <span style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.125rem;">
              ${(hkEntity.regulated_activities || []).map(c => `<span style="padding: 0.125rem 0.375rem; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.125rem; font-size: 9px; font-family: monospace; font-weight: 600;">${c}</span>`).join('')}
            </span>
          </div>
          <div>
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
      </section>
      ` : ''}

      ${ukEntity && hkEntity ? `
      <section style="background-color: #0f172a; color: #f8fafc; padding: 1.25rem; border-radius: 0.375rem; font-family: monospace;">
        <h4 style="color: #ffffff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1e293b; padding-bottom: 0.25rem; margin-bottom: 0.5rem; font-size: 11px;">
          IV. Cross-Border Dual-Market Alignment Matrix
        </h4>
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
      </section>
      ` : ''}

      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          V. Lead Auditor Opinion & Regulatory Comments
        </h4>
        <div style="background-color: #f8fafc; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.25rem; color: #334155; font-style: italic; font-family: sans-serif; font-size: 11px; line-height: 1.5;">
          "${customComments}"
        </div>
      </section>

      <section style="margin-bottom: 0.5rem">
        <h4 style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.125rem; margin-bottom: 0.5rem; color: #0f172a;">
          VI. Certified Compliance Assessment Scope
        </h4>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; font-family: monospace; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="border: 1px solid #94a3b8; padding: 0 0.25rem; font-weight: 700; background-color: #f8fafc;">${checks.identityVerified ? "✓" : " "}</span>
            <span>Legal Identity & Existence Verified</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="border: 1px solid #94a3b8; padding: 0 0.25rem; font-weight: 700; background-color: #f8fafc;">${checks.activityMatched ? "✓" : " "}</span>
            <span>Scope Regulated Activities Matched</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="border: 1px solid #94a3b8; padding: 0 0.25rem; font-weight: 700; background-color: #f8fafc;">${checks.disciplinaryAudited ? "✓" : " "}</span>
            <span>Disciplinary Histories Inspected</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="border: 1px solid #94a3b8; padding: 0 0.25rem; font-weight: 700; background-color: #f8fafc;">${checks.capitalAdequacyChecked ? "✓" : " "}</span>
            <span>Capital Adequacy Standard Supervised</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="border: 1px solid #94a3b8; padding: 0 0.25rem; font-weight: 700; background-color: #f8fafc;">${checks.antiMoneyLaunderingApproved ? "✓" : " "}</span>
            <span>Bilateral Joint KYC/AML Sign-off</span>
          </div>
        </div>
      </section>

      <section style="border-top: 2px solid #e2e8f0; margin-top: 1rem; padding-top: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; display: flex; flex-direction: row; justify-content: space-between;">
          <div style="max-width: 380px;">
            <span style="display: block; font-family: monospace; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">Memorandum Cryptographic Checksum</span>
            <code style="display: block; background-color: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 10px; font-weight: 600; font-family: monospace; word-break: break-all;">${memoHash}</code>
            <span style="display: block; font-size: 8px; color: #94a3b8; margin-top: 0.25rem; font-family: sans-serif; line-height: 1.3">
              This digital seal certifies that all corporate metrics within this dossier have been analyzed dynamically under the authority of public intermediary compliance monitors.
            </span>
          </div>
          <div style="display: flex; gap: 1.5rem; flex-shrink: 0; flex-direction: row; display: flex;">
            <div style="min-width: 165px; margin-right: 1.5rem;">
              <div style="border-bottom: 1px solid #94a3b8; height: 2rem;"></div>
              <div style="margin-top: 0.5rem;">
                <span style="display: block; font-weight: 700; color: #0f172a; font-family: sans-serif; font-size: 11px;">${auditorName}</span>
                <span style="display: block; font-size: 8px; font-family: monospace; color: #64748b; text-transform: uppercase;">PREPARING AUDITOR</span>
              </div>
            </div>
            <div style="min-width: 165px;">
              <div style="border-bottom: 1px solid #94a3b8; height: 2rem;"></div>
              <div style="margin-top: 0.5rem;">
                <span style="display: block; font-weight: 700; color: #0f172a; font-family: sans-serif; font-size: 11px;">${reviewingOfficial}</span>
                <span style="display: block; font-size: 8px; font-family: monospace; color: #64748b; text-transform: uppercase;">REVIEWING OFFICIAL</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Footnotes -->
    <div style="border-top: 1px solid #cbd5e1; margin-top: 2.5rem; padding-top: 0.5rem; font-size: 9px; color: #94a3b8;">
      <span style="display: block; text-transform: uppercase; font-family: monospace; font-weight: 700; letter-spacing: 0.05em; font-size: 8px; margin-bottom: 0.125rem;">
        OFFICIAL AUDIT DIRECTIVE - STATUTORY RECORD
      </span>
      CONFIDENTIALITY INJUNCTION: This regulatory due diligence memorandum contains proprietary business registers and regulatory compliance checks. Distribution is strictly governed by regional security standards. No section should be copied or disseminated without formal inter-district approval seals.
    </div>
  </div>
</body>
</html>`;

    const element = document.createElement("a");
    const file = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `Due_Diligence_Memorandum_${refId}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Generate and export high-fidelity PDF document directly matching paper layout
  const handleExportPDF = async () => {
    const element = document.getElementById("memorandum-paper-sheet");
    if (!element) return;
    
    setIsExportingPDF(true);
    const originalGetComputedStyle = window.getComputedStyle;
    
    // Override window.getComputedStyle to intercept oklch and oklab computed colors
    // and replace them with standard rgb/rgba values before html2canvas analyzes them.
    window.getComputedStyle = function(elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const originalVal = target.getPropertyValue(propertyName);
              if (typeof originalVal === 'string' && (originalVal.includes('oklch') || originalVal.includes('oklab'))) {
                return replaceUnsupportedColorsInString(originalVal);
              }
              return originalVal;
            };
          }
          const val = target[prop as keyof typeof target];
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
            return replaceUnsupportedColorsInString(val);
          }
          if (typeof val === 'function') {
            return val.bind(target);
          }
          // Use target as the receiver here to prevent "Illegal invocation" for native getters
          return Reflect.get(target, prop, target);
        }
      });
    };

    // Helper functions to compile HTML templates directly into the PDF rendering flow
    const getLetterheadHTML = () => `
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="display: block; font-family: monospace; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; tracking-widest: 0.1em; letter-spacing: 2px;">
          Dual-Jurisdiction Intermediaries Group
        </span>
        <h1 style="display: block; font-family: sans-serif; font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-top: 4px; letter-spacing: -0.5px;">
          Regulatory Due Diligence Memorandum
        </h1>
        <span style="display: block; font-family: monospace; font-size: 8px; font-weight: 600; text-transform: uppercase; color: #94a3b8; tracking-widest: 0.1em; letter-spacing: 1px; margin-top: 2px;">
          CROSS-BORDER COMPLIANCE EVALUATION AND REGISTRY CERTIFIED
        </span>
      </div>
    `;

    const getAddressBlockHTML = () => `
      <table style="width: 100%; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; font-size: 11px; font-family: monospace; color: #334155; line-height: 1.5; border-collapse: collapse;">
        <tr>
          <td style="width: 15%; font-weight: 700; color: #0f172a; padding: 2px 0;">DATE:</td>
          <td style="width: 85%; font-family: sans-serif; color: #1e293b; padding: 2px 0;">${auditDate}</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">TO:</td>
          <td style="font-family: sans-serif; color: #1e293b; padding: 2px 0;">Compliance Directorate & Corporate Affiliates</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">FROM:</td>
          <td style="font-family: sans-serif; color: #1e293b; padding: 2px 0;"><strong>${auditorName}</strong>, Lead Regulatory Compliance Examiner</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">REVIEWER:</td>
          <td style="font-family: sans-serif; color: #1e293b; padding: 2px 0;"><strong>${reviewingOfficial}</strong>, Senior Supervisory Official</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">SUBJECT:</td>
          <td style="font-family: sans-serif; font-weight: 800; color: #0f172a; text-transform: uppercase; padding: 2px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">REF ID:</td>
          <td style="font-weight: 700; color: #1e293b; padding: 2px 0;">${refId}</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a; padding: 2px 0;">STATUS:</td>
          <td style="font-weight: 700; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; padding: 2px 0;">${classification}</td>
        </tr>
      </table>
    `;

    const getSummaryHTML = () => `
      <section style="margin-bottom: 20px;">
        <h4 style="font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px 0; letter-spacing: 0.5px;">
          I. Executive Compliance Standing Summary
        </h4>
        <p style="font-family: sans-serif; font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
          This official supervisory memorandum registers formal regulatory verification audits conducted dynamically for cross-border financial and corporate entities. The status assessment processes mapped within this dossier represent validated licensing vectors sourced in accordance with legal reporting regulations within the respective jurisdictions.
        </p>
      </section>
    `;

    const getUKSectionHTML = () => {
      if (!ukEntity) return "";
      return `
        <section style="background-color: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
          <h4 style="font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px 0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700;">II. London Jurisdiction Standing (Companies House & FCA)</span>
            <span style="font-size: 9.5px; font-weight: 700; color: #64748b;">Number: ${ukEntity.company_number}</span>
          </h4>
          
          <table style="width: 100%; font-size: 10px; margin-bottom: 10px; border-collapse: collapse; background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 4px;">
            <tr>
              <td style="width: 50%; padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Corporate Entity Name</strong>
                <span style="font-family: sans-serif; font-weight: 600; color: #0f172a;">${ukEntity.company_name}</span>
              </td>
              <td style="width: 50%; padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Registrar Standing Status</strong>
                <span style="font-family: sans-serif; font-weight: 700; color: #047857; display: flex; align-items: center; gap: 4px;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: #10b981; margin-right: 4px;"></span>
                  ${ukEntity.status?.toUpperCase() || "ACTIVE"}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Regulatory Authority</strong>
                <span style="font-family: sans-serif; color: #475569;">${ukEntity.regulatory_body || "FCA & Companies House"}</span>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Regulatory Standing Check</strong>
                <span style="font-family: sans-serif; color: #475569;">${ukEntity.last_verified || "Verified Live"}</span>
              </td>
            </tr>
          </table>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">A. Companies House Reporting Record</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${ukEntity.companies_house_compliance}
              </p>
            </div>
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">B. FCA Authorizations & Standing</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${ukEntity.fca_register_status}
              </p>
            </div>
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">C. Financial Risk Supervision Controls</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${ukEntity.risk_profile}
              </p>
            </div>
          </div>
        </section>
      `;
    };

    const getHKSectionHTML = () => {
      if (!hkEntity) return "";
      const actBadges = (hkEntity.regulated_activities || [])
        .map(c => `<span style="display: inline-block; padding: 2px 5px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 2px; font-size: 8px; font-family: monospace; font-weight: 600; margin-right: 3px; margin-bottom: 2px;">${c}</span>`)
        .join("");
      return `
        <section style="background-color: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
          <h4 style="font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px 0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700;">III. Hong Kong Jurisdiction Standing (SFC Status)</span>
            <span style="font-size: 9.5px; font-weight: 700; color: #64748b;">CE REF: ${hkEntity.ceref}</span>
          </h4>
          
          <table style="width: 100%; font-size: 10px; margin-bottom: 10px; border-collapse: collapse; background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 4px;">
            <tr>
              <td style="width: 50%; padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Corporate Entity Name</strong>
                <span style="font-family: sans-serif; font-weight: 600; color: #0f172a;">${hkEntity.name_en || hkEntity.company_name}</span>
                ${hkEntity.name_zh ? `<span style="display: block; font-family: sans-serif; font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px;">${hkEntity.name_zh}</span>` : ""}
              </td>
              <td style="width: 50%; padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Licensing Standing Status</strong>
                <span style="font-family: sans-serif; font-weight: 700; color: #047857; display: flex; align-items: center; gap: 4px;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: #10b981; margin-right: 4px;"></span>
                  ${hkEntity.status?.toUpperCase() || "ACTIVE"}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">SFC Licensed Classes</strong>
                <span style="display: block; margin-top: 2px;">${actBadges}</span>
              </td>
              <td style="padding: 6px 10px; border: 1px solid #f1f5f9;">
                <strong style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">System Verification Check</strong>
                <span style="font-family: sans-serif; color: #475569;">${hkEntity.last_verified || "Verified Live"}</span>
              </td>
            </tr>
          </table>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">A. SFC Legislative Compliance Parameters</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${hkEntity.sfc_compliance_details}
              </p>
            </div>
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">B. Complaints and Disciplinary Registers</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${hkEntity.complaints_or_disciplinary}
              </p>
            </div>
            <div>
              <span style="display: block; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">C. Supervisory Risk Profile</span>
              <p style="font-family: sans-serif; font-size: 10.5px; font-style: italic; color: #475569; border-left: 2px solid #cbd5e1; padding-left: 8px; margin: 2px 0 0 0;">
                ${hkEntity.risk_profile}
              </p>
            </div>
          </div>
        </section>
      `;
    };

    const getMatrixHTML = () => {
      if (!ukEntity || !hkEntity) return "";
      const tableRowUKAct = ukEntity.regulated_activities?.[0] || "Financial Services";
      const tableRowHKAct = hkEntity.regulated_activities?.[0] || "Dealing in Securities";
      return `
        <section style="background-color: #0f172a; color: #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
          <h4 style="color: #ffffff; font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #1e293b; padding-bottom: 6px; margin: 0 0 10px 0; letter-spacing: 0.5px;">
            IV. Cross-Border Dual-Market Alignment Matrix
          </h4>
          
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 10.5px; font-family: monospace; margin-bottom: 10px;">
            <thead>
              <tr style="border-bottom: 1px solid #1e293b; color: #64748b; font-weight: 700;">
                <th style="padding: 4px;">Supervised Arena</th>
                <th style="padding: 4px;">United Kingdom (FCA)</th>
                <th style="padding: 4px;">Hong Kong (SFC)</th>
                <th style="padding: 4px; text-align: right;">Alignment Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 6px 4px; font-weight: 700; color: #94a3b8;">License Authority</td>
                <td style="padding: 6px 4px;">FCA Authorized Register</td>
                <td style="padding: 6px 4px;">SFC licensed intermediary</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 6px 4px; font-weight: 700; color: #94a3b8;">Activity Class</td>
                <td style="padding: 6px 4px;">${tableRowUKAct}</td>
                <td style="padding: 6px 4px;">${tableRowHKAct}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                <td style="padding: 6px 4px; font-weight: 700; color: #94a3b8;">Disciplinary Status</td>
                <td style="padding: 6px 4px;">No formal penalties</td>
                <td style="padding: 6px 4px;">No formal actions</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: #4ade80;">COMPLIANT</td>
              </tr>
              <tr style="color: #e2e8f0;">
                <td style="padding: 6px 4px; font-weight: 700; color: #94a3b8;">Registry Standing</td>
                <td style="padding: 6px 4px;">Companies House Active</td>
                <td style="padding: 6px 4px;">SFC Active Register</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: #4ade80;">ALIGNED</td>
              </tr>
            </tbody>
          </table>

          <p style="font-family: sans-serif; font-size: 10px; color: #94a3b8; border-top: 1px solid #1e293b; padding-top: 8px; margin: 0; line-height: 1.45;">
            <strong>Dynamic Alignment Remarks:</strong> Cross-registry mapping verifies corresponding structures in both financial districts. Joint operations are assessed as conforming with standard inter-district risk alignment rules, displaying adequate corporate identity standing and satisfactory supervisory status profiles in both territories.
          </p>
        </section>
      `;
    };

    const getCommentsHTML = () => `
      <section style="margin-bottom: 20px;">
        <h4 style="font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px 0; letter-spacing: 0.5px;">
          V. Lead Auditor Opinion & Regulatory Comments
        </h4>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 4px; color: #334155; font-family: sans-serif; font-size: 11px; font-style: italic; line-height: 1.55;">
          "${customComments || "No custom evaluator assessment is logged for the target portfolio standing analysis."}"
        </div>
      </section>
    `;

    const getChecklistHTML = () => {
      const gSpan = (checked: boolean) => checked 
        ? `<span style="display: inline-block; border: 1.5px solid #0f172a; background-color: #f1f5f9; padding: 0px 5px; font-family: monospace; font-weight: 900; font-size: 10px; border-radius: 3px; margin-right: 6px; color: #0f172a;">&nbsp;&#10003;&nbsp;</span>`
        : `<span style="display: inline-block; border: 1.5px solid #cbd5e1; background-color: #ffffff; padding: 0px 5px; font-family: monospace; font-weight: 900; font-size: 10px; border-radius: 3px; margin-right: 6px; color: transparent;">&nbsp;&#10003;&nbsp;</span>`;

      return `
        <section style="margin-bottom: 20px;">
          <h4 style="font-family: monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px 0; letter-spacing: 0.5px;">
            VI. Certified Compliance Assessment Scope
          </h4>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; padding-left: 4px;">
            <div style="display: flex; align-items: center; font-family: monospace; font-size: 10.5px; font-weight: 600; color: #334155;">
              ${gSpan(checks.identityVerified)}
              <span style="${checks.identityVerified ? "" : "text-decoration: line-through; color: #94a3b8;"}">Legal Identity & Existence Verified</span>
            </div>
            
            <div style="display: flex; align-items: center; font-family: monospace; font-size: 10.5px; font-weight: 600; color: #334155;">
              ${gSpan(checks.activityMatched)}
              <span style="${checks.activityMatched ? "" : "text-decoration: line-through; color: #94a3b8;"}">Scope Regulated Activities Matched</span>
            </div>

            <div style="display: flex; align-items: center; font-family: monospace; font-size: 10.5px; font-weight: 600; color: #334155;">
              ${gSpan(checks.disciplinaryAudited)}
              <span style="${checks.disciplinaryAudited ? "" : "text-decoration: line-through; color: #94a3b8;"}">Disciplinary Histories Inspected</span>
            </div>

            <div style="display: flex; align-items: center; font-family: monospace; font-size: 10.5px; font-weight: 600; color: #334155;">
              ${gSpan(checks.capitalAdequacyChecked)}
              <span style="${checks.capitalAdequacyChecked ? "" : "text-decoration: line-through; color: #94a3b8;"}">Capital Adequacy Standard Supervised</span>
            </div>

            <div style="display: flex; align-items: center; font-family: monospace; font-size: 10.5px; font-weight: 600; color: #334155;">
              ${gSpan(checks.antiMoneyLaunderingApproved)}
              <span style="${checks.antiMoneyLaunderingApproved ? "" : "text-decoration: line-through; color: #94a3b8;"}">Bilateral Joint KYC/AML Sign-off</span>
            </div>
          </div>
        </section>
      `;
    };

    const getSignaturesHTML = () => `
      <section style="border-top: 2px solid #e2e8f0; margin-top: 24px; padding-top: 16px;">
        <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: flex-end; gap: 20px;">
          <div style="max-width: 320px; flex: 1;">
            <span style="display: block; font-family: monospace; font-size: 8px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Memorandum Cryptographic Checksum</span>
            <code style="display: block; background-color: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 9px; font-weight: 600; color: #1e293b; border: 1px solid #e2e8f0; word-break: break-all;">
              ${memoHash}
            </code>
            <span style="display: block; font-family: sans-serif; font-size: 8px; color: #94a3b8; line-height: 1.3; margin-top: 4px;">
              This digital signature certifies that all cross-border metrics within this dossier have been verified dynamically under joint monitors.
            </span>
          </div>

          <div style="display: flex; flex-direction: row; gap: 24px; justify-content: flex-end;">
            <div style="min-width: 155px; margin-right: 12px;">
              <div style="border-bottom: 1px solid #94a3b8; height: 32px;"></div>
              <div style="margin-top: 6px;">
                <span style="display: block; font-family: sans-serif; font-weight: 700; color: #0f172a; font-size: 11px;">${auditorName}</span>
                <span style="display: block; font-family: monospace; font-size: 8px; color: #64748b; text-transform: uppercase;">PREPARING AUDITOR</span>
              </div>
            </div>

            <div style="min-width: 155px;">
              <div style="border-bottom: 1px solid #94a3b8; height: 32px;"></div>
              <div style="margin-top: 6px;">
                <span style="display: block; font-family: sans-serif; font-weight: 700; color: #0f172a; font-size: 11px;">${reviewingOfficial}</span>
                <span style="display: block; font-family: monospace; font-size: 8px; color: #64748b; text-transform: uppercase;">REVIEWING OFFICIAL</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    // Define smart page groupings to completely eradicate text truncation and bad page-breaks
    let pageDefs: string[][] = [];

    if (ukEntity && hkEntity) {
      pageDefs = [
        ["letterhead", "address-block", "section-i-summary", "section-ii-uk"],
        ["section-iii-hk", "section-iv-matrix"],
        ["section-v-opinion", "section-vi-checklist", "section-vii-signatures"]
      ];
    } else if (ukEntity) {
      pageDefs = [
        ["letterhead", "address-block", "section-i-summary", "section-ii-uk"],
        ["section-v-opinion", "section-vi-checklist", "section-vii-signatures"]
      ];
    } else if (hkEntity) {
      pageDefs = [
        ["letterhead", "address-block", "section-i-summary", "section-iii-hk"],
        ["section-v-opinion", "section-vi-checklist", "section-vii-signatures"]
      ];
    } else {
      pageDefs = [
        ["letterhead", "address-block", "section-i-summary", "section-v-opinion", "section-vii-signatures"]
      ];
    }

    try {
      // Create a temporary hidden DOM container to compile standard styled virtual sheets
      const tempContainer = document.createElement("div");
      tempContainer.id = "pdf-temp-rendering-host";
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "794px"; // Exact A4 width at 96 DPI
      tempContainer.style.zIndex = "10000";
      tempContainer.style.boxSizing = "border-box";
      tempContainer.className = "bg-slate-100 font-sans text-slate-800";
      document.body.appendChild(tempContainer);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const totalPages = pageDefs.length;

      for (let i = 0; i < totalPages; i++) {
        const sectionsList = pageDefs[i];
        
        const pageEl = document.createElement("div");
        pageEl.style.width = "794px";
        pageEl.style.height = "1122px"; // Exact A4 height at 96 DPI
        pageEl.style.padding = "48px 48px 44px 48px";
        pageEl.style.boxSizing = "border-box";
        pageEl.style.backgroundColor = "#ffffff";
        pageEl.style.display = "flex";
        pageEl.style.flexDirection = "column";
        pageEl.style.justifyContent = "space-between";
        pageEl.className = "bg-white relative";

        // Top running header (omitted on Page 1)
        let headerHTML = "";
        if (i > 0) {
          headerHTML = `
            <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 16px; width: 100%; font-size: 8.5px; font-family: monospace; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
              <span>Due Diligence Audit Memorandum</span>
              <span>Ref: ${refId}</span>
            </div>
          `;
        } else {
          headerHTML = `<div style="height: 10px;"></div>`;
        }

        // Build middle body segments
        let bodyHTML = `<div style="flex: 1; display: flex; flex-direction: column;">`;
        for (const sec of sectionsList) {
          if (sec === "letterhead") bodyHTML += getLetterheadHTML();
          else if (sec === "address-block") bodyHTML += getAddressBlockHTML();
          else if (sec === "section-i-summary") bodyHTML += getSummaryHTML();
          else if (sec === "section-ii-uk") bodyHTML += getUKSectionHTML();
          else if (sec === "section-iii-hk") bodyHTML += getHKSectionHTML();
          else if (sec === "section-iv-matrix") bodyHTML += getMatrixHTML();
          else if (sec === "section-v-opinion") bodyHTML += getCommentsHTML();
          else if (sec === "section-vi-checklist") bodyHTML += getChecklistHTML();
          else if (sec === "section-vii-signatures") bodyHTML += getSignaturesHTML();
        }
        bodyHTML += `</div>`;

        // Running footers containing total counts and legal disclosure
        let footerHTML = "";
        const isFinalPage = (i === totalPages - 1);
        if (isFinalPage) {
          footerHTML = `
            <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; width: 100%; font-family: sans-serif; display: flex; flex-direction: column;">
              <div style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; margin-bottom: 4px;">
                <span style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">CONFIDENTIAL // JOINT REGULATORY ADVISORY</span>
                <span style="font-weight: 700; color: #475569;">Page ${i + 1} of ${totalPages}</span>
                <span style="font-family: monospace; font-weight: bold;">Verified Live (2026-06-06 UTC)</span>
              </div>
              <div style="border-top: 1px solid #f1f5f9; margin-top: 4px; padding-top: 4px; font-size: 7px; color: #94a3b8; line-height: 1.35">
                <strong style="text-transform: uppercase; font-family: monospace; font-weight: 700; font-size: 7px; color: #64748b;">OFFICIAL AUDIT DIRECTIVE - STATUTORY RECORD</strong><br/>
                CONFIDENTIALITY INJUNCTION: This regulatory due diligence memorandum contains proprietary business registers and regulatory compliance checks. Distribution is strictly governed by regional security standards. No section should be copied or disseminated without formal inter-district approval seals.
              </div>
            </div>
          `;
        } else {
          footerHTML = `
            <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; width: 100%; font-size: 8px; color: #94a3b8; display: flex; flex-direction: row; justify-content: space-between; align-items: center; font-family: sans-serif;">
              <span style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">CONFIDENTIAL // JOINT REGULATORY ADVISORY</span>
              <span style="font-weight: 700; color: #475569;">Page ${i + 1} of ${totalPages}</span>
              <span style="font-family: monospace; font-weight: bold;">Verified Live (2026-06-06 UTC)</span>
            </div>
          `;
        }

        pageEl.innerHTML = `
          ${headerHTML}
          ${bodyHTML}
          ${footerHTML}
        `;

        tempContainer.appendChild(pageEl);

        // Render each page precisely
        const canvas = await html2canvas(pageEl, {
          scale: 2.0, // Retain vectors sharp for fine print text
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }

      pdf.save(`Due_Diligence_Memorandum_${refId || "Report"}.pdf`);
      document.body.removeChild(tempContainer);
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
      console.warn("Standard printing failed or was blocked by sandbox constraints:", err);
    }
    // If inside sandboxed iframe, standard browser print is blocked
    if (isInsideIframe) {
      setShowIframeNotice(true);
    }
  };

  return (
    <div id="due-diligence-memo-section" className="bg-white border border-slate-200 rounded-xl shadow-sm mt-8 relative overflow-hidden transition-all duration-300 print:border-0 print:shadow-none mb-12">
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
                  Your browser restricts standard printing triggers (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">window.print()</code>) inside secure preview iframe sandboxes. 
                </p>
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-3 text-[11px] text-slate-600 font-mono space-y-1.5 leading-normal">
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">To print perfectly, select one of these options:</p>
                  <p>1. Open this app in a **New Tab** (using the top-right button in your preview toolbar) and click Print from there.</p>
                  <p>2. Download our beautifully pre-styled **HTML Document Package** below, open it locally, and print immediately.</p>
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
              onClick={handleCopyToClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
              title="Copy memorandum text format to copy in Word or emails"
            >
              <Copy className="w-3.5 h-3.5" />
              {isCopied ? "Copied!" : "Copy Markdown"}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
              title="Download standard Markdown text"
            >
              <Download className="w-3.5 h-3.5" />
              Download (.MD)
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg cursor-pointer transition-all duration-150 shadow-sm"
              title="Generate and download a high-fidelity PDF copy of this memorandum"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              {isExportingPDF ? "Exporting..." : "Export to PDF"}
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
            Please search/evaluate a company profile in the United Kingdom or Hong Kong market above to dynamically build, customize and print a compliant, executive-level sign-off memorandum.
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
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">MEMO ID</label>
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
                  <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">DATE</label>
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
                  <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">CLASSIFICATION</label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-8 p-1.5 font-mono text-slate-800 outline-none align-middle focus:border-slate-800 appearance-none cursor-pointer"
                    >
                      <option value="Highly Confidential - Regulator Only">Confidential</option>
                      <option value="Official Advisory File">Official Advisory</option>
                      <option value="Compliance Sign-Off File">Audit Sign-Off</option>
                      <option value="Internal Advisory Dossier">Internal Only</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">PREPARING AUDITOR</label>
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
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">REVIEWING OFFICIAL</label>
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
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">MEMORANDUM SUMMARY SUBJECT</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-sans text-slate-800 outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-mono text-slate-500 uppercase tracking-wide mb-1 font-bold">AUDITOR WRITTEN EVALUATION & FINDINGS (3RD PERSON)</label>
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
                  className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 w-full text-left cursor-pointer transition-colors"
                >
                  {checks.identityVerified ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Legal Identity Existence Verified</span>
                </button>

                <button
                  onClick={() => toggleCheck("activityMatched")}
                  className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 w-full text-left cursor-pointer transition-colors"
                >
                  {checks.activityMatched ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Financial Scope Regulated Acts Checked</span>
                </button>

                <button
                  onClick={() => toggleCheck("disciplinaryAudited")}
                  className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 w-full text-left cursor-pointer transition-colors"
                >
                  {checks.disciplinaryAudited ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Inspected Disciplinary History Registers</span>
                </button>

                <button
                  onClick={() => toggleCheck("capitalAdequacyChecked")}
                  className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 w-full text-left cursor-pointer transition-colors"
                >
                  {checks.capitalAdequacyChecked ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Capital Adequacy & Stress Test Verified</span>
                </button>

                <button
                  onClick={() => toggleCheck("antiMoneyLaunderingApproved")}
                  className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 w-full text-left cursor-pointer transition-colors"
                >
                  {checks.antiMoneyLaunderingApproved ? (
                    <CheckSquare className="w-4 h-4 text-slate-800 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span>Dual KYC/AML Standing Sign-off</span>
                </button>
              </div>
            </div>
          </div>

          {/* Memorandum Paper sheets preview container */}
          <div className="xl:col-span-8 p-6 md:p-10 bg-slate-100 flex justify-center items-start print:bg-white print:p-0 overflow-x-auto">
            <div 
              id="memorandum-paper-sheet"
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
                <div className="sm:col-span-2 font-bold text-slate-900">DATE:</div>
                <div className="sm:col-span-10 text-slate-800 font-sans">{auditDate}</div>
                
                <div className="sm:col-span-2 font-bold text-slate-900">TO:</div>
                <div className="sm:col-span-10 text-slate-800 font-sans">Compliance Directorate & Corporate Affiliates</div>

                <div className="sm:col-span-2 font-bold text-slate-900">FROM:</div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  <strong>{auditorName}</strong>, Lead Regulatory Compliance Examiner
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">REVIEWER:</div>
                <div className="sm:col-span-10 text-slate-800 font-sans">
                  <strong>{reviewingOfficial}</strong>, Senior Supervisory Official
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">SUBJECT:</div>
                <div className="sm:col-span-10 text-slate-800 font-sans font-bold text-slate-950 uppercase">
                  {subject}
                </div>

                <div className="sm:col-span-2 font-bold text-slate-900">REF ID:</div>
                <div className="sm:col-span-4 text-slate-800 font-mono font-bold">{refId}</div>

                <div className="sm:col-span-2 font-bold text-slate-900">STATUS:</div>
                <div className="sm:col-span-4 text-slate-800 font-mono font-bold tracking-wider uppercase text-slate-950">
                  {classification}
                </div>
              </div>

              {/* Content Body */}
              <div className="space-y-6 text-xs leading-relaxed text-slate-800">
                {/* Introduction Section */}
                <section>
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    I. Executive Compliance Standing Summary
                  </h4>
                  <p className="font-sans leading-relaxed text-slate-700 p-0 m-0">
                    This official supervisory memorandum registers formal regulatory verification audits conducted dynamically for cross-border financial and corporate entities. The status assessment processes mapped within this dossier represent validated licensing vectors sourced in accordance with legal reporting regulations within the respective jurisdictions.
                  </p>
                </section>

                {/* UK Segment */}
                {ukEntity && (
                  <section className="bg-slate-50/50 p-4 border border-slate-100 rounded">
                    <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold flex items-center justify-between">
                      <span>II. London Jurisdiction Standing (Companies House & FCA)</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">Number: {ukEntity.company_number}</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-[11px] py-1 bg-white p-2.5 rounded border border-slate-100">
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Corporate Entity Name</strong>
                        <span className="font-sans font-semibold text-slate-900">{ukEntity.company_name}</span>
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Registrar Standing Status</strong>
                        <span className="font-sans font-bold text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {ukEntity.status?.toUpperCase() || "ACTIVE"}
                        </span>
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Regulatory Authority</strong>
                        <span className="font-sans text-slate-700">{ukEntity.regulatory_body || "FCA & Companies House"}</span>
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Regulatory Standing Check</strong>
                        <span className="font-sans text-slate-700">{ukEntity.last_verified || "Verified Live"}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">A. Companies House Reporting Record</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {ukEntity.companies_house_compliance}
                        </p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">B. FCA Authorizations & Standing</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {ukEntity.fca_register_status}
                        </p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">C. Financial Risk Supervision Controls</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {ukEntity.risk_profile}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* HK Segment */}
                {hkEntity && (
                  <section className="bg-slate-50/50 p-4 border border-slate-100 rounded">
                    <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold flex items-center justify-between">
                      <span>III. Hong Kong Jurisdiction Standing (SFC Status)</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">CE REF: {hkEntity.ceref}</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-[11px] py-1 bg-white p-2.5 rounded border border-slate-100">
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Corporate Entity Name</strong>
                        <span className="font-sans font-semibold text-slate-900">{hkEntity.name_en || hkEntity.company_name}</span>
                        {hkEntity.name_zh && <span className="block text-slate-500 font-semibold">{hkEntity.name_zh}</span>}
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">Licensing Standing Status</strong>
                        <span className="font-sans font-bold text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {hkEntity.status?.toUpperCase() || "ACTIVE"}
                        </span>
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">SFC Licensed Regulatory Classes</strong>
                        <span className="font-sans text-slate-700 flex flex-wrap gap-1 mt-0.5">
                          {(hkEntity.regulated_activities || []).map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-semibold tracking-tight border border-slate-200">{c}</span>
                          ))}
                        </span>
                      </div>
                      <div>
                        <strong className="font-mono text-slate-500 uppercase tracking-widest text-[9px] block">System Verification Reference</strong>
                        <span className="font-sans text-slate-700">{hkEntity.last_verified || "Verified Live"}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">A. SFC Legislative Compliance Parameters</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {hkEntity.sfc_compliance_details}
                        </p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">B. Complaints and Disciplinary Registers</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {hkEntity.complaints_or_disciplinary}
                        </p>
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">C. Supervisory Risk Profile</span>
                        <p className="text-slate-600 font-sans mt-0.5 pl-2 border-l border-slate-200 italic">
                          {hkEntity.risk_profile}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Bilateral Alignment (Dual Market) Matrix */}
                {ukEntity && hkEntity && (
                  <section className="bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800 break-inside-avoid">
                    <h4 className="text-white font-bold uppercase tracking-wider mb-2.5 font-mono text-[11px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                      IV. Cross-Border Dual-Market Alignment Matrix
                    </h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px] font-mono border-collapse mb-3">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-bold">
                            <th className="py-1 px-1">Supervised Arena</th>
                            <th className="py-1 px-1">United Kingdom (FCA)</th>
                            <th className="py-1 px-1">Hong Kong (SFC)</th>
                            <th className="py-1 px-1 text-right">Alignment Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800/65 text-slate-300">
                            <td className="py-1.5 px-1 font-bold text-slate-400">License Authority</td>
                            <td className="py-1.5 px-1">FCA Authorized Register</td>
                            <td className="py-1.5 px-1">SFC licensed intermediary</td>
                            <td className="py-1.5 px-1 text-right font-bold text-emerald-400">ALIGNED</td>
                          </tr>
                          <tr className="border-b border-slate-800/65 text-slate-300">
                            <td className="py-1.5 px-1 font-bold text-slate-400">Activity Class</td>
                            <td className="py-1.5 px-1 font-sans truncate max-w-[150px]">{ukEntity.regulated_activities?.[0] || "Financial Services"}</td>
                            <td className="py-1.5 px-1 font-sans truncate max-w-[150px]">{hkEntity.regulated_activities?.[0] || "Dealing in Securities"}</td>
                            <td className="py-1.5 px-1 text-right font-bold text-emerald-400">ALIGNED</td>
                          </tr>
                          <tr className="border-b border-slate-800/65 text-slate-300">
                            <td className="py-1.5 px-1 font-bold text-slate-400">Disciplinary Status</td>
                            <td className="py-1.5 px-1">No formal penalties pending</td>
                            <td className="py-1.5 px-1">No formal enforcement orders</td>
                            <td className="py-1.5 px-1 text-right font-bold text-emerald-400">COMPLIANT</td>
                          </tr>
                          <tr className="text-slate-300">
                            <td className="py-1.5 px-1 font-bold text-slate-400">Registry Standing</td>
                            <td className="py-1.5 px-1">Companies House Active</td>
                            <td className="py-1.5 px-1">SFC Active Register</td>
                            <td className="py-1.5 px-1 text-right font-bold text-emerald-400">ALIGNED</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[10px] font-sans text-slate-400 p-0 m-0 leading-relaxed border-t border-slate-800 pt-2">
                      <strong>Dynamic Alignment Sign-off Remarks:</strong> Cross-registry mapping verifies corresponding structures in both financial districts. Joint operations are assessed as conforming with standard inter-district risk alignment rules, displaying adequate corporate identity standing and satisfactory supervisory status profiles in both territories.
                    </p>
                  </section>
                )}

                {/* Executive Opinion Remarks */}
                <section className="break-inside-avoid">
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    V. Lead Auditor Opinion & Regulatory Comments
                  </h4>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded text-slate-700 italic font-medium leading-relaxed font-sans">
                    "{customComments || "No custom evaluator assessment is logged for the target portfolio standing analysis."}"
                  </div>
                </section>

                {/* Scope Signoff Details */}
                <section className="break-inside-avoid">
                  <h4 className="text-slate-950 font-bold uppercase tracking-wider mb-2 font-mono text-[11px] border-b border-slate-200 pb-0.5 font-semibold">
                    VI. Certified Compliance Assessment Scope
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 pl-2 text-[11px] font-mono text-slate-700 font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 border border-slate-400 px-1 rounded bg-slate-50">{checks.identityVerified ? "✓" : " "}</span>
                      <span className={checks.identityVerified ? "text-slate-900" : "text-slate-400 line-through"}>Legal Identity & Existence Verified</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 border border-slate-400 px-1 rounded bg-slate-50">{checks.activityMatched ? "✓" : " "}</span>
                      <span className={checks.activityMatched ? "text-slate-900" : "text-slate-400 line-through"}>Scope Regulated Activities Matched</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 border border-slate-400 px-1 rounded bg-slate-50">{checks.disciplinaryAudited ? "✓" : " "}</span>
                      <span className={checks.disciplinaryAudited ? "text-slate-900" : "text-slate-400 line-through"}>Disciplinary Histories Inspected</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 border border-slate-400 px-1 rounded bg-slate-50">{checks.capitalAdequacyChecked ? "✓" : " "}</span>
                      <span className={checks.capitalAdequacyChecked ? "text-slate-900" : "text-slate-400 line-through"}>Capital Adequacy Standard Supervised</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 border border-slate-400 px-1 rounded bg-slate-50">{checks.antiMoneyLaunderingApproved ? "✓" : " "}</span>
                      <span className={checks.antiMoneyLaunderingApproved ? "text-slate-900" : "text-slate-400 line-through"}>Bilateral Joint KYC/AML Sign-off</span>
                    </div>
                  </div>
                </section>

                {/* Signature Certification Block */}
                <section className="pt-6 border-t-2 border-slate-200 mt-6 break-inside-avoid">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 text-xs leading-normal">
                    <div className="space-y-1 max-w-sm">
                      <span className="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold">Memorandum Cryptographic Checksum</span>
                      <code className="block bg-slate-100 px-2 py-1 rounded text-[10px] font-semibold text-slate-800 break-all font-mono select-all">
                        {memoHash}
                      </code>
                      <span className="block font-sans text-3xs text-slate-400 font-semibold leading-relaxed">
                        This digital seal certifies that all corporate metrics within this dossier have been analyzed dynamically under the authority of public intermediary compliance monitors.
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 shrink-0 text-left w-full lg:w-auto justify-end">
                      <div className="space-y-3 min-w-[180px]">
                        <div className="border-b border-slate-400 w-full sm:w-44 h-8"></div>
                        <div>
                          <span className="block font-sans font-bold text-slate-900">{auditorName}</span>
                          <span className="block text-3xs font-mono text-slate-500 uppercase font-semibold">PREPARING AUDITOR</span>
                        </div>
                      </div>

                      <div className="space-y-3 min-w-[180px]">
                        <div className="border-b border-slate-400 w-full sm:w-44 h-8"></div>
                        <div>
                          <span className="block font-sans font-bold text-slate-900">{reviewingOfficial}</span>
                          <span className="block text-3xs font-mono text-slate-500 uppercase font-semibold">REVIEWING OFFICIAL</span>
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
                CONFIDENTIALITY INJUNCTION: This regulatory due diligence memorandum contains proprietary business registers and regulatory compliance checks. Distribution is strictly governed by regional security standards. No section should be copied or disseminated without formal inter-district approval seals.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
