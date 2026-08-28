// Presentation filter only; the API and database remain authoritative.
export function customerRecords(account, records) {
  if (!account?.id) return [];
  const companies = new Set([account.companyId, ...(account.companyIds || [])].filter(Boolean));
  return records.filter(record => record.companyId
    ? companies.has(record.companyId)
    : record.accountId === account.id);
}
