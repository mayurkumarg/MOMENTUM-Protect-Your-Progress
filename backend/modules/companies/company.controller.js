const companyService = require('./company.service');

const createCompany = async (req, res, next) => {
  try {
    const company = await companyService.createCompany(req.user.userId, req.body);
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const companies = await companyService.getCompanies(req.user.userId);
    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const company = await companyService.getCompanyById(req.user.userId, req.params.id);
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const company = await companyService.updateCompany(req.user.userId, req.params.id, req.body);
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    await companyService.deleteCompany(req.user.userId, req.params.id);
    res.status(200).json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};
