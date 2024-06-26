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
    IPostActivityResponse,
} from '../../../interfaces/app';
import { IActivity } from '../../../models/activities';
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

    const relatedUserIds: Array<string> = [];
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
            hashtags: post.hashtags,
            isBanned: false,
            isDeleted: false,
        };

        const taggedUserIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(post));
        taggedUserIds.forEach((userId) => {
            relatedUserIds.push(userId);
        });
        postsInfo.push(postInfo);
    });

    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, relatedUserIds);

    const postsInfoData: IPostsInfoResponse = {
        postsInfo: postsInfo,
        relatedSources: [...(relatedUsersRes.data || [])],
    };

    const response: HttpResponse<IPostsInfoResponse> = {
        success: true,
        data: postsInfoData,
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
        hashtags: body.hashtags,
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
        reportInfo: { reportCount: 0, sources: [] },
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
    const postContents: IPostsContent[] = [...post.contents];
    if (body.content) {
        const updatedPostContent: IPostsContent = {
            ...body.content,
            createdAt: new Date(Date.now()),
        };
        postContents.push(updatedPostContent);
    }
    const updatedPost = await DB_QUERIES.updatePost(postId, {
        ...post,
        contents: postContents,
        hashtags: Array.from(new Set([...(post.hashtags || []), ...(body.hashtags || [])])),
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

export const getPostActivity: RequestHandler<{
    Params: { postId: string };
}> = async (request, reply) => {
    const { postId } = request.params;
    const postActivity = await DB_QUERIES.getActivityByResource(postId, 'post');
    const response: HttpResponse<IPostActivityResponse> = {
        success: true,
        data: postActivity,
    };
    reply.status(200).send(response);
};

export const postBanPost: RequestHandler<{
    Params: { postId: string };
    Body: { banReason: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { postId },
        body,
    } = request;
    if (!authUser) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    // TODO: Check if authorized user is performing ban operation
    const bannedPost = await DB_QUERIES.updatePost(postId, { isBanned: true });
    const postActivity = await DB_QUERIES.getActivityByResource(postId, 'post');
    await DB_QUERIES.updateActivity(postActivity.resourceId, postActivity.resourceType, {
        banInfo: { sourceId: authUser.id, sourceType: SourceType.USER, banReason: body.banReason },
    });
    const response: HttpResponse<IPost> = {
        success: true,
        data: bannedPost,
    };
    reply.status(200).send(response);
};

export const postReportPost: RequestHandler<{
    Params: { postId: string };
    Body: { reportReason: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { postId },
        body,
    } = request;
    if (!authUser) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    // TODO: Check if authorized user is performing report operation
    const postActivity = await DB_QUERIES.getActivityByResource(postId, 'post');
    if (postActivity.reportInfo.sources.find((source) => source.sourceId === authUser.id)) {
        throw new HttpError(ErrorMessage.ReportAlreadyReportedBySource, 400, ErrorCode.RedundantRequest);
    }
    const reportedActivity = await DB_QUERIES.updateActivity(postActivity.resourceId, postActivity.resourceType, {
        reportInfo: {
            reportCount: postActivity.reportInfo.reportCount + 1,
            sources: [
                ...postActivity.reportInfo.sources,
                {
                    sourceId: authUser.id,
                    sourceType: SourceType.USER,
                    reportReason: body.reportReason,
                },
            ],
        },
    });
    const response: HttpResponse<IActivity> = {
        success: true,
        data: reportedActivity,
    };
    reply.status(200).send(response);
};
