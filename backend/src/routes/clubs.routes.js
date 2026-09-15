'use strict';

const { Router } = require('express');
const controller = require('../controllers/clubs.controller');
const rules = require('../validators/clubs.validators');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { FACULTY_ROLES } = require('../services/rbac');

const router = Router();
router.use(authenticate);

router.get('/', rules.list, validate, controller.list);
router.post('/', requireRole(...FACULTY_ROLES), rules.create, validate, controller.create);
router.get('/:id', rules.getOne, validate, controller.getOne);
// Club heads edit their own club; the service decides which fields each role may change.
router.patch('/:id', rules.update, validate, controller.update);
router.post('/:id/members', rules.addMember, validate, controller.addMember);
router.patch('/:id/members/:userId', rules.updateMember, validate, controller.updateMember);
router.delete('/:id/members/:userId', rules.removeMember, validate, controller.removeMember);

module.exports = router;
