'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const clubs = require('../services/clubs/club.service');

const list = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await clubs.listClubs(req.user, matchedData(req, { locations: ['query'] })));
});

const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await clubs.getClub(req.user, req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { name, description, departmentId } = req.body;
  sendSuccess(res, 201, await clubs.createClub(req.user, { name, description, departmentId }, { ip: req.ip }));
});

const update = asyncHandler(async (req, res) => {
  const { name, description, departmentId, isActive } = req.body;
  sendSuccess(res, 200, await clubs.updateClub(req.user, req.params.id, { name, description, departmentId, isActive }, { ip: req.ip }));
});

const addMember = asyncHandler(async (req, res) => {
  const { email, position } = req.body;
  sendSuccess(res, 201, await clubs.addMember(req.user, req.params.id, { email, position }, { ip: req.ip }));
});

const updateMember = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await clubs.updateMember(req.user, req.params.id, req.params.userId, { position: req.body.position }, { ip: req.ip }));
});

const removeMember = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await clubs.removeMember(req.user, req.params.id, req.params.userId, { ip: req.ip }));
});

module.exports = { list, getOne, create, update, addMember, updateMember, removeMember };
