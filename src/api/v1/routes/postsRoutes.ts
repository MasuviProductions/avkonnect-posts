import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import {
    createPost,
    getPost,
    deletePost,
    getPostReactions,
    updatePost,
    getPostComments,
} from '../controllers/postsControllers';

const initializePostsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.get('/posts/:postId', { preHandler: [authHandler] }, getPost);
    fastify.post('/posts', { preHandler: [authHandler] }, createPost);
    fastify.patch('/posts/:postId', { preHandler: [authHandler] }, updatePost);
    fastify.delete('/posts/:postId', { preHandler: [authHandler] }, deletePost);
    fastify.get('/posts/:postId/reactions', { preHandler: [authHandler] }, getPostReactions);
    fastify.get('/posts/:postId/comments', { preHandler: [authHandler] }, getPostComments);

    done?.();
};

export default initializePostsRoutes;