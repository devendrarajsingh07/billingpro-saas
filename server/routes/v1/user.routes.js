'use strict';

const express = require('express');
const router = express.Router();
const UserController = require('../../controllers/UserController');
const { validateInviteUser, validateUpdateUser } = require('../../validators/user.validator');
const authenticate = require('../../middleware/authenticate').authenticate;
const authorize = require('../../middleware/authorize').authorize;
const { enforcePlanLimit } = require('../../middleware/planLimit');

router.use(authenticate);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     tags: [Users]
 *     summary: List users in the current company
 *     responses:
 *       200: { description: Paginated list of users, content: { application/json: { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }
 *   post:
 *     tags: [Users]
 *     summary: Invite a new user to the company (emails a temporary password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:  { type: string, example: 'Jane Doe' }
 *               email: { type: string, example: 'jane@acme.com' }
 *               role_id: { type: integer, example: 3, description: 'ID from GET /api/v1/users/roles' }
 *     responses:
 *       201: { description: User invited, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *       422: { description: Plan limit reached for users, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/', authorize('users.read'), UserController.getUsers);

/**
 * @swagger
 * /api/v1/users/roles:
 *   get:
 *     tags: [Users]
 *     summary: List available roles that a user can be assigned
 *     responses:
 *       200: { description: List of roles, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.get('/roles', authorize('users.read'), UserController.getRoles);
router.post('/', authorize('users.create'), enforcePlanLimit('users'), validateInviteUser, UserController.inviteUser);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user's role or profile
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               role_id: { type: integer }
 *     responses:
 *       200: { description: User updated, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 *   delete:
 *     tags: [Users]
 *     summary: Remove a user from the company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: User removed, content: { application/json: { schema: { $ref: '#/components/schemas/ApiResponse' } } } }
 */
router.put('/:id', authorize('users.update'), validateUpdateUser, UserController.updateUser);
router.delete('/:id', authorize('users.delete'), UserController.removeUser);

module.exports = router;
