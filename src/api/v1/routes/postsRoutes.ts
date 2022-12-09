import { FastifyInstance, FastifyPluginOptions, FastifyRegisterOptions } from 'fastify';
import { authHandler } from '../../../middlewares/authHandler';
import {
    createPost,
    getPost,
    deletePost,
    getPostReactions,
    updatePost,
    getPostComments,
    getPostsInfo,
    getTrendingPosts,
    getUsersPosts,
    getPostActivity,
    getTrendingPostsInfo,
    postBanPost,
    postReportPost,
} from '../controllers/postsControllers';

const initializePostsRoutes = (
    fastify: FastifyInstance,
    _opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    done?: () => void
) => {
    fastify.get('/posts/:postId/activity', { preHandler: [authHandler] }, getPostActivity);
    fastify.post('/posts/getPostsInfo', { preHandler: [authHandler] }, getPostsInfo);
    fastify.get('/posts/:postId', { preHandler: [authHandler] }, getPost);
    fastify.post('/posts', { preHandler: [authHandler] }, createPost);
    fastify.patch('/posts/:postId', { preHandler: [authHandler] }, updatePost);
    fastify.delete('/posts/:postId', { preHandler: [authHandler] }, deletePost);
    fastify.get('/posts/:postId/reactions', { preHandler: [authHandler] }, getPostReactions);
    fastify.get('/posts/:postId/comments', { preHandler: [authHandler] }, getPostComments);
    fastify.get('/users/:userId/posts', { preHandler: [authHandler] }, getUsersPosts);
    fastify.post('/posts/:postId/ban', { preHandler: [authHandler] }, postBanPost);
    fastify.post('/posts/:postId/report', { preHandler: [authHandler] }, postReportPost);
    fastify.post('/posts/:postId/trending', getTrendingPosts);
    fastify.post('/posts/trending', getTrendingPostsInfo);

    done?.();
};

export default initializePostsRoutes;
