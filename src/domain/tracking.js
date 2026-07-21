export const trackingStatuses = [
  { id: 'rfq-submitted', label: 'RFQ submitted', phase: 'RFQ', description: 'The request has been recorded and is waiting for review.' },
  { id: 'under-review', label: 'Under review', phase: 'RFQ', description: 'Rhomberg is reviewing the application and configuration.' },
  { id: 'quotation-sent', label: 'Quotation sent', phase: 'Quotation', description: 'A quotation has been prepared and sent to the customer.' },
  { id: 'po-received', label: 'Purchase Order received', phase: 'Order', description: 'The Purchase Order has been received and checked.' },
  { id: 'scheduled', label: 'Scheduled', phase: 'Production', description: 'The order has been scheduled for manufacture or preparation.' },
  { id: 'in-production', label: 'In production', phase: 'Production', description: 'The instruments are currently being manufactured or assembled.' },
  { id: 'quality-check', label: 'Quality check', phase: 'Quality', description: 'The order is undergoing final inspection and documentation checks.' },
  { id: 'ready', label: 'Ready for dispatch', phase: 'Dispatch', description: 'The order is complete and ready for delivery or collection.' },
  { id: 'dispatched', label: 'Dispatched', phase: 'Dispatch', description: 'The order has left Rhomberg and is on its way.' },
  { id: 'completed', label: 'Completed', phase: 'Complete', description: 'The order has been completed.' },
  { id: 'on-hold', label: 'On hold', phase: 'Attention', description: 'The order needs information or action before it can continue.' },
];

export const statusById = id => trackingStatuses.find(status => status.id === id) || trackingStatuses[0];

export const progressForStatus = id => {
  if (id === 'on-hold') return 45;
  const index = trackingStatuses.findIndex(status => status.id === id);
  const workflowLength = trackingStatuses.length - 1;
  return Math.max(5, Math.min(100, Math.round(((index + 1) / workflowLength) * 100)));
};

export const nextTrackingStatus = id => {
  const workflow = trackingStatuses.filter(status => status.id !== 'on-hold');
  const index = workflow.findIndex(status => status.id === id);
  return workflow[Math.min(workflow.length - 1, Math.max(0, index + 1))];
};
