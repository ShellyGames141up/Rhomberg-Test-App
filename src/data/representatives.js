import { nearestBranchForArea } from './branches.js';

const makeRepresentative = (branchId, branchCode, code, name) => ({
  id: `${branchCode}-${code}`,
  branchId,
  branchCode,
  code,
  name,
});

export const representativesByBranch = {
  'cape-town': [
    ['11', 'Fabricated Cape Representative 11'],
    ['13', 'Fabricated Cape Representative 13'],
    ['14', 'Fabricated Cape Representative 14'],
    ['17', 'Fabricated Cape Representative 17'],
    ['27', 'Fabricated Cape Representative 27'],
  ].map(([code, name]) => makeRepresentative('cape-town', 'C', code, name)),
  durban: [
    ['31', 'Fabricated Durban Representative 31'],
    ['32', 'Fabricated Durban Representative 32'],
  ].map(([code, name]) => makeRepresentative('durban', 'D', code, name)),
  johannesburg: [
    ['21', 'Fabricated Johannesburg Representative 21'],
    ['23', 'Fabricated Johannesburg Representative 23'],
  ].map(([code, name]) => makeRepresentative('johannesburg', 'J', code, name)),
  'port-elizabeth': [
    ['16', 'Fabricated Port Elizabeth Representative 16'],
  ].map(([code, name]) => makeRepresentative('port-elizabeth', 'P', code, name)),
};

export const representatives = Object.values(representativesByBranch).flat();

export const representativesForArea = area => {
  const branch = nearestBranchForArea(area);
  return { branch, representatives: representativesByBranch[branch.id] || [] };
};

export const representativeById = id => representatives.find(representative => representative.id === id) || null;
