import { SQS } from 'aws-sdk';
import { ObjectType } from 'dynamoose/dist/General';
import { v4 } from 'uuid';
import ENV from '../../../constants/env';
import { ErrorCode, ErrorMessage } from '../../../constants/errors';
import {
    HttpResponse,
    ICreatePostRequest,
    IFeedsSQSEventRecord,
    IPostInfoSourceActivity,
    IPostReactionsResponse,
    IPostCommentsResponse,
    IPostsInfo,
    IPostsInfoRequest,
    IPostsInfoResponse,
    IUpdatePostRequest,
    RequestHandler,
    IPostResponse,
} from '../../../interfaces/app';
import { IComment, ICommentContent } from '../../../models/comments';
import { IPost, IPostsContent } from '../../../models/posts';
import { IReaction, IReactionType } from '../../../models/reactions';
import { SourceType } from '../../../models/shared';
import AVKKONNECT_CORE_SERVICE from '../../../services/avkonnect-core';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';
import { getSourceIdsFromSourceMarkups, getSourceMarkupsFromPostOrComment } from '../../../utils/generic';
import SQS_QUEUE from '../../../utils/queue';
import {
    transformActivitiesListToResourceIdToActivityMap,
    transformCommentsListToResourceIdToCommentMap,
    transformReactionsListToResourceIdToReactionMap,
} from '../../../utils/transformers';

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
    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(post));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const postInfo: IPostResponse = { ...post, relatedSources: relatedUsersRes.data || [] };
    const response: HttpResponse<IPostResponse> = {
        success: true,
        data: postInfo,
    };
    reply.status(200).send(response);
};

export const getPostsInfo: RequestHandler<{
    Body: IPostsInfoRequest;
}> = async (request, reply) => {
    const { body } = request;
    const postIds = new Set(body.postIds);
    const userId = body.sourceId;
    const posts = await DB_QUERIES.getPostsByIds(postIds);
    if (!posts) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    const postsActivities = await DB_QUERIES.getActivitiesByResourceIds(postIds, 'post');
    const postIdToActivitiesMap = transformActivitiesListToResourceIdToActivityMap(postsActivities);
    let sourceReactions: Record<string, IReaction>;
    let sourceComments: Record<string, Array<ICommentContent>>;

    if (userId) {
        const postReactions = await DB_QUERIES.getReactionsByResourceIdsForSource(userId, postIds, 'post');
        sourceReactions = transformReactionsListToResourceIdToReactionMap(postReactions);

        const postComments = await DB_QUERIES.getCommentsByResourceIdsForSource(userId, postIds, 'post', 5);
        sourceComments = transformCommentsListToResourceIdToCommentMap(postComments.documents as Array<IComment>);
    }

    const postsInfo: Array<IPostsInfo> = [];
    posts.forEach((post) => {
        const activity = postIdToActivitiesMap[post.id];
        let sourcePostInfoActivity: IPostInfoSourceActivity | undefined = undefined;
        const sourcePostReaction = sourceReactions?.[post.id]?.reaction;
        const sourcePostComments = sourceComments?.[post.id];
        if (sourcePostReaction || sourcePostComments) {
            sourcePostInfoActivity = { sourceReaction: sourcePostReaction, sourceComments: sourcePostComments };
        }
        const postInfo: IPostsInfo = {
            postId: post.id,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            sourceId: post.sourceId,
            sourceType: SourceType.USER,
            contents: post.contents,
            visibleOnlyToConnections: post.visibleOnlyToConnections,
            commentsOnlyByConnections: post.commentsOnlyByConnections,
            reactionsCount: activity.reactions,
            commentsCount: activity.commentsCount,
            sourceActivity: sourcePostInfoActivity,
        };
        postsInfo.push(postInfo);
    });

    const response: HttpResponse<IPostsInfoResponse> = {
        success: true,
        data: postsInfo,
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
        sourceId: authUser?.id as string,
        sourceType: SourceType.USER,
        contents: [postContent],
        visibleOnlyToConnections: body.visibleOnlyToConnections,
        commentsOnlyByConnections: body.commentsOnlyByConnections,
    };
    const createdPost = await DB_QUERIES.createPost(post);
    if (!createdPost) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }

    const createdActivity = await DB_QUERIES.createActivity({
        id: v4(),
        resourceId: createdPost.id,
        resourceType: 'post',
        reactions: {
            like: 0,
            support: 0,
            sad: 0,
            love: 0,
            laugh: 0,
        },
        commentsCount: 0,
    });
    if (!createdActivity) {
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
    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(createdPost));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const createdPostInfo: IPostResponse = { ...createdPost, relatedSources: relatedUsersRes.data || [] };
    const response: HttpResponse<IPostResponse> = {
        success: true,
        data: createdPostInfo,
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
    if (authUser?.id != post.sourceId) {
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
    if (!updatedPost) {
        throw new HttpError(ErrorMessage.BadRequest, 400, ErrorCode.BadRequest);
    }
    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(updatedPost));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const updatedPostInfo: IPostResponse = { ...updatedPost, relatedSources: relatedUsersRes.data || [] };
    const response: HttpResponse<IPostResponse> = {
        success: true,
        data: updatedPostInfo,
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
    if (authUser?.id != post.sourceId) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    const deletedPost = await DB_QUERIES.deletePostById(postId);
    if (!deletedPost) {
        throw new HttpError(ErrorMessage.InternalServerError, 500, ErrorCode.InternalServerError);
    }
    // TODO: Handle deletion of reacts and comments of post
    const response: HttpResponse = {
        success: true,
    };
    reply.status(200).send(response);
};

export const getPostReactions: RequestHandler<{
    Params: { postId: string };
    Querystring: { reaction: IReactionType; limit: number; nextSearchStartFromKey: string };
}> = async (request, reply) => {
    const {
        params: { postId },
        query: { reaction, limit, nextSearchStartFromKey },
    } = request;
    const paginatedDocuments = await DB_QUERIES.getReactionsForResource(
        'post',
        postId,
        reaction,
        limit,
        nextSearchStartFromKey ? (JSON.parse(decodeURI(nextSearchStartFromKey)) as ObjectType) : undefined
    );
    const reactions = paginatedDocuments.documents as IReaction[];
    const relatedUserIds = new Set<string>();
    paginatedDocuments.documents?.forEach((reaction) => {
        relatedUserIds.add(reaction.sourceId as string);
        const taggedUserIds = getSourceIdsFromSourceMarkups(
            SourceType.USER,
            getSourceMarkupsFromPostOrComment(reaction as IComment)
        );
        taggedUserIds.forEach((taggedUserId) => {
            relatedUserIds.add(taggedUserId);
        });
    });
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(
        ENV.AUTH_SERVICE_KEY,
        Array.from(relatedUserIds)
    );
    const postReactions: IPostReactionsResponse = {
        reactions: reactions,
        relatedSources: [...(relatedUsersRes.data || [])],
    };
    const response: HttpResponse<IPostReactionsResponse> = {
        success: true,
        data: postReactions,
        dDBPagination: paginatedDocuments.dDBPagination,
    };
    reply.status(200).send(response);
};

export const getPostComments: RequestHandler<{
    Params: { postId: string };
    Querystring: { limit: number; nextSearchStartFromKey: string };
}> = async (request, reply) => {
    const {
        params: { postId },
        query: { limit, nextSearchStartFromKey },
    } = request;
    const paginatedDocuments = await DB_QUERIES.getCommentsForResource(
        'post',
        postId,
        limit,
        nextSearchStartFromKey ? (JSON.parse(decodeURI(nextSearchStartFromKey)) as ObjectType) : undefined
    );

    const comments = paginatedDocuments.documents;
    const relatedUserIds = new Set<string>();
    comments?.forEach((comment) => {
        relatedUserIds.add(comment.sourceId as string);

        const taggedUserIds = getSourceIdsFromSourceMarkups(
            SourceType.USER,
            getSourceMarkupsFromPostOrComment(comment as IComment)
        );
        taggedUserIds.forEach((taggedUserId) => {
            relatedUserIds.add(taggedUserId);
        });
    });

    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(
        ENV.AUTH_SERVICE_KEY,
        Array.from(relatedUserIds)
    );

    const postComments: IPostCommentsResponse = {
        comments: comments as IComment[],
        relatedSources: [...(relatedUsersRes.data || [])],
    };

    const response: HttpResponse<IPostCommentsResponse> = {
        success: true,
        data: postComments,
        dDBPagination: paginatedDocuments.dDBPagination,
    };
    reply.status(200).send(response);
};
