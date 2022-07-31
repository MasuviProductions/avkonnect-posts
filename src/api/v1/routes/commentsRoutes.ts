import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import {
    createComment,
    deleteComment,
    updateComment,
    getCommentComments,
    getComment,
} from '../controllers/commentsControllers';

const initializeCommentsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.post('/comments', { preHandler: [authHandler] }, createComment);
    fastify.get('/comments/:commentId', { preHandler: [authHandler] }, getComment);
    fastify.delete('/comments/:commentId', { preHandler: [authHandler] }, deleteComment);
    fastify.patch('/comments/:commentId', { preHandler: [authHandler] }, updateComment);
    fastify.get('/comments/:commentId/comments', { preHandler: [authHandler] }, getCommentComments);

    done?.();
};

export default initializeCommentsRoutes;
