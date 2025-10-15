import express from 'express';
import {
    handleDeleteUserByUserName,
    handleDeleteUserByUserId,
    handlePostUsersToBase,
    handlePostedAndEditUser,
    handleDeleteUserAndAllByUserId
} from '../controllers/UserController';

const router = express.Router();

router.delete('/api/users/name/:userName', handleDeleteUserByUserName);
router.delete('/api/users/:userId', handleDeleteUserByUserId);
router.delete('/api/users/:userId/full', handleDeleteUserAndAllByUserId);
router.post('/api/usersBase', handlePostUsersToBase);
router.put('/api/listings/:id', handlePostedAndEditUser);

export default router;