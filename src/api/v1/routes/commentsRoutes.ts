import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import {
    createComment,
    deleteComment,
    updateComment,
    getCommentComments,
    getComment,
    getCommentActivity,
    postBanComment,
    postReportComment,
    getCommentReactions,
} from '../controllers/commentsControllers';

const initializeCommentsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.get('/comments/:commentId/activity', { preHandler: [authHandler] }, getCommentActivity);
    fastify.post('/comments', { preHandler: [authHandler] }, createComment);
    fastify.get('/comments/:commentId', { preHandler: [authHandler] }, getComment);
    fastify.delete('/comments/:commentId', { preHandler: [authHandler] }, deleteComment);
    fastify.patch('/comments/:commentId', { preHandler: [authHandler] }, updateComment);
    fastify.get('/comments/:commentId/comments', { preHandler: [authHandler] }, getCommentComments);
    fastify.post('/comments/:commentId/ban', { preHandler: [authHandler] }, postBanComment);
    fastify.get('/comments/:commentId/reactions', { preHandler: [authHandler] }, getCommentReactions);
    fastify.post('/comments/:commentId/report', { preHandler: [authHandler] }, postReportComment);

    done?.();
};

export default initializeCommentsRoutes;
