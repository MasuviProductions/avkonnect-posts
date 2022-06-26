import { FastifyInstance } from 'fastify';
import initializeCommentsRoutes from './commentsRoutes';
import initializePostsRoutes from './postsRoutes';
import initializeReactionsRoutes from './reactionsRoutes';

const initializeV1Routes = (fastifyInstance: FastifyInstance) => {
    const v1ServicePrefix = '/api/posts/v1';
    fastifyInstance.register(initializeCommentsRoutes, { prefix: v1ServicePrefix });
    fastifyInstance.register(initializePostsRoutes, { prefix: v1ServicePrefix });
    fastifyInstance.register(initializeReactionsRoutes, { prefix: v1ServicePrefix });
};

export default initializeV1Routes;
