/** Megadim company + bank defaults (from Rivhit quote PDF sample). */

export interface QuoteCompanySnapshot {
  name: string;
  address: string;
  phone: string;
  businessId: string;
  producerName: string;
}

export interface QuoteBankSnapshot {
  bankCode: string;
  bankName: string;
  branch: string;
  account: string;
}

export const MEGADIM_COMPANY_DEFAULTS: QuoteCompanySnapshot = {
  name: 'קייטרינג מגדים (ב.מ.מ) בע"מ',
  address: 'אזור התעשייה, מעלה מכמש 9063400',
  phone: '073-3678399',
  businessId: '516234739',
  producerName: 'בני מהלא'
};

export const MEGADIM_BANK_DEFAULTS: QuoteBankSnapshot = {
  bankCode: '12',
  bankName: 'פועלים',
  branch: '698',
  account: '72490'
};

export const DEFAULT_VAT_RATE = 18;

export function formatBankLine(bank: QuoteBankSnapshot): string {
  return `בנק: ${bank.bankCode} (${bank.bankName}) סניף: ${bank.branch} חשבון: ${bank.account}`;
}
