export interface ComplianceFrameworkItem {
  status: string;
  details: string;
}

export interface UKComplianceFrameworks {
  companies_act_2006: ComplianceFrameworkItem;
  corporate_governance_code: ComplianceFrameworkItem;
  modern_slavery_act: ComplianceFrameworkItem;
}

export interface USComplianceFrameworks {
  sarbanes_oxley_act: ComplianceFrameworkItem;
  foreign_corrupt_practices_act: ComplianceFrameworkItem;
  sec_disclosures: ComplianceFrameworkItem;
}

export interface AccountsStanding {
  status: "compliant" | "overdue" | "not_applicable" | "warning";
  details: string;
}

export interface ComplianceRating {
  score: number;
  standing: "Compliant" | "Action Required" | "Non-Compliant";
  evaluation: string; // Must be in third-person, objective regulatory tone
}

export interface UKComplianceDetails extends ComplianceRating {
  frameworks: UKComplianceFrameworks;
}

export interface USComplianceDetails extends ComplianceRating {
  frameworks: USComplianceFrameworks;
}

export interface RiskAssessment {
  rating: "Low" | "Medium" | "High";
  risk_factors: string[];
  remediation_plan: string; // Must be in third-person, objective regulatory tone
}

export interface CrossBorderMapping {
  alignment_summary: string; // Must be in third-person, objective regulatory tone
  gaps_identified: string[];
}

export interface EntityOfficer {
  name: string;
  role: string;
  appointed_on?: string;
  nationality?: string;
  resignation_date?: string;
}

export interface ComplianceReport {
  company_name: string;
  company_number: string;
  jurisdiction: string;
  incorporation_date: string;
  status: string;
  nature_of_business: string[];
  registered_office: string;
  accounts_standing: AccountsStanding;
  uk_compliance: UKComplianceDetails;
  us_compliance: USComplianceDetails;
  risk_assessment: RiskAssessment;
  cross_border_mapping: CrossBorderMapping;
  fetched_live: boolean;
  officers?: EntityOfficer[];
}

export interface APIErrorResponse {
  error: string;
  details?: string;
  fallbackUsed: boolean;
  partialData?: Partial<ComplianceReport>;
}

export interface HKLicensedEntity {
  ceref: string;
  name_en: string;
  name_zh?: string;
  status: string;
  licensed_date?: string;
  regulated_activities: string[];
  complaints_or_disciplinary: string; // Written in third-person comprehensive paragraphs
  sfc_compliance_details: string;      // Written in third-person comprehensive paragraphs
  risk_profile: string;                // Written in third-person comprehensive paragraphs
  source?: string;
  db_info?: string;
  db_error?: string;
}
