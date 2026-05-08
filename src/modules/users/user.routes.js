const express = require('express');
const userController = require('./user.controller');

const router = express.Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/refresh', userController.refresh);

module.exports = router;
