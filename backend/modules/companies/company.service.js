const mongoose = require('mongoose');
const Company = require('./company.model');
const Task = require('../task/task.model');
const AppError = require('../../utils/AppError');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

const assertAllowedUpdates = (updates) => {
  const allowedFields = [
    'name',
    'logoUrl',
    'role',
    'location',
    'packageInfo',
    'status',
    'resumeVersion',
    'applicationDate',
    'importantDates',
  ];
  const invalidFields = Object.keys(updates).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new AppError(`Invalid update fields: ${invalidFields.join(', ')}.`, 400);
  }
};

const serializeCompany = (company) => {
  const companyObject = company.toJSON ? company.toJSON() : company;

  return {
    id: companyObject._id,
    name: companyObject.name,
    logoUrl: companyObject.logoUrl,
    role: companyObject.role,
    location: companyObject.location,
    packageInfo: companyObject.packageInfo,
    status: companyObject.status,
    resumeVersion: companyObject.resumeVersion,
    applicationDate: companyObject.applicationDate,
    importantDates: companyObject.importantDates,
    createdAt: companyObject.createdAt,
    updatedAt: companyObject.updatedAt,
  };
};

const createCompany = async (userId, data) => {
  assertValidObjectId(userId, 'userId');

  const name = (data.name || '').trim();
  if (!name) {
    throw new AppError('Company name is required.', 400);
  }

  const company = await Company.create({
    userId,
    name,
    role: data.role,
    location: data.location,
    status: data.status,
  });

  return serializeCompany(company);
};

const getCompanies = async (userId) => {
  assertValidObjectId(userId, 'userId');

  const companies = await Company.find({ userId }).sort({ updatedAt: -1 }).limit(100);

  return companies.map(serializeCompany);
};

const findOwnedCompany = async (userId, companyId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(companyId, 'companyId');

  const company = await Company.findOne({ _id: companyId, userId });
  if (!company) {
    throw new AppError('Company not found or unauthorized.', 404);
  }
  return company;
};

const getCompanyById = async (userId, companyId) => {
  const company = await findOwnedCompany(userId, companyId);
  return serializeCompany(company);
};

const updateCompany = async (userId, companyId, updates) => {
  assertAllowedUpdates(updates);
  const company = await findOwnedCompany(userId, companyId);

  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) {
      throw new AppError('Company name is required.', 400);
    }
    updates = { ...updates, name };
  }

  Object.assign(company, updates);
  await company.save();

  return serializeCompany(company);
};

// Deleting a company unlinks (not deletes) its tasks — a prep task like
// "Solve 20 LeetCode problems" has value independent of any one company —
// and cascade-deletes its notes, mirroring task.service.js's own deleteTask.
const deleteCompany = async (userId, companyId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(companyId, 'companyId');

  const company = await Company.findOneAndDelete({ _id: companyId, userId });
  if (!company) {
    throw new AppError('Company not found or unauthorized.', 404);
  }

  await Task.updateMany({ userId, companyId }, { companyId: null });

  // Lazily required + best-effort, same reasoning as task.service.js's
  // deleteTask: avoids a module-load-order circular dependency, and a
  // notes-cleanup failure should never block the company-delete response.
  try {
    const notesService = require('../notes/notes.service');
    await notesService.deleteAllForEntity(userId, 'COMPANY', companyId);
  } catch (cleanupError) {
    console.error(`[company] failed to clean up notes for deleted company ${companyId}:`, cleanupError.message);
  }

  return serializeCompany(company);
};

const INTERVIEWING_LIKE_STATUSES = ['OA_SCHEDULED', 'OA_COMPLETED', 'INTERVIEWING'];

const getNextImportantDate = (company, now) => {
  const upcoming = (company.importantDates || [])
    .filter((entry) => entry.date && new Date(entry.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return upcoming[0] || null;
};

// Mirrors frontend/src/utils/companies.js's computePlacementStats — same
// status-driven classification (not label-parsed, since importantDates
// labels are free text). Duplicated rather than shared because the frontend
// util isn't reachable from the backend runtime; keep both in sync if the
// classification ever changes. Used by both a future /placements analytics
// need and the AI Assistant's context builder, so it lives here once rather
// than being computed ad hoc by each caller.
const computePlacementSummary = (companies, now = new Date()) => {
  const total = companies.length;
  const preparing = companies.filter((company) => company.status === 'PREPARING').length;
  const applied = companies.filter((company) => !['WISHLIST', 'PREPARING'].includes(company.status)).length;
  const interviews = companies.filter((company) => INTERVIEWING_LIKE_STATUSES.includes(company.status)).length;
  const offers = companies.filter((company) => company.status === 'SELECTED').length;
  const rejections = companies.filter((company) => company.status === 'REJECTED').length;
  const upcomingOAs = companies.filter((company) => company.status === 'OA_SCHEDULED' && getNextImportantDate(company, now)).length;
  const upcomingInterviews = companies.filter((company) => company.status === 'INTERVIEWING' && getNextImportantDate(company, now)).length;

  return { total, applied, preparing, interviews, offers, rejections, upcomingInterviews, upcomingOAs };
};

module.exports = {
  AppError,
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  computePlacementSummary,
};
