'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const userService = require('../services/users/user.service');
const directory = require('../services/directory.service');

const list = asyncHandler(async (req, res) => {
  // Express 5 re-parses req.query on every read, so sanitised values only
  // survive in matchedData - and it also drops any unvalidated parameter.
  const filters = matchedData(req, { locations: ['query'] });
  const { items, meta } = await userService.listUsers(req.user, filters);
  sendSuccess(res, 200, items, meta);
});

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await userService.getUser(req.user, req.params.id));
});

const updateMe = asyncHandler(async (req, res) => {
  const { fullName, phone, academicYear } = req.body;
  sendSuccess(res, 200, await userService.updateProfile(req.user.id, { fullName, phone, academicYear }));
});

const changeRole = asyncHandler(async (req, res) => {
  const { role, clubId } = req.body;
  sendSuccess(res, 200, await userService.changeRole(req.user, req.params.id, { role, clubId }, { ip: req.ip }));
});

const setStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await userService.setActive(req.user, req.params.id, req.body.isActive, { ip: req.ip }));
});

const departments = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  sendSuccess(res, 200, await directory.listDepartments());
});

const roles = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, await directory.listRoles());
});

const clubs = asyncHandler(async (req, res) => {
  const appointable = req.query.appointable === 'true';
  sendSuccess(res, 200, await directory.listClubs(req.user, { appointable }));
});

module.exports = { list, getOne, updateMe, changeRole, setStatus, departments, roles, clubs };
