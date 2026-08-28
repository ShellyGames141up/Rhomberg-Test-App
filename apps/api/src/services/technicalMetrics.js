// Metrics use saved request timestamps; missing evidence is never estimated.
export function technicalMetrics(records, now = Date.now()) {
  const completed=records.filter(r=>r.status==='technical_support_completed');
  const hours=completed.map(r=>(new Date(r.completedAt)-new Date(r.createdAt))/36e5).filter(n=>Number.isFinite(n)&&n>=0);
  const categories=new Map();
  for(const record of records) categories.set(record.category,(categories.get(record.category)||0)+1);
  return {
    total:records.length,
    newRequests:records.filter(r=>r.status==='technical_support_requested').length,
    inProgress:records.filter(r=>['technical_support_assigned','technical_review_in_progress'].includes(r.status)).length,
    awaitingInformation:records.filter(r=>['awaiting_representative_information','awaiting_customer_information'].includes(r.status)).length,
    completed:completed.length,
    overdue:records.filter(r=>!['technical_support_completed','technical_support_cancelled'].includes(r.status)&&new Date(r.revisedQuotationTarget).getTime()<now).length,
    averageResponseHours:hours.length?Math.round(hours.reduce((sum,n)=>sum+n,0)/hours.length*10)/10:0,
    byCategory:[...categories].map(([category,count])=>({category,count})),
  };
}
