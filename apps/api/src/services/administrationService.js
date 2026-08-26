import { randomBytes, randomUUID } from 'node:crypto';
import { validationError } from '../errors.js';
import { hashPassword } from '../security/crypto.js';
import { requirePermission } from '../authorization/permissions.js';

const usernamePattern = /^[A-Za-z][A-Za-z0-9._-]{2,39}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAdministrationService({ repository, storage, passwordHasher = hashPassword }) {
  return Object.freeze({
    async createInternalUser(actor, input, correlationId) {
      const displayName = String(input.displayName || '').trim();
      const username = String(input.username || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      const role = String(input.role || '').trim();
      const additionalRoles = [...new Set(Array.isArray(input.additionalRoles) ? input.additionalRoles.map(value => String(value).trim()).filter(Boolean) : [])].filter(value => value !== role);
      const branchId = String(input.branchId || 'unassigned').trim();
      const department = String(input.department || 'General').trim();
      const errors = {};
      if (displayName.length < 2) errors.displayName = 'Enter the employee display name.';
      if (!usernamePattern.test(username)) errors.username = 'Use a valid sign-in name of 3–40 characters.';
      if (email && !emailPattern.test(email)) errors.email = 'Enter a valid work email address or leave it blank.';
      if (password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        errors.password = 'Use at least 16 characters including upper-case, lower-case, numeric and symbol characters.';
      }
      if (!role || ['administrator', 'customer'].includes(role)) errors.role = 'Select an approved internal employee role.';
      if (additionalRoles.some(value => ['administrator', 'customer'].includes(value))) errors.additionalRoles = 'Administrator and customer roles cannot be added here.';
      if (Object.keys(errors).length) throw validationError(errors);
      const passwordHash = await passwordHasher(password);
      const account = await repository.createInternalUser(actor, {
        id: randomUUID(), username, email: email || null, displayName, passwordHash, role,
        additionalRoles, branchId, branchName: String(input.branchName || branchId), department,
        phone: String(input.phone || '').trim(), correlationId, reason: String(input.reason || '').trim(),
      });
      return { account: { ...account, contact: account.displayName } };
    },
    async createCustomerAccount(actor, input, correlationId) {
      const companyName = String(input.companyName || '').trim();
      const contactName = String(input.contactName || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const phone = String(input.phone || '').trim();
      const area = String(input.area || '').trim();
      const industry = String(input.industry || '').trim();
      const branchId = String(input.branchId || '').trim();
      const representativeId = String(input.representativeId || '').trim();
      const password = String(input.password || '');
      const errors = {};
      if (companyName.length < 2) errors.companyName = 'Enter the company name.';
      if (contactName.length < 2) errors.contactName = 'Enter the authorised customer contact.';
      if (!emailPattern.test(email)) errors.email = 'Enter a valid customer email address.';
      if (phone.length < 7) errors.phone = 'Enter a valid customer telephone number.';
      if (!area) errors.area = 'Select the customer area.';
      if (!industry) errors.industry = 'Enter the customer industry.';
      if (!branchId) errors.branchId = 'Select the assigned branch.';
      if (representativeId) {
        const representatives = await repository.listRepresentatives(actor);
        const representative = representatives.find(item => item.id === representativeId && item.active !== false);
        if (!representative || representative.branchId !== branchId) errors.representativeId = 'Select an active representative assigned to the customer area.';
      }
      if (password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) errors.password = 'Use at least 16 characters including upper-case, lower-case, numeric and symbol characters.';
      if (Object.keys(errors).length) throw validationError(errors);
      const passwordHash = await passwordHasher(password);
      return repository.createCustomerAccount(actor, { companyId: randomUUID(), userId: randomUUID(), companyName, contactName, email, phone, area, industry, branchId, representativeId: representativeId || null, passwordHash, correlationId });
    },
    async updateUser(actor,userId,input,correlationId) {
      requirePermission(actor,'administer_users'); const values=input?.values || input || {};
      const payload={displayName:String(values.contact || values.displayName || '').trim(),username:String(values.signInName || values.username || '').trim(),email:String(values.email || '').trim().toLowerCase(),phone:String(values.phone || '').trim(),department:String(values.department || '').trim(),branchId:String(values.branchId || '').trim(),reason:String(input?.reason || '').trim()};
      if(payload.displayName && payload.displayName.length<2) throw validationError({contact:'Enter a valid account name.'});
      if(payload.username && !usernamePattern.test(payload.username)) throw validationError({signInName:'Use a valid sign-in name.'});
      if(payload.email && !emailPattern.test(payload.email)) throw validationError({email:'Enter a valid email address.'});
      return repository.administerUser(actor,userId,'update',payload,correlationId);
    },
    updateStatus(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); return repository.administerUser(actor,userId,'status',{status:String(input?.status || ''),reason:String(input?.reason || '')},correlationId); },
    archiveUser(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); if(String(input?.reason || '').trim().length<5) throw validationError({reason:'Record why this employee account is being archived.'}); return repository.administerUser(actor,userId,'archive',input,correlationId); },
    deleteUser(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); if(String(input?.reason || '').trim().length<8) throw validationError({reason:'Record why this account is being deleted.'}); return repository.softDeleteUser(actor,userId,{reason:String(input.reason).trim()},correlationId); },
    assignRoles(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); return repository.administerUser(actor,userId,'roles',{roles:[...new Set(input?.roles || [])],reason:String(input?.reason || '')},correlationId); },
    assignBranch(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); if(!String(input?.branchId || '').trim()) throw validationError({branchId:'Select a branch.'}); return repository.administerUser(actor,userId,'branch',input,correlationId); },
    setPermissions(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); return repository.administerUser(actor,userId,'permissions',{permissions:[...new Set(input?.permissions || [])],reason:String(input?.reason || '')},correlationId); },
    setNotificationPreferences(actor,userId,input,correlationId) { requirePermission(actor,'administer_users'); return repository.administerUser(actor,userId,'notification_preferences',{preferences:input?.preferences || {},reason:String(input?.reason || '')},correlationId); },
    async resetTemporaryPassword(actor,userId,input,correlationId) {
      requirePermission(actor,'administer_users'); if(String(input?.reason || '').trim().length<5) throw validationError({reason:'Record why the login is being reset.'});
      const temporaryPassword=`Rc-${randomBytes(18).toString('base64url')}!7a`; const passwordHash=await passwordHasher(temporaryPassword);
      const account=await repository.administerUser(actor,userId,'temporary_password',{passwordHash,reason:String(input.reason)},correlationId);
      return {account,temporaryPassword};
    },
    getUserAudit(actor,userId) { requirePermission(actor,'administer_users'); return repository.getUserAudit(actor,userId); },
    getUserLoginHistory(actor,userId) { requirePermission(actor,'administer_users'); return repository.getUserLoginHistory(actor,userId); },
    updateCompany(actor,companyId,input,correlationId) { requirePermission(actor,'administer_users'); const values=input?.values || input || {}; return repository.administerCompany(actor,companyId,'update',{name:String(values.name || '').trim(),area:String(values.area || '').trim(),industry:String(values.industry || '').trim(),branchId:String(values.branchId || '').trim(),reason:String(input?.reason || '')},correlationId); },
    assignRepresentative(actor,companyId,input,correlationId) { requirePermission(actor,'administer_users'); if(!/^[0-9a-f-]{36}$/i.test(String(input?.representativeId || ''))) throw validationError({representativeId:'Select an active representative.'}); if(String(input?.reason || '').trim().length<5) throw validationError({reason:'Record why the Dedicated Representative is changing.'}); return repository.administerCompany(actor,companyId,'representative',input,correlationId); },
    async saveProfileImage(actor,userId,file,correlationId) { requirePermission(actor,'administer_users'); if(!file) throw validationError({profileImage:'Choose a PNG or JPEG image.'}); const document=await storage.put(file); try { const result=await repository.saveUserProfileImage(actor,userId,document,correlationId); if(result.previousStorageKey) await storage.remove(result.previousStorageKey).catch(()=>undefined); return result; } catch(error) { await storage.remove(document.storageKey).catch(()=>undefined); throw error; } },
    async getProfileImage(actor,userId) { const image=await repository.getUserProfileImage(actor,userId); return { ...image, buffer:await storage.get(image.storage_key) }; },
  });
}
