import { SQS } from 'aws-sdk';
import ENV from '../../../constants/env';
import { ErrorCode, ErrorMessage } from '../../../constants/errors';
import {
    HttpResponse,
    ICreatePostRequest,
    IFeedsSQSEventRecord,
    IUpdatePostRequest,
    RequestHandler,
} from '../../../interfaces/app';
import { IPost, IPostsContent } from '../../../models/posts';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';
import SQS_QUEUE from '../../../utils/queue';

export const getPost: RequestHandler<{
    Params: { userId: string; postId: string };
}> = async (request, reply) => {
    const {
        params: { postId },
    } = request;
    const post = await DB_QUERIES.getPostById(postId);
    if (!post) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    const response: HttpResponse<IPost> = {
        success: true,
        data: post,
    };
    reply.status(200).send(response);
};

export const createPost: RequestHandler<{
    Body: ICreatePostRequest;
}> = async (request, reply) => {
    const { body, authUser } = request;
    const postContent: IPostsContent = {
        ...body.content,
        createdAt: new Date(Date.now()),
    };
    const post: Partial<IPost> = {
        userId: authUser?.id as string,
        contents: [postContent],
        visibleOnlyToConnections: body.visibleOnlyToConnections,
        commentsOnlyByConnections: body.commentsOnlyByConnections,
    };
    const createdPost = await DB_QUERIES.createPost(post);
    if (!createdPost) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }

    const feedsPostEvent: IFeedsSQSEventRecord = {
        eventType: 'generateFeeds',
        resourceId: createdPost.id,
        resourceType: 'post',
    };
    const feedsQueueParams: SQS.SendMessageRequest = {
        MessageBody: JSON.stringify(feedsPostEvent),
        QueueUrl: ENV.AWS.FEEDS_SQS_URL,
    };
    await SQS_QUEUE.sendMessage(feedsQueueParams).promise();
    const response: HttpResponse<IPost> = {
        success: true,
        data: createdPost,
    };
    reply.status(200).send(response);
};

export const updatePost: RequestHandler<{
    Params: { postId: string };
    Body: IUpdatePostRequest;
}> = async (request, reply) => {
    const {
        body,
        authUser,
        params: { postId },
    } = request;
    const post = await DB_QUERIES.getPostById(postId);
    if (!post) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != post.userId) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    const updatedPostContent: IPostsContent = {
        ...body.content,
        createdAt: new Date(Date.now()),
    };
    const updatedPost = await DB_QUERIES.updatePost(postId, {
        ...post,
        contents: [...post.contents, updatedPostContent],
    });
    const response: HttpResponse<IPost> = {
        success: true,
        data: updatedPost,
    };
    reply.status(200).send(response);
};

export const deletePost: RequestHandler<{
    Params: { postId: string };
}> = async (request, reply) => {
    const {
        params: { postId },
        authUser,
    } = request;
    const post = await DB_QUERIES.getPostById(postId);
    if (!post) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != post.userId) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    const deletedPost = await DB_QUERIES.deletePostById(postId);
    if (!deletedPost) {
        throw new HttpError(ErrorMessage.InternalServerError, 500, ErrorCode.InternalServerError);
    }
    // TODO: Handle deletion of reacts and comments of post
    const response: HttpResponse<IPost> = {
        success: true,
    };
    reply.status(200).send(response);
};

export const getPostReactions: RequestHandler<{
    Params: { postId: string };
}> = async (request, reply) => {
    const {
        params: { postId },
    } = request;
    const reactions = await DB_QUERIES.getReactionsForResource('post', postId);
    const response: HttpResponse = {
        success: true,
        data: reactions || [],
    };
    reply.status(200).send(response);
};

export const getPostComments: RequestHandler<{
    Params: { postId: string };
}> = async (request, reply) => {
    const {
        params: { postId },
    } = request;
    const comments = await DB_QUERIES.getCommentsForResource('post', postId);
    const response: HttpResponse = {
        success: true,
        data: comments || [],
    };
    reply.status(200).send(response);
};
