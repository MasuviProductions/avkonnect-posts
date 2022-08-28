import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import { createReaction, deleteReaction, getReaction } from '../controllers/reactionsControllers';

const initializeReactionsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.get('/reactions/:reactionId', { preHandler: [authHandler] }, getReaction);
    fastify.post('/reactions', { preHandler: [authHandler] }, createReaction);
    fastify.delete('/reactions/:resourceType/:resourceId', { preHandler: [authHandler] }, deleteReaction);

    done?.();
};

export default initializeReactionsRoutes;
