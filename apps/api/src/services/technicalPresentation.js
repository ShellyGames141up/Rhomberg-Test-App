// Explicit UI contracts: never spread raw request/message metadata into a
// customer payload. RLS establishes access; this projection limits disclosure.
export function presentTechnicalRequest(record, actor) {
  if (!record) return null;
  const messages = record.messages || [];
  const safeMessages = messages.filter(message => message.classification === 'customer_safe');
  const common = {
    id: record.id, reference: record.reference, rfqId: record.rfqId,
    status: record.status, requestedAt: record.createdAt,
    originalQuotationTargetAt: record.originalQuotationTarget,
    revisedQuotationTargetAt: record.revisedQuotationTarget,
    additionalAllowanceHours: 24,
    customerMessage: record.status === 'technical_support_completed'
      ? 'Technical review is complete. Your representative can continue with your quotation.'
      : 'Your enquiry is being reviewed. The quotation timeframe includes an additional 24-hour allowance.',
  };
  const visibleMessages = actor.role === 'customer' ? safeMessages : messages;
  const thread = visibleMessages.map(message => ({
    id: message.id, message: message.message, sender: message.sender,
    senderRole: message.senderRole, classification: message.classification,
    createdAt: message.createdAt,
  }));
  const latest = messages.at(-1);
  if (actor.role === 'customer') return {
    ...common, messages: thread,
    customerInformationRequest: record.status === 'awaiting_customer_information'
      ? { message: safeMessages.at(-1)?.message || '' } : null,
  };
  const response = messages.findLast(message => message.metadata?.response);
  return {
    ...record, ...common, messages: thread,
    assignedTechnicalUser: record.assignedTechnicalUserId
      ? { id: record.assignedTechnicalUserId, displayName: record.assignedTechnicalUserName || 'Assigned Technical Advisor' } : null,
    pendingInformationTarget: latest?.metadata?.target || '',
    response: response ? { response: response.metadata.response, recommendation: response.metadata.recommendation } : null,
  };
}
