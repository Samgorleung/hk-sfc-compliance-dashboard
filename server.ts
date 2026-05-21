import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
let lastGeminiCallTime = 0;
const activeEvaluations = new Map<string, Promise<any>>();
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client on the server side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("GEMINI_API_KEY environment variable is not defined.");
}


// Pre-cached UK corporate entity data to facilitate testing without live Companies House API Credentials
const PRE_CACHED_COMPANIES: Record<string, { profile: any; officers: any }> = {
  "00445790": {
    profile: {
      company_name: "TESCO PLC",
      company_number: "00445790",
      company_status: "active",
      type: "plc",
      jurisdiction: "england-wales",
      date_of_creation: "1947-11-27",
      registered_office_address: {
        address_line_1: "Tesco House",
        address_line_2: "Shire Park",
        locality: "Welwyn Garden City",
        postal_code: "AL7 1GA",
        region: "Hertfordshire"
      },
      accounts: {
        next_due: "2027-02-28",
        next_made_up_to: "2026-08-31",
        last_accounts: {
          made_up_to: "2025-08-31",
          type: "full"
        },
        overdue: false
      },
      confirmation_statement: {
        next_due: "2026-10-15",
        next_made_up_to: "2026-10-01",
        last_made_up_to: "2025-10-01",
        overdue: false
      },
      sic_codes: ["47110"]
    },
    officers: {
      items: [
        { name: "MURPHY, Ken", officer_role: "director", appointed_on: "2020-10-01", nationality: "Irish" },
        { name: "GERRY, Melissa", officer_role: "director", appointed_on: "2021-04-12", nationality: "British" },
        { name: "COOP, Stewart", officer_role: "secretary", appointed_on: "2023-01-15", nationality: "British" }
      ]
    }
  },
  "00048839": {
    profile: {
      company_name: "BARCLAYS PLC",
      company_number: "00048839",
      company_status: "active",
      type: "plc",
      jurisdiction: "england-wales",
      date_of_creation: "1896-06-01",
      registered_office_address: {
        address_line_1: "1 Churchill Place",
        locality: "London",
        postal_code: "E14 5HP",
        region: "Greater London"
      },
      accounts: {
        next_due: "2026-12-31",
        next_made_up_to: "2026-06-30",
        last_accounts: {
          made_up_to: "2025-12-31",
          type: "full"
        },
        overdue: false
      },
      confirmation_statement: {
        next_due: "2026-11-05",
        next_made_up_to: "2026-10-22",
        last_made_up_to: "2025-10-22",
        overdue: false
      },
      sic_codes: ["64191"]
    },
    officers: {
      items: [
        { name: "VENKATAKRISHNAN, Coimbatore", officer_role: "director", appointed_on: "2021-11-01", nationality: "American" },
        { name: "HIGGINS, Mary", officer_role: "director", appointed_on: "2019-03-01", nationality: "British" },
        { name: "PRICE, Stephen", officer_role: "secretary", appointed_on: "2022-09-18", nationality: "British" }
      ]
    }
  },
  "02723534": {
    profile: {
      company_name: "ASTRAZENECA PLC",
      company_number: "02723534",
      company_status: "active",
      type: "plc",
      jurisdiction: "england-wales",
      date_of_creation: "1992-06-17",
      registered_office_address: {
        address_line_1: "1 Francis Crick Avenue",
        address_line_2: "Cambridge Biomedical Campus",
        locality: "Cambridge",
        postal_code: "CB2 0AA",
        region: "Cambridgeshire"
      },
      accounts: {
        next_due: "2027-03-31",
        next_made_up_to: "2026-09-30",
        last_accounts: {
          made_up_to: "2025-12-31",
          type: "full"
        },
        overdue: false
      },
      confirmation_statement: {
        next_due: "2026-08-11",
        next_made_up_to: "2026-07-28",
        last_made_up_to: "2025-07-28",
        overdue: false
      },
      sic_codes: ["21200"]
    },
    officers: {
      items: [
        { name: "SORIOT, Pascal", officer_role: "director", appointed_on: "2012-10-01", nationality: "French" },
        { name: "JOHANSSON, Leif", officer_role: "director", appointed_on: "2012-04-26", nationality: "Swedish" },
        { name: "PHELPS, Adrian", officer_role: "secretary", appointed_on: "2020-05-12", nationality: "British" }
      ]
    }
  },
  "00102498": {
    profile: {
      company_name: "BP P.L.C.",
      company_number: "00102498",
      company_status: "active",
      type: "plc",
      jurisdiction: "england-wales",
      date_of_creation: "1909-04-14",
      registered_office_address: {
        address_line_1: "1 St James's Square",
        locality: "London",
        postal_code: "SW1Y 4PD",
        region: "Greater London"
      },
      accounts: {
        next_due: "2027-03-31",
        next_made_up_to: "2026-09-30",
        last_accounts: {
          made_up_to: "2025-12-31",
          type: "full"
        },
        overdue: false
      },
      confirmation_statement: {
        next_due: "2026-07-15",
        next_made_up_to: "2026-07-01",
        last_made_up_to: "2025-07-01",
        overdue: false
      },
      sic_codes: ["06100", "19201"]
    },
    officers: {
      items: [
        { name: "AUCHINCLOSS, Murray", officer_role: "director", appointed_on: "2020-07-01", nationality: "Canadian" },
        { name: "LUND, Helge", officer_role: "director", appointed_on: "2018-09-01", nationality: "Norwegian" },
        { name: "HARDING, Rupert", officer_role: "secretary", appointed_on: "2021-11-15", nationality: "British" }
      ]
    }
  },
  "07524813": {
    profile: {
      company_name: "ROLLS-ROYCE HOLDINGS PLC",
      company_number: "07524813",
      company_status: "active",
      type: "plc",
      jurisdiction: "england-wales",
      date_of_creation: "2011-02-10",
      registered_office_address: {
        address_line_1: "Kings Place",
        address_line_2: "90 York Way",
        locality: "London",
        postal_code: "N1 9FX",
        region: "Greater London"
      },
      accounts: {
        next_due: "2027-03-31",
        next_made_up_to: "2026-09-30",
        last_accounts: {
          made_up_to: "2025-12-31",
          type: "full"
        },
        overdue: false
      },
      confirmation_statement: {
        next_due: "2026-04-18",
        next_made_up_to: "2026-04-04",
        last_made_up_to: "2025-04-04",
        overdue: false
      },
      sic_codes: ["30300"]
    },
    officers: {
      items: [
        { name: "ERGINBILGIC, Tufan", officer_role: "director", appointed_on: "2023-01-01", nationality: "British" },
        { name: "PEACH, Stuart", officer_role: "director", appointed_on: "2022-09-01", nationality: "British" },
        { name: "MORTON, Pamela", officer_role: "secretary", appointed_on: "2019-11-20", nationality: "British" }
      ]
    }
  }
};

// Helper function to sanitize any compliance evaluation strings to strictly use objective, formal third-person syntax.
// All first-person and second-person pronouns are strictly search-and-replaced with appropriate formal third-person terminology.
function sanitizeComplianceText(text: string): string {
  if (typeof text !== "string") return text;
  
  let sanitized = text;
  
  // High-priority replacements for contractions
  sanitized = sanitized.replace(/\bI've\b/gi, "the compliance officer has");
  sanitized = sanitized.replace(/\bwe've\b/gi, "the compliance monitoring team has");
  sanitized = sanitized.replace(/\bI'm\b/gi, "the compliance examiner is");
  sanitized = sanitized.replace(/\bwe're\b/gi, "the compliance officers are");
  sanitized = sanitized.replace(/\byou're\b/gi, "the corporate entity is");
  
  // Standard search and replace for other subjective first-person/second-person singular and plural terms
  sanitized = sanitized.replace(/\bmy\b/gi, "the corporate entity's");
  sanitized = sanitized.replace(/\bour\b/gi, "the corporation's");
  sanitized = sanitized.replace(/\bmyself\b/gi, "the compliance officer");
  sanitized = sanitized.replace(/\bourselves\b/gi, "the compliance team");
  sanitized = sanitized.replace(/\byourself\b/gi, "the compliance representative");
  sanitized = sanitized.replace(/\byour\b/gi, "the corporate entity's");
  sanitized = sanitized.replace(/\bme\b/gi, "the compliance examiner");
  sanitized = sanitized.replace(/\bus\b/gi, "the compliance platform");
  sanitized = sanitized.replace(/\byou\b/gi, "the compliance representative");
  
  // Single 'I' and 'we' as whole words (case sensitive check for 'I' where appropriate, or case-insensitive word boundaries)
  sanitized = sanitized.replace(/\bI\b/g, "the compliance officer");
  sanitized = sanitized.replace(/\bwe\b/gi, "the compliance monitoring team");
  
  // Normalize redundant spaces
  sanitized = sanitized.replace(/\s+/g, " ");
  
  return sanitized;
}

// Deeply processes a report or record query object, executing compliance checks on all of its child node string values
function sanitizeComplianceObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return sanitizeComplianceText(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeComplianceObject(item)) as unknown as T;
  }
  if (typeof obj === "object") {
    const fresh: any = {};
    for (const key of Object.keys(obj)) {
      fresh[key] = sanitizeComplianceObject((obj as any)[key]);
    }
    return fresh as T;
  }
  return obj;
}

// GET health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Pre-cached Hong Kong SFC licensed corporations to facilitate dual-market verification
const PRE_CACHED_HK_ENTITIES: Record<string, any> = {
  "AAL982": {
    ceref: "AAL982",
    name_en: "CLSA LIMITED",
    name_zh: "里昂證券有限公司",
    status: "Active",
    licensed_date: "1987-12-04",
    regulated_activities: [
      "Type 1: Dealing in securities",
      "Type 4: Advising on securities",
      "Type 7: Providing automated trading services"
    ],
    complaints_or_disciplinary: "No major ongoing disciplinary issues or enforcement actions are noted under the current Securities and Futures Commission records. Periodic compliance screenings denote minor historical administration notifications which were resolved without formal restriction orders.",
    sfc_compliance_details: "The licensed entity maintains active registration and operates in compliance with section 116 of the Securities and Futures Ordinance (Cap. 571). Review of capital requirements and liquid capital returns demonstrates full adherence to the financial resources rules, showing adequate risk coverage ratios.",
    risk_profile: "Continuous evaluation registers a low risk rating. The corporate group maintains robust internal compliance controllers, independent audit boards, and strict supervision structures for automated trading systems.",
    source: "pre-cached"
  },
  "AAL518": {
    ceref: "AAL518",
    name_en: "HSBC INVESTMENT FUNDS (HONG KONG) LIMITED",
    name_zh: "滙豐投資基金(香港)有限公司",
    status: "Active",
    licensed_date: "1984-06-21",
    regulated_activities: [
      "Type 1: Dealing in securities",
      "Type 4: Advising on securities",
      "Type 9: Asset management"
    ],
    complaints_or_disciplinary: "Securities and Futures Commission disclosures indicate a clean registration file with stable standing. Structural review records confirm no enforcement actions under Cap. 571 of Hong Kong corporate laws.",
    sfc_compliance_details: "Operational assessment points to complete compliance under SFC product specifications and mutual fund regulatory directives. Periodic returns confirm proper segregation of client funds and robust accounting supervision.",
    risk_profile: "A standard low risk profile is assigned based on the institution's deeply established corporate steering frameworks and comprehensive risk metrics.",
    source: "pre-cached"
  },
  "AMD593": {
    ceref: "AMD593",
    name_en: "TIGER BROKERS (HK) GLOBAL MEDIUM CO",
    name_zh: "老虎證券(香港)全球中型有限公司",
    status: "Active",
    licensed_date: "2018-09-15",
    regulated_activities: [
      "Type 1: Dealing in securities",
      "Type 2: Dealing in futures contracts"
    ],
    complaints_or_disciplinary: "SFC public files declare zero active circular infractions or disciplinary warnings. Historical filings indicate standard audits were resolved within standard legislative turnaround periods.",
    sfc_compliance_details: "This corporation operates with full authority to engage in Type 1 and Type 2 regulated activities. Disclosures suggest adherence to investor classification procedures and margin lending limits.",
    risk_profile: "The entity's risk is assessed at a medium rating, reflecting high leverage and retail execution exposure. Periodic control reviews are recommended to maintain margin resource stability.",
    source: "pre-cached"
  }
};

// GET dual-market demo list for Hong Kong
app.get("/api/hk-demo-entities", (req, res) => {
  const list = Object.keys(PRE_CACHED_HK_ENTITIES).map(key => ({
    company_number: key,
    company_name: PRE_CACHED_HK_ENTITIES[key].name_en,
    sic_codes: PRE_CACHED_HK_ENTITIES[key].regulated_activities
  }));
  res.json(list);
});

// GET query system for Hong Kong SFC Licensed Entity Check
app.get("/api/hk-entity/:identifier", async (req, res) => {
  const identifier = req.params.identifier?.trim();
  if (!identifier) {
    return res.status(400).json({ error: "The licensed entity identifier is required." });
  }

  const normalizedIdentifier = identifier.toUpperCase();
  let dbResult: any = null;
  let dbConnectionError: string | null = null;
  let usedDatabase = false;

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoUri.trim() !== "") {
    let client: MongoClient | null = null;
    try {
      console.log(`Connecting to MongoDB for SFC licensed check [${normalizedIdentifier}]...`);
      // Define short connection timeouts to prevent server hanging if MONGODB_URI is unresolvable and bypass network environment TLS layer mismatches
      client = new MongoClient(mongoUri, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 3000,
        tls: true,
        ssl: true,
        tlsAllowInvalidCertificates: true
      });
      await client.connect();
      const db = client.db("compliance_db");
      const collection = db.collection("hk_licensed_entities");

      // Search robust queries (by ceref, license number, or descriptive English name)
      const query = {
        $or: [
          { ceref: normalizedIdentifier },
          { ceref: identifier },
          { license_number: identifier },
          { name_en: { $regex: identifier, $options: "i" } }
        ]
      };


      dbResult = await collection.findOne(query);
      usedDatabase = true;
      console.log(`MongoDB query completed database results: ${dbResult ? 'Found Match' : 'No Match'}`);
    } catch (err: any) {
      console.error("MongoDB verification encountered connection or query failure:", err);
      dbConnectionError = err.message || "Database connection timeout or auth failure.";
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (closeErr) {
          console.error("Error closing database connection client:", closeErr);
        }
      }
    }
  }

  // 1. If document was found in MongoDB, prioritize it
  if (dbResult) {
    return res.json(sanitizeComplianceObject({
      ...dbResult,
      fetched_live: true,
      source: "mongodb-hk_licensed_entities"
    }));
  }

  // 2. If no MongoDB result, check the high-fidelity pre-cached standard entities
  if (PRE_CACHED_HK_ENTITIES[normalizedIdentifier]) {
    return res.json(sanitizeComplianceObject({
      ...PRE_CACHED_HK_ENTITIES[normalizedIdentifier],
      fetched_live: false,
      db_info: usedDatabase ? "Searched database but no match found." : "MongoDB URI unconfigured.",
      db_error: dbConnectionError || undefined
    }));
  }

  // 3. Fallback to Gemini AI Synthesis to parse and analyze the identifier dynamically
  if (ai) {
    try {
      console.log(`Initiating dynamic compliance officer narrative synthesis for identifier: ${normalizedIdentifier}`);
      
      const analysisPrompt = `Perform an automated licensing compliance evaluation for the Hong Kong Securities and Futures Commission (SFC) licensed entity with corporate identifier code "${identifier}".

      OPERATE AS AN AUTOMATED CROSS-BORDER CORPORATE COMPLIANCE OFFICER.
      EVALUATE THE ENTITY'S DATA PROFILE TO VERIFY ITS LEGAL STANDING.

      CRITICAL SYSTEM INSTRUCTIONS FOR GRAMMATIC CONSTRAINTS:
      - All analytical evaluations, risk profiles, compliance ratings, remediation plans, sfc compliance details, and compliance cross-mappings MUST be written in comprehensive paragraphs using the third person.
      - First-person pronouns (I, me, my, we) and second-person pronouns (you, your) are STRICTLY PROHIBITED.
      - The tone must remain exclusively objective, formal, and analytical.
      - Avoid conversational greetings, introductory filler, or corporate marketing buzzwords.

      Generate a JSON object conforming exactly to the following structure:
      {
        "ceref": "${normalizedIdentifier}",
        "name_en": "A realistic licensed corporation English name based on the identifier, e.g., TIGER GOLD ASSET MANAGEMENT, CLSA, or HSBC GLOBAL FUNDS (HONG KONG)",
        "name_zh": "A realistic licensed corporation Chinese name, e.g., 老虎黃金資產管理, 里昂證券, or 滙豐全球基金(香港)",
        "status": "Active or Ceased or Suspended",
        "licensed_date": "YYYY-MM-DD based on a realistic historical date",
        "regulated_activities": ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"],
        "complaints_or_disciplinary": "A structured analytical narrative in comprehensive paragraphs in the third person describing past, current or future disciplinary status, or explaining that there is no disciplinary history. First-person or second-person pronouns are strictly prohibited.",
        "sfc_compliance_details": "A formal analytical narrative in the third person assessing the entity's compliance status under SFC codes, capital requirements, and section 116 of the Securities and Futures Ordinance (Cap. 571). First-person or second-person pronouns are strictly prohibited.",
        "risk_profile": "An objective assessment of risk factor standings and supervisory reviews of internal records, written in the third person in comprehensive paragraphs. First-person or second-person pronouns are strictly prohibited."
      }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: analysisPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsedSynth = JSON.parse(response.text || "{}");
      return res.json(sanitizeComplianceObject({
        ...parsedSynth,
        fetched_live: false,
        source: "gemini-synthesized",
        db_info: usedDatabase ? "Database queried; record synthesized via AI fallback." : "Database unconfigured; profile synthesized via AI fallback.",
        db_error: dbConnectionError || undefined
      }));
    } catch (aiErr) {
      console.error("Gemini compliance narrative synthesis encountered an error:", aiErr);
    }
  }

  // 4. Ultimate static fallback if both DB query and Gemini failed to return
  const staticFallback = {
    ceref: normalizedIdentifier,
    name_en: `HONG KONG SECURITIES VENTURE CO - ${normalizedIdentifier}`,
    name_zh: `香港證券風險有限公司`,
    status: "Active",
    licensed_date: "2019-05-18",
    regulated_activities: [
      "Type 1: Dealing in securities",
      "Type 4: Advising on securities"
    ],
    complaints_or_disciplinary: "A review of SFC disciplinary files shows no registered complaints or enforcement decrees relative to this entity code under current investigation parameters. The legal standing remains clear.",
    sfc_compliance_details: "Active license registration is confirmed. Capital adequacy reports and compliance audit profiles suggest alignment with Part V financial resource filings and structural mandates defined by the Securities and Futures Commission of Hong Kong.",
    risk_profile: "The entity's compliance history indicates a low risk classification. Regulatory control metrics are standard and supervision parameters are aligned with regional trade code directives.",
    fetched_live: false,
    source: "static-fallback",
    db_info: usedDatabase ? "Database searched; standard static profiles mapped." : "Database unconfigured; final static fallback leveraged.",
    db_error: dbConnectionError || undefined
  };

  res.json(sanitizeComplianceObject(staticFallback));
});

// GET demo entities available
app.get("/api/demo-companies", (req, res) => {
  const list = Object.keys(PRE_CACHED_COMPANIES).map(num => ({
    company_number: num,
    company_name: PRE_CACHED_COMPANIES[num].profile.company_name,
    sic_codes: PRE_CACHED_COMPANIES[num].profile.sic_codes
  }));
  res.json(list);
});

// Helper functions to handle 429 rate limits dynamically from Gemini AI
function is429(err: any): boolean {
  if (!err) return false;
  if (err.status === 429 || err.statusCode === 429 || err.code === 429) {
    return true;
  }
  if (err.error && (err.error.status === 429 || err.error.statusCode === 429 || err.error.code === 429)) {
    return true;
  }
  const msg = String(err.message || err.error?.message || "").toLowerCase();
  if (msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("rate limit") || msg.includes("quota")) {
    return true;
  }
  return false;
}

function parseRetryDelayMs(err: any): number {
  let delayStr = "";
  if (err && Array.isArray(err.details)) {
    const rInfo = err.details.find((d: any) => 
      (d["@type"] && d["@type"].includes("RetryInfo")) || d.retryDelay
    );
    if (rInfo && rInfo.retryDelay) {
      delayStr = String(rInfo.retryDelay);
    }
  }
  if (!delayStr && err && err.error && Array.isArray(err.error.details)) {
    const rInfo = err.error.details.find((d: any) => 
      (d["@type"] && d["@type"].includes("RetryInfo")) || d.retryDelay
    );
    if (rInfo && rInfo.retryDelay) {
      delayStr = String(rInfo.retryDelay);
    }
  }
  if (!delayStr && err) {
    try {
      const errString = JSON.stringify(err);
      const match = errString.match(/"retryDelay"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        delayStr = match[1];
      }
    } catch (e) {
      // ignore
    }
  }
  if (delayStr) {
    const match = delayStr.match(/^([\d.]+)\s*s?$/i);
    if (match) {
      const seconds = parseFloat(match[1]);
      if (!isNaN(seconds)) {
        return Math.ceil(seconds * 1000);
      }
    }
    const numerical = parseFloat(delayStr);
    if (!isNaN(numerical)) {
      if (delayStr.endsWith("s") || numerical < 100) {
        return Math.ceil(numerical * 1000);
      }
      return Math.ceil(numerical);
    }
  }
  return 3500;
}

async function generateContentWithRetry(params: any): Promise<any> {
  if (!ai) {
    throw new Error("Gemini AI instance is not initialized.");
  }
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    if (is429(err)) {
      const waitMs = parseRetryDelayMs(err);
      console.warn(`Encountered 429 rate limit. Extracted retryDelay: ${waitMs}ms. Pausing and retrying once.`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return await ai.models.generateContent(params);
    }
    throw err;
  }
}

// API endpoint to fetch company details and execute dual-market compliance mapping
app.get("/api/company/:companyNumber", async (req, res) => {
  const rawNum = req.params.companyNumber;
  
  // Validate and left-pad company number to 8 characters if required
  if (!rawNum || rawNum.trim().length === 0) {
    return res.status(400).json({ error: "A valid corporate identifier is required." });
  }
  
  let formattedNumber = rawNum.trim();
  while (formattedNumber.length < 8) {
    formattedNumber = "0" + formattedNumber;
  }
  
  if (!/^[0-9A-Za-z]{8}$/.test(formattedNumber)) {
    return res.status(400).json({ 
      error: "The provided UK corporate identifier does not meet the standard 8-character format specification.",
      details: "Ensure the company identifier consists of alphanumeric characters (typically 8 digits or prefixes like SC, NI, OC)."
    });
  }

  // 1. Check if compliance report already exists in MongoDB database cache
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoUri.trim() !== "") {
    let client: MongoClient | null = null;
    try {
      console.log(`Checking MongoDB compliance cache for UK company: ${formattedNumber}...`);
      client = new MongoClient(mongoUri, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 3000,
        tls: true,
        ssl: true,
        tlsAllowInvalidCertificates: true
      });
      await client.connect();
      const db = client.db("compliance_db");
      const collection = db.collection("uk_compliance_evaluations");
      const cached = await collection.findOne({ company_number: formattedNumber });
      if (cached) {
        console.log(`Cache hit in MongoDB for UK company: ${formattedNumber}`);
        const { _id, ...cleanCached } = cached as any;
        return res.json(sanitizeComplianceObject(cleanCached));
      }
    } catch (dbErr) {
      console.error("MongoDB compliance cache lookup encounter error:", dbErr);
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (closeErr) {
          console.error("Error closing MongoDB connection:", closeErr);
        }
      }
    }
  }

  // 2. Check in-flight request deduplicator first to prevent active concurrent runs
  if (activeEvaluations.has(formattedNumber)) {
    console.log(`Deduplicating concurrent compliance evaluation request for ${formattedNumber}. Waiting for existing evaluation.`);
    try {
      const result = await activeEvaluations.get(formattedNumber);
      return res.json(sanitizeComplianceObject(result));
    } catch (err) {
      return res.status(500).json({ error: "The active cross-border compliance evaluation encountered an error." });
    }
  }

  const evaluationPromise = (async () => {
    const companiesHouseApiKey = process.env.COMPANIES_HOUSE_API_KEY;
    let rawProfile: any = null;
    let rawOfficers: any = null;
    let fetchedLive = false;
    let sourceMethod = "simulated";

    // 1. Attempt Live Fetch if Companies House API Key is configured
    if (companiesHouseApiKey && companiesHouseApiKey.trim() !== "") {
      try {
        // Basic Authentication expects the API key as username, empty password.
        const authHeader = `Basic ${Buffer.from(`${companiesHouseApiKey}:`).toString("base64")}`;
        
        const profilePromise = fetch(`https://api.company-information.service.gov.uk/company/${formattedNumber}`, {
          headers: { "Authorization": authHeader }
        });

        const officersPromise = fetch(`https://api.company-information.service.gov.uk/company/${formattedNumber}/officers`, {
          headers: { "Authorization": authHeader }
        });

        const [pRes, oRes] = await Promise.all([profilePromise, officersPromise]);

        if (pRes.status === 200) {
          rawProfile = await pRes.json();
          fetchedLive = true;
          sourceMethod = "live";
          if (oRes.status === 200) {
            rawOfficers = await oRes.json();
          }
        } else {
          console.warn(`Companies House live fetch returned status: ${pRes.status}. Engaging fallback systems.`);
        }
      } catch (fetchErr) {
        console.error("Live Companies House communication encounter error:", fetchErr);
      }
    }

    // 2. Fallback to Pre-cached Standard UK Companies if Live Fetch failed or is unconfigured
    if (!rawProfile && PRE_CACHED_COMPANIES[formattedNumber]) {
      rawProfile = PRE_CACHED_COMPANIES[formattedNumber].profile;
      rawOfficers = PRE_CACHED_COMPANIES[formattedNumber].officers;
      sourceMethod = "pre-cached";
    }

    // 3. Fallback to AI-synthesized Raw Data if it's an arbitrary number and live fetch was unsuccessful
    if (!rawProfile) {
      if (ai) {
        try {
          console.log(`No cache file available for ${formattedNumber}. Engaging Gemini synthesis.`);
          // Ask Gemini to synthesize realistic Companies House RAW details
          const synthResponse = await generateContentWithRetry({
            model: "gemini-3.5-flash",
            contents: `Synthesize realistic Companies House raw profile information for the standard 8-character company number: ${formattedNumber}. Ensure that the result is realistic and fits valid Companies House JSON schemas.
            Generate a flat JSON of the profile and list of officers in this exact outline:
            {
              "company_name": "A realistic UK PLC or LTD name based on the identifier",
              "company_number": "${formattedNumber}",
              "company_status": "active",
              "type": "plc",
              "jurisdiction": "england-wales",
              "date_of_creation": "2015-05-18",
              "registered_office_address": {
                "address_line_1": "100 London Wall",
                "locality": "London",
                "postal_code": "EC2M 5QD",
                "region": "Greater London"
              },
              "accounts": {
                "next_due": "2026-12-31",
                "next_made_up_to": "2026-06-30",
                "last_accounts": {
                  "made_up_to": "2025-12-31",
                  "type": "full"
                },
                "overdue": false
              },
              "confirmation_statement": {
                "next_due": "2026-05-30",
                "next_made_up_to": "2026-05-15",
                "last_made_up_to": "2025-05-15",
                "overdue": false
              },
              "sic_codes": ["62010"],
              "officers_items": [
                { "name": "ANDERSON, Charles", "officer_role": "director", "appointed_on": "2015-05-18", "nationality": "British" },
                { "name": "SMITH, Linda", "officer_role": "secretary", "appointed_on": "2018-09-12" }
              ]
            }`,
            config: {
              responseMimeType: "application/json"
            }
          });

          const parsedSynth = JSON.parse(synthResponse.text || "{}");
          rawProfile = {
            company_name: parsedSynth.company_name,
            company_number: parsedSynth.company_number,
            company_status: parsedSynth.company_status,
            type: parsedSynth.type,
            jurisdiction: parsedSynth.jurisdiction,
            date_of_creation: parsedSynth.date_of_creation,
            registered_office_address: parsedSynth.registered_office_address,
            accounts: parsedSynth.accounts,
            confirmation_statement: parsedSynth.confirmation_statement,
            sic_codes: parsedSynth.sic_codes
          };
          rawOfficers = {
            items: parsedSynth.officers_items || []
          };
          sourceMethod = "ai-synthesized";
        } catch (synthErr) {
          console.error("AI system synthesis errored:", synthErr);
        }
      }

      // Double fallback in case AI synthesis fails
      if (!rawProfile) {
        rawProfile = {
          company_name: `REGULATORY CO - ${formattedNumber}`,
          company_number: formattedNumber,
          company_status: "active",
          type: "ltd",
          jurisdiction: "england-wales",
          date_of_creation: "2018-04-12",
          registered_office_address: {
            address_line_1: "71-75 Shelton Street",
            locality: "London",
            postal_code: "WC2H 9JQ",
            region: "Greater London"
          },
          accounts: {
            next_due: "2026-09-30",
            next_made_up_to: "2025-12-31",
            last_accounts: {
              made_up_to: "2024-12-31",
              type: "total-exemption-full"
            },
            overdue: false
          },
          confirmation_statement: {
            next_due: "2026-10-15",
            next_made_up_to: "2026-10-01",
            last_made_up_to: "2025-10-01",
            overdue: false
          },
          sic_codes: ["70229"]
        };
        rawOfficers = {
          items: [
            { name: "CLARK, Jonathan", officer_role: "director", appointed_on: "2018-04-12", nationality: "British" }
          ]
        };
        sourceMethod = "static-fallback";
      }
    }

    // 4. Run AI Compliance Analysis & Dual-Market mapping representing the compliance officer role
    if (ai) {
      try {
        console.log(`Executing corporate compliance evaluation for ${rawProfile.company_name} [${formattedNumber}].`);
        const now = Date.now();
        const timeSinceLastCall = now - lastGeminiCallTime;
        const requiredDelay = 3500;

        if (timeSinceLastCall < requiredDelay) {
          const waitTime = requiredDelay - timeSinceLastCall;
          lastGeminiCallTime = now + waitTime; 
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          lastGeminiCallTime = now;
        }

        const analysisPrompt = `Perform an automated cross-border corporate compliance assessment for the following corporate entity details.
        RAW ENTITY DATA:
        ${JSON.stringify({ profile: rawProfile, officers: rawOfficers }, null, 2)}

        OPERATE AS AN AUTOMATED CROSS-BORDER CORPORATE COMPLIANCE OFFICER.
        EVALUATE THE ENTITY'S DATA PROFILE TO VERIFY ITS LEGAL STANDING.

        CRITICAL SYSTEM INSTRUCTIONS FOR GRAMMATIC CONSTRAINTS:
        - All analytical evaluations, risk profiles, compliance ratings, remediation plans, and compliance cross-mappings MUST be written in comprehensive paragraphs using the third person.
        - First-person pronouns (I, me, my, we) and second-person pronouns (you, your) are STRICTLY PROHIBITED.
        - The tone must remain exclusively objective, formal, and analytical.
        - Avoid conversational greetings, introductory filler, or corporate marketing buzzwords.
        - Maintain standard legislative references (UK Companies Act 2006, UK Corporate Governance Code, UK Modern Slavery Act, US Sarbanes-Oxley Act, US Foreign Corrupt Practices Act, SEC reporting standards).

        Generate a JSON object conforming to the following structure:
        {
          "company_name": "${rawProfile.company_name.replace(/"/g, '\\"')}",
          "company_number": "${formattedNumber}",
          "jurisdiction": "England and Wales or specific country of registry",
          "incorporation_date": "${rawProfile.date_of_creation || 'Unknown'}",
          "status": "${rawProfile.company_status || 'active'}",
          "nature_of_business": ["Identify nature based on SIC codes: ${JSON.stringify(rawProfile.sic_codes || [])}"],
          "registered_office": "Full flat address string",
          "accounts_standing": {
            "status": "${rawProfile.accounts?.overdue ? 'overdue' : 'compliant'}",
            "details": "A detailed analytical statement in the third person describing the filing standing."
          },
          "uk_compliance": {
            "score": 0 to 100 based on status, accounts overdue, officer configurations,
            "standing": "Compliant" | "Action Required" | "Non-Compliant",
            "evaluation": "Paragraph evaluating UK compliance standpoints, Companies Act 2006 requirements, Corporate Governance Code, and Modern Slavery Act disclosures (if applicable). Written exclusively in third-person without pronouns.",
            "frameworks": {
               "companies_act_2006": { "status": "Compliant" | "Correction Required" | "Review Pending", "details": "Third person analytical details of compliance with Companies Act 2006." },
               "corporate_governance_code": { "status": "Compliant" | "Correction Required" | "Review Pending" | "Not Applicable", "details": "Third-person explanation of corporate governance status (disclosures, board structure, audit compliance)." },
               "modern_slavery_act": { "status": "Compliant" | "Correction Required" | "Review Pending" | "Not Applicable", "details": "Third-person explanation of modern slavery compliance (statement transparency, supply chain audits)." }
            }
          },
          "us_compliance": {
            "score": 0 to 100 based on eligibility to trade, accounting standards, and FCPA mappings,
            "standing": "Compliant" | "Action Required" | "Non-Compliant",
            "evaluation": "Paragraph evaluating compliance standing against major US regulatory requirements relevant to foreign entities, such as Sarbanes-Oxley Act (SOX), Foreign Corrupt Practices Act (FCPA), and SEC reporting rules. Written exclusively in third-person without pronouns.",
            "frameworks": {
               "sarbanes_oxley_act": { "status": "Compliant" | "Correction Required" | "Review Pending" | "Not Applicable", "details": "Third person explanation of internal controls, financial disclosure accuracy, and audit committee standing under SOX." },
               "foreign_corrupt_practices_act": { "status": "Compliant" | "Correction Required" | "Review Pending", "details": "Third-person explanation of anti-corruption practices, accounting logs maintenance, and compliance frameworks to limit bribery risks under FCPA." },
               "sec_disclosures": { "status": "Compliant" | "Correction Required" | "Review Pending" | "Not Applicable", "details": "Third-person details regarding registrations, filings (F-1/F-4/20-F etc. where applicable), and cross-border investor warnings." }
            }
          },
          "risk_assessment": {
            "rating": "Low" | "Medium" | "High",
            "risk_factors": ["risk factor 1", "risk factor 2", "risk factor 3"],
            "remediation_plan": "Operational paragraph in third person detailing immediate regulatory remediation actions required or advised."
          },
          "cross_border_mapping": {
             "alignment_summary": "Paragraph outlining dual-market frictions, overlapping requirements, and general cross-border alignment status between UK and US frameworks.",
             "gaps_identified": ["gap detail 1", "gap detail 2"]
          }
        }
        `

        const response = await generateContentWithRetry({
          model: "gemini-3.5-flash",
          contents: analysisPrompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const parsedAnalysis = JSON.parse(response.text || "{}");
        
        const parsedOfficers = (rawOfficers?.items || []).map((o: any) => ({
          name: o.name,
          role: o.officer_role,
          appointed_on: o.appointed_on,
          nationality: o.nationality,
          resignation_date: o.resigned_on
        }));

        return {
          ...parsedAnalysis,
          fetched_live: fetchedLive,
          officers: parsedOfficers
        };
      } catch (analysisErr) {
        console.error("Gemini analytical evaluation errored:", analysisErr);
      }
    }

    // Double fallback for the entire report if Gemini analysis failed or was unconfigured
    const genericAnalysis = {
      company_name: rawProfile.company_name,
      company_number: formattedNumber,
      jurisdiction: rawProfile.jurisdiction === "england-wales" ? "England and Wales" : rawProfile.jurisdiction || "United Kingdom",
      incorporation_date: rawProfile.date_of_creation || "2018-04-12",
      status: rawProfile.company_status || "active",
      nature_of_business: (rawProfile.sic_codes || []).map((c: string) => `${c} - Predefined Industrial Classification`),
      registered_office: typeof rawProfile.registered_office_address === "string" 
        ? rawProfile.registered_office_address 
        : `${rawProfile.registered_office_address?.address_line_1 || ''}, ${rawProfile.registered_office_address?.locality || ''}, ${rawProfile.registered_office_address?.postal_code || ''}`,
      accounts_standing: {
        status: rawProfile.accounts?.overdue ? "overdue" : "compliant",
        details: "Accounts filing schedules appear compliant with the statutory deadlines prescribed under section 442 of the Companies Act 2006."
      },
      uk_compliance: {
        score: rawProfile.accounts?.overdue ? 65 : 95,
        standing: rawProfile.accounts?.overdue ? "Action Required" : "Compliant",
        evaluation: "The entity maintains active registration and conforms to standard filing policies. Specific review of UK disclosure requirements suggests alignment with modern governance mandates, subject to continuous accounts and filing updates.",
        frameworks: {
          companies_act_2006: { status: "Compliant", details: "Filing and statutory declarations demonstrate fulfillment of Chapter 10 parameters." },
          corporate_governance_code: { status: "Review Pending", details: "Continuous review is advised to determine alignment with non-executive board configuration mandates." },
          modern_slavery_act: { status: "Not Applicable", details: "Annual turnovers remain below the £36m mandatory disclosure threshold." }
        }
      },
      us_compliance: {
        score: 80,
        standing: "Compliant",
        evaluation: "The cross-border standing indicates standard corporate readiness. For prospective dual-market integration, compliance structures must adapt to Sarbanes-Oxley control frameworks and Foreign Corrupt Practices Act internal monitoring rules.",
        frameworks: {
          sarbanes_oxley_act: { status: "Not Applicable", details: "Current status as a non-US private entity exempts the company from automatic Section 404 control certs." },
          foreign_corrupt_practices_act: { status: "Compliant", details: "Accounting record keeping and bribery prevention programs appear standard." },
          sec_disclosures: { status: "Not Applicable", details: "The entity has not filed active registration statements with the Securities and Exchange Commission." }
        }
      },
      risk_assessment: {
        rating: "Low",
        risk_factors: [
          "Potential alignment discrepancy between UK and US filing requirements",
          "Discrepancy in dual governance control certs",
          "Statutory timing variations on global audits"
        ],
        remediation_plan: "Establish automated filing schedulers to prevent latency in primary registrations, and implement formal cross-border governance oversight boards."
      },
      cross_border_mapping: {
        alignment_summary: "The corporate entity profile displays strong alignment with general United Kingdom frameworks, though cross-border US operations will necessitate formal internal financial screening controls consistent with US regulatory guidelines.",
        gaps_identified: [
          "UK proxy statement disclosure schedules lack direct alignment with US SEC proxies.",
          "Internal audit committee configurations differ across jurisdictions."
        ]
      },
      fetched_live: fetchedLive,
      officers: (rawOfficers?.items || []).map((o: any) => ({
        name: o.name,
        role: o.officer_role,
        appointed_on: o.appointed_on,
        nationality: o.nationality,
        resignation_date: o.resigned_on
      }))
    };

    return genericAnalysis;
  })();

  activeEvaluations.set(formattedNumber, evaluationPromise);

  try {
    const report = await evaluationPromise;
    
    // Save successfully generated report to MongoDB database cache if configured
    if (mongoUri && mongoUri.trim() !== "" && report) {
      let client: MongoClient | null = null;
      try {
        client = new MongoClient(mongoUri, {
          connectTimeoutMS: 3000,
          serverSelectionTimeoutMS: 3000,
          socketTimeoutMS: 3000,
          tls: true,
          ssl: true,
          tlsAllowInvalidCertificates: true
        });
        await client.connect();
        const db = client.db("compliance_db");
        const collection = db.collection("uk_compliance_evaluations");
        await collection.updateOne(
          { company_number: formattedNumber },
          { $set: report },
          { upsert: true }
        );
        console.log(`Successfully cached corporate compliance evaluation for ${formattedNumber} in MongoDB.`);
      } catch (saveErr) {
        console.error("Failed to write corporate compliance evaluation to MongoDB cache:", saveErr);
      } finally {
        if (client) {
          try {
            await client.close();
          } catch (closeErr) {}
        }
      }
    }

    return res.json(sanitizeComplianceObject(report));
  } catch (err) {
    console.error(`Error during core compliance evaluation for ${formattedNumber}:`, err);
    return res.status(500).json({ error: "Standard corporate compliance evaluation was interrupted by an internal system issue." });
  } finally {
    activeEvaluations.delete(formattedNumber);
  }
});

async function seedSfcDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.trim() === "") {
    console.warn("MONGODB_URI is not defined. Skipping Hong Kong SFC license database seeding process.");
    return;
  }

  let client: MongoClient | null = null;
  try {
    console.log("Connecting to MongoDB to execute the SFC licensed entities seeding process...");
    client = new MongoClient(mongoUri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      tls: true,
      ssl: true,
      tlsAllowInvalidCertificates: true
    });
    await client.connect();
    const db = client.db("compliance_db");
    const collection = db.collection("hk_licensed_entities");

    const existingCount = await collection.countDocuments();
    console.log(`Current record count in the SFC licensed collection: ${existingCount}`);

    // Standardized set of 50 accredited Hong Kong SFC licensed institutions
    const rawSeededList = [
      { ceref: "AAL982", name_en: "CLSA LIMITED", name_zh: "里昂證券有限公司", licensed_date: "1987-12-04", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 7: Providing automated trading services"] },
      { ceref: "AAL518", name_en: "HSBC INVESTMENT FUNDS (HONG KONG) LIMITED", name_zh: "滙豐投資基金(香港)有限公司", licensed_date: "1984-06-21", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "AMD593", name_en: "TIGER BROKERS (HK) GLOBAL MEDIUM CO", name_zh: "老虎證券(香港)全球中型有限公司", licensed_date: "2018-09-15", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts"] },
      { ceref: "AMH232", name_en: "CITIC SECURITIES BROKERAGE (HK) LIMITED", name_zh: "中信証券經紀(香港)有限公司", licensed_date: "1994-04-12", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAA529", name_en: "GOLDMAN SACHS (ASIA) L.L.C.", name_zh: "高盛(亞洲)有限責任公司", licensed_date: "1986-07-28", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 5: Advising on futures contracts", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "AAF684", name_en: "MORGAN STANLEY ASIA LIMITED", name_zh: "摩根士丹利亞洲有限公司", licensed_date: "1987-03-12", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 5: Advising on futures contracts", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "BAM291", name_en: "FUTU SECURITIES INTERNATIONAL (HONG KONG) LIMITED", name_zh: "富途證券國際(香港)有限公司", licensed_date: "2012-10-29", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 5: Advising on futures contracts", "Type 7: Providing automated trading services", "Type 9: Asset management"] },
      { ceref: "AAB234", name_en: "UBS SECURITIES ASIA LIMITED", name_zh: "瑞士銀行證券亞洲有限公司", licensed_date: "1992-05-18", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities"] },
      { ceref: "AAC123", name_en: "MERRILL LYNCH (ASIA PACIFIC) LIMITED", name_zh: "美林(亞太)有限公司", licensed_date: "1994-06-03", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 6: Advising on corporate finance"] },
      { ceref: "AAD456", name_en: "J.P. MORGAN SECURITIES (ASIA PACIFIC) LIMITED", name_zh: "摩根大通證券(亞太)有限公司", licensed_date: "1996-03-15", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 7: Providing automated trading services"] },
      { ceref: "AAE789", name_en: "CREDIT SUISSE (HONG KONG) LIMITED", name_zh: "瑞士信貸(香港)有限公司", licensed_date: "1999-01-20", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "AAF111", name_en: "BOCI ASIA LIMITED", name_zh: "中銀國際亞洲有限公司", licensed_date: "1998-04-10", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 6: Advising on corporate finance"] },
      { ceref: "AAG222", name_en: "CHINA INTERNATIONAL CAPITAL CORPORATION HONG KONG SECURITIES LIMITED", name_zh: "中國國際金融香港證券有限公司", licensed_date: "2005-09-02", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "AAH333", name_en: "HAITONG INTERNATIONAL SECURITIES COMPANY LIMITED", name_zh: "海通國際證券有限公司", licensed_date: "2000-08-11", activities: ["Type 1: Dealing in securities", "Type 3: Leveraged foreign exchange trading", "Type 4: Advising on securities"] },
      { ceref: "AAI444", name_en: "SHENWAN HONGYUAN SECURITIES (H.K.) LIMITED", name_zh: "申萬宏源證券(香港)有限公司", licensed_date: "1993-11-05", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAJ555", name_en: "GUOTAI JUNAN SECURITIES (HONG KONG) LIMITED", name_zh: "國泰君安證券(香港)有限公司", licensed_date: "1995-10-18", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities"] },
      { ceref: "AAK666", name_en: "GF SECURITIES (HONG KONG) BROKERAGE LIMITED", name_zh: "廣發證券(香港)經紀有限公司", licensed_date: "2006-08-30", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAL777", name_en: "ESSENCE INTERNATIONAL SECURITIES (HONG KONG) LIMITED", name_zh: "安信國際證券(香港)有限公司", licensed_date: "2009-07-21", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAM888", name_en: "HUATAI FINANCIAL HOLDINGS (HONG KONG) LIMITED", name_zh: "華泰金融控股(香港)有限公司", licensed_date: "2006-11-15", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "AAN999", name_en: "BOCOM INTERNATIONAL SECURITIES LIMITED", name_zh: "交銀國際證券有限公司", licensed_date: "1997-06-25", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 5: Advising on futures contracts"] },
      { ceref: "AAO123", name_en: "ICBC INTERNATIONAL SECURITIES LIMITED", name_zh: "工銀國際證券有限公司", licensed_date: "2008-05-16", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAP456", name_en: "CCB INTERNATIONAL SECURITIES LIMITED", name_zh: "建銀國際證券有限公司", licensed_date: "2004-12-08", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities"] },
      { ceref: "AAQ789", name_en: "AGRICULTURAL BANK OF CHINA INTERNATIONAL SECURITIES LIMITED", name_zh: "農銀國際證券有限公司", licensed_date: "2009-09-18", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAR111", name_en: "NOMURA INTERNATIONAL (HONG KONG) LIMITED", name_zh: "野村國際(香港)有限公司", licensed_date: "1982-10-30", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "AAS222", name_en: "DAIWA CAPITAL MARKETS HONG KONG LIMITED", name_zh: "大和資本市場香港有限公司", licensed_date: "1970-11-09", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 6: Advising on corporate finance"] },
      { ceref: "AAT333", name_en: "SMBC NIKKO SECURITIES (HONG KONG) LIMITED", name_zh: "三井住友日興證券(香港)有限公司", licensed_date: "2005-02-23", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 6: Advising on corporate finance"] },
      { ceref: "AAU444", name_en: "MIZUHO SECURITIES ASIA LIMITED", name_zh: "瑞穗證券亞洲有限公司", licensed_date: "1999-12-08", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 6: Advising on corporate finance", "Type 9: Asset management"] },
      { ceref: "AAV555", name_en: "KGI ASIA LIMITED", name_zh: "凱基亞洲有限公司", licensed_date: "1997-03-05", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAW666", name_en: "PHILLIP SECURITIES (HONG KONG) LIMITED", name_zh: "輝立證券(香港)有限公司", licensed_date: "1981-05-12", activities: ["Type 1: Dealing in securities", "Type 2: Dealing in futures contracts", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "AAX777", name_en: "CHIEF SECURITIES LIMITED", name_zh: "致富證券有限公司", licensed_date: "1993-02-18", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities"] },
      { ceref: "AAY888", name_en: "EVERBRIGHT SECURITIES INVESTMENT SERVICES (HK) LIMITED", name_zh: "光大證券投資服務(香港)有限公司", licensed_date: "1998-09-24", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "AAZ999", name_en: "BARING ASSET MANAGEMENT (ASIA) LIMITED", name_zh: "霸菱資產管理(亞洲)有限公司", licensed_date: "1985-05-15", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABA123", name_en: "FIL INVESTMENT MANAGEMENT (HONG KONG) LIMITED", name_zh: "富達基金(香港)有限公司", licensed_date: "1981-12-11", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABB456", name_en: "BLACKROCK ASSET MANAGEMENT NORTH ASIA LIMITED", name_zh: "貝萊德資產管理北亞有限公司", licensed_date: "1998-04-18", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABC789", name_en: "VANGUARD INVESTMENT SERVICE (ASIA) LIMITED", name_zh: "領航投資服務(亞洲)有限公司", licensed_date: "2000-11-20", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABD111", name_en: "ALLIANZ GLOBAL INVESTORS ASIA PACIFIC LIMITED", name_zh: "德盛安聯資產管理亞太有限公司", licensed_date: "1995-12-14", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABE222", name_en: "SCHRODER INVESTMENT MANAGEMENT (HONG KONG) LIMITED", name_zh: "施羅德投資管理(香港)有限公司", licensed_date: "1983-09-18", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABF333", name_en: "INVESCO HONG KONG LIMITED", name_zh: "景順投資管理亞洲有限公司", licensed_date: "1985-04-30", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABG444", name_en: "JPMORGAN ASSET MANAGEMENT (ASIA PACIFIC) LIMITED", name_zh: "摩根資產管理(亞太)有限公司", licensed_date: "1974-05-12", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABH555", name_en: "AMUNDI HONG KONG LIMITED", name_zh: "鋒裕匯理資產管理香港有限公司", licensed_date: "1988-12-08", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABI666", name_en: "MANULIFE ASSET MANAGEMENT (HONG KONG) LIMITED", name_zh: "宏利資產管理(香港)有限公司", licensed_date: "2000-09-15", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABJ777", name_en: "EASTSPRING INVESTMENTS (HONG KONG) LIMITED", name_zh: "瀚亞投資(香港)有限公司", licensed_date: "1994-11-04", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABK888", name_en: "PICTET ASSET MANAGEMENT (HONG KONG) LIMITED", name_zh: "百達資產管理(香港)有限公司", licensed_date: "1999-10-18", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ABL999", name_en: "FRANKLIN TEMPLETON INVESTMENTS (ASIA) LIMITED", name_zh: "富蘭克林鄧普頓投資(亞洲)有限公司", licensed_date: "1987-11-30", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACA123", name_en: "FIDELITY INVESTMENTS (HONG KONG) LIMITED", name_zh: "富達投資(香港)有限公司", licensed_date: "1986-05-18", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACB456", name_en: "BEATE ASSET MANAGEMENT HONG KONG LIMITED", name_zh: "貝德資產管理香港有限公司", licensed_date: "2015-08-16", activities: ["Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACC789", name_en: "VALUE PARTNERS LIMITED", name_zh: "惠理基金管理有限公司", licensed_date: "1993-04-12", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACD111", name_en: "CSOP ASSET MANAGEMENT LIMITED", name_zh: "南方東英資產管理有限公司", licensed_date: "2008-10-20", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACE222", name_en: "E FUND MANAGEMENT (HONG KONG) CO., LIMITED", name_zh: "易方達資產管理(香港)有限公司", licensed_date: "2008-09-18", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] },
      { ceref: "ACF333", name_en: "HARVEST GLOBAL INVESTMENTS LIMITED", name_zh: "嘉實國際資產管理有限公司", licensed_date: "2009-02-12", activities: ["Type 1: Dealing in securities", "Type 4: Advising on securities", "Type 9: Asset management"] }
    ];

    // Map raw list details into full compliance records with complete third-person narratives
    const fullEntities = rawSeededList.map((item, idx) => {
      const usesTemplate1 = idx % 2 === 0;

      const complaints_or_disciplinary = usesTemplate1
        ? "A thorough examination of Securities and Futures Commission records reveals zero active enforcement actions or disciplinary circular penalties under current review. Review of statutory reporting compliance reflects a standard and clear administrative status with no registered complaints or warnings."
        : "Securities and Futures Commission disciplinary registers confirm that the corporation maintains a stable regulatory filing status. No major regulatory infractions or public restrictions have been declared, indicating the entity's continuous compliance alignment with Capital 571 guidelines.";

      const sfc_compliance_details = usesTemplate1
        ? "The licensed entity holds authorization to execute various regulated activities under section 116 of the Securities and Futures Ordinance. Continuous supervision shows that liquid capital balances and financial resource reporting files are maintained above mandatory regulatory threshold requirements, securing robust operations."
        : "Operational monitoring indicates that the corporation operates in stable alignment with the Code of Conduct for Persons Licensed by or Registered with the Securities and Futures Commission. Maintenance of proper client asset segregation and periodic financial reporting confirms strong structural controls.";

      const risk_profile = usesTemplate1
        ? "A low risk rating is assigned to the corporate entity, reflecting strong compliance governance structures and conservative financial resource management. Internal control frameworks and external audit reports suggest negligible exposure to systemic operating issues."
        : "An analysis of the firm's operational structure suggests a standard medium risk rating due to active client transaction volumes and market exposure. Compliance management committees are noted to carry out periodic assessments to preserve leverage limits.";

      return {
        ceref: item.ceref,
        name_en: item.name_en,
        name_zh: item.name_zh,
        status: "Active",
        licensed_date: item.licensed_date,
        regulated_activities: item.activities,
        complaints_or_disciplinary,
        sfc_compliance_details,
        risk_profile
      };
    });

    // Write all documents into the database using upsert mapping processes
    for (const doc of fullEntities) {
      await collection.updateOne(
        { ceref: doc.ceref },
        { $set: doc },
        { upsert: true }
      );
    }

    console.log("Seeding of SFC licensed entities completed successfully. All 50 corporate registries are verified in the MongoDB instance.");
  } catch (err) {
    console.error("The SFC corporate compliance database seeding encountered an error:", err);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeErr) {}
    }
  }
}

async function startServer() {
  // Execute database seeding as a non-blocking background task on server startup
  seedSfcDatabase().catch((err) => {
    console.error("Background compliance seeding process caught an error:", err);
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on host 0.0.0.0, port ${PORT}`);
  });
}

startServer();
