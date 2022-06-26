import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import { createReaction, deleteReaction } from '../controllers/reactionsControllers';

const initializeReactionsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.post('/reactions', { preHandler: [authHandler] }, createReaction);
    fastify.delete('/reactions/:reactionId', { preHandler: [authHandler] }, deleteReaction);

    done?.();
};

export default initializeReactionsRoutes;
