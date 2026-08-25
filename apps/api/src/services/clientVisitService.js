import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { requirePermission } from '../authorization/permissions.js';
import { validationError } from '../errors.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const text = value => String(value || '').trim();

export function createClientVisitService({ repository }) {
  return Object.freeze({
    listClients(actor) { requirePermission(actor, 'view_assigned_clients'); return repository.listVisitClients(actor); },
    listAppointments(actor) {
      if (!actor.permissions.includes('view_assigned_clients') && !actor.permissions.includes('view_visit_compliance')) requirePermission(actor, 'view_assigned_clients');
      return repository.listAppointments(actor);
    },
    async overview(actor) {
      requirePermission(actor, 'view_assigned_clients');
      const [clients, appointments] = await Promise.all([repository.listVisitClients(actor), repository.listAppointments(actor)]);
      return { assignedCustomers: clients.length, customersVisited: clients.filter(item=>item.lastVerifiedVisitAt).length, customersNotVisited: clients.filter(item=>!item.lastVerifiedVisitAt).length, scheduledVisits: appointments.filter(item=>item.status==='scheduled').length, missedVisits: appointments.filter(item=>item.status==='missed_visit').length, dueWithin7Days: clients.filter(item=>item.status==='amber').length };
    },
    schedule(actor, companyId, input, correlationId) {
      requirePermission(actor, 'schedule_client_visits');
      const errors={}; const scheduledAt=new Date(input?.scheduledAt); const duration=Number(input?.expectedDurationMinutes);
      if(!Number.isFinite(scheduledAt.getTime()) || scheduledAt<=new Date()) errors.scheduledAt='Choose a future visit date.';
      if(!Number.isInteger(duration)||duration<15||duration>480) errors.expectedDurationMinutes='Choose a duration from 15 to 480 minutes.';
      if(text(input?.purpose).length<2) errors.purpose='Enter the visit purpose.';
      if(text(input?.contact).length<2) errors.contact='Enter the customer contact.';
      if(text(input?.address).length<5) errors.address='Enter the visit address.';
      if(Object.keys(errors).length) throw validationError(errors);
      return repository.createAppointment(actor,{id:randomUUID(),companyId,scheduledAt:scheduledAt.toISOString(),expectedDurationMinutes:duration,purpose:text(input.purpose),contact:text(input.contact),address:text(input.address),details:{notes:text(input.notes),agenda:text(input.agenda),reminder:Boolean(input.reminder),followUpRequired:Boolean(input.followUpRequired)},correlationId});
    },
    transition(actor,id,action,input,correlationId) {
      requirePermission(actor, 'verify_client_visits');
      return repository.transitionAppointment(actor,id,{action,input:input || {},correlationId});
    },
    async createQr(actor,id,correlationId) {
      requirePermission(actor, 'verify_client_visits'); const token=randomBytes(24).toString('base64url'); const expiresAt=new Date(Date.now()+10*60_000).toISOString();
      await repository.transitionAppointment(actor,id,{action:'create_qr',input:{tokenHash:digest(token),expiresAt},correlationId}); return {token,expiresAt};
    },
    verifyQr(actor,id,token,correlationId) { requirePermission(actor,'verify_client_visits'); if(text(token).length<16) throw validationError({token:'Enter a valid one-time confirmation token.'}); return repository.transitionAppointment(actor,id,{action:'verify_qr',input:{tokenHash:digest(token)},correlationId}); },
    detectMissed(actor,correlationId) { requirePermission(actor,'view_visit_compliance'); return repository.detectMissedAppointments(actor,correlationId); },
    async compliance(actor) {
      requirePermission(actor,'view_visit_compliance'); const [clients,appointments]=await Promise.all([repository.listVisitClients(actor,{all:true}),repository.listAppointments(actor)]);
      const grouped=new Map(); for(const client of clients){const key=client.representativeId; if(!grouped.has(key)) grouped.set(key,{representativeId:key,representativeName:client.representativeName||'Unassigned',branchId:client.branchId||'',clients:[],appointments:[]}); grouped.get(key).clients.push(client);} for(const appt of appointments){if(!grouped.has(appt.representativeId)) grouped.set(appt.representativeId,{representativeId:appt.representativeId,representativeName:appt.representativeName||'Unassigned',branchId:'',clients:[],appointments:[]});grouped.get(appt.representativeId).appointments.push(appt);}
      return [...grouped.values()].map(group=>({representativeId:group.representativeId,representativeName:group.representativeName,branchId:group.branchId,assignedCustomers:group.clients.length,customersVisited:new Set(group.appointments.filter(x=>x.status==='completed').map(x=>x.clientId)).size,scheduledVisits:group.appointments.filter(x=>x.status==='scheduled').length,missedVisits:group.appointments.filter(x=>x.status==='missed_visit').length,customersNotVisited:Math.max(0,group.clients.length-new Set(group.appointments.filter(x=>x.status==='completed').map(x=>x.clientId)).size),compliancePercentage:group.clients.length?Math.round(new Set(group.appointments.filter(x=>x.status==='completed').map(x=>x.clientId)).size/group.clients.length*100):0,averageDaysBetweenVisits:0,averageVisitDurationMinutes:0,clientVisitHours:0,officeHours:0,unclassifiedHours:0}));
    },
    workSummary(actor) { requirePermission(actor,'view_own_work_location_summary'); return repository.getWorkLocationSummary(actor); },
  });
}
