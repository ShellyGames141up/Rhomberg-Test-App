import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixture, ids, login } from './fixtures.js';

test('representative visit lifecycle persists and customer accounts cannot use internal controls', async t=>{
  const {app,repository}=await createFixture();t.after(()=>app.close());
  const rep=repository._state.users.find(user=>user.id===ids.representativeUser);rep.permissions.push('view_assigned_clients','schedule_client_visits','verify_client_visits','view_own_work_location_summary');
  const auth=await login(app,'representative@example.invalid');
  const clients=await app.inject({url:'/api/v1/representatives/clients',headers:{cookie:auth.cookie}});assert.equal(clients.statusCode,200);assert.equal(clients.json().data.length,1);
  const scheduled=await app.inject({method:'POST',url:`/api/v1/clients/${ids.companyA}/appointments`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{scheduledAt:'2099-01-01T10:00:00.000Z',expectedDurationMinutes:60,purpose:'Fabricated relationship visit',contact:'Fabricated Customer A',address:'1 Fabricated Road'}});assert.equal(scheduled.statusCode,201);const id=scheduled.json().data.id;
  assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${id}/start`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{}})).statusCode,200);
  const qr=await app.inject({method:'POST',url:`/api/v1/appointments/${id}/qr`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{}});assert.equal(qr.statusCode,200);assert.ok(qr.json().data.token);
  assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${id}/qr/verify`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{token:qr.json().data.token}})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:`/api/v1/appointments/${id}/complete`,headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:{notes:'Fabricated completion'}})).statusCode,200);
  const customer=await login(app);assert.equal((await app.inject({url:'/api/v1/representatives/clients',headers:{cookie:customer.cookie}})).statusCode,403);
  assert.ok(repository._state.audits.some(event=>event.eventType==='appointment.complete'));
});

test('customer personalisation persists through settings and private profile-image storage',async t=>{
  const {app}=await createFixture();t.after(()=>app.close());const auth=await login(app);
  const candidate={schemaVersion:1,setupCompleted:true,themePreset:'rhomberg-default',fontSize:'large',density:'comfortable',appearanceMode:'dark',notificationPreferences:{rfqUpdates:true,quotationNotifications:true,orderProgress:true,delayNotifications:true,fulfilmentNotifications:true,accountSecurity:true,maintenanceNotices:true,companyAnnouncements:false},profileImage:null};
  const saved=await app.inject({method:'PUT',url:'/api/v1/users/me/personalisation',headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf},payload:candidate});assert.equal(saved.statusCode,200);assert.equal(saved.json().data.fontSize,'large');
  assert.equal((await app.inject({url:'/api/v1/users/me/personalisation',headers:{cookie:auth.cookie}})).json().data.appearanceMode,'dark');
  const boundary='----fabricated-profile';const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nprofileImage\r\n--${boundary}\r\nContent-Disposition: form-data; name="position"\r\n\r\n{"x":45,"y":55}\r\n--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n`),Buffer.from([137,80,78,71,13,10,26,10,0]),Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const upload=await app.inject({method:'POST',url:'/api/v1/users/me/personalisation/images',headers:{cookie:auth.cookie,'x-csrf-token':auth.csrf,'content-type':`multipart/form-data; boundary=${boundary}`},payload:body});assert.equal(upload.statusCode,200);assert.equal(upload.json().data.position.x,45);
  const image=await app.inject({url:`/api/v1/users/me/personalisation/images/${ids.customerA}`,headers:{cookie:auth.cookie}});assert.equal(image.statusCode,200);assert.equal(image.headers['content-type'],'image/png');
});
