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
    ['11', 'Alphonso Majiet'],
    ['13', 'Andrew Japhtha'],
    ['14', 'Quintin van Wyk'],
    ['17', 'Arthur Daniels'],
    ['27', 'Ericu Vercuiel'],
  ].map(([code, name]) => makeRepresentative('cape-town', 'C', code, name)),
  durban: [],
  johannesburg: [
    ['21', 'Danny'],
    ['23', 'Siya'],
    ['25', 'Reneil'],
  ].map(([code, name]) => makeRepresentative('johannesburg', 'J', code, name)),
  'port-elizabeth': [
    ['16', 'Carmen Bellew'],
  ].map(([code, name]) => makeRepresentative('port-elizabeth', 'P', code, name)),
};

export const representatives = Object.values(representativesByBranch).flat();

export const representativesForArea = area => {
  const branch = nearestBranchForArea(area);
  return { branch, representatives: representativesByBranch[branch.id] || [] };
};

export const representativeById = id => representatives.find(representative => representative.id === id) || null;
