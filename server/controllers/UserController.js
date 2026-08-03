'use strict';

const UserService = require('../services/UserService');
const ApiResponse = require('../utils/ApiResponse');

class UserController {
  static async getUsers(req, res, next) {
    try {
      const users = UserService.listUsers(req.companyId);
      res.json(ApiResponse.success(users, 'Team members fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async getRoles(req, res, next) {
    try {
      const roles = UserService.listRoles();
      res.json(ApiResponse.success(roles, 'Roles fetched successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async inviteUser(req, res, next) {
    try {
      const result = await UserService.inviteUser(req.companyId, req.body, req.userId);
      const message = result.emailSkipped
        ? 'User created, but the invitation email was not delivered because SMTP is not configured. Configure SMTP before asking the user to sign in.'
        : 'Invitation sent successfully.';
      res.status(201).json(ApiResponse.success(result.user, message));
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const user = UserService.updateUser(req.companyId, Number(req.params.id), req.body, req.userId);
      res.json(ApiResponse.success(user, 'Team member updated successfully.'));
    } catch (err) {
      next(err);
    }
  }

  static async removeUser(req, res, next) {
    try {
      UserService.removeUser(req.companyId, Number(req.params.id), req.userId);
      res.json(ApiResponse.success(null, 'Team member removed successfully.'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
