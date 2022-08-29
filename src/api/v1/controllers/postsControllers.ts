import { SQS } from 'aws-sdk';
import { ObjectType } from 'dynamoose/dist/General';
import { v4 } from 'uuid';
import ENV from '../../../constants/env';
import { ErrorCode, ErrorMessage } from '../../../constants/errors';
import {
    HttpResponse,
    ICreatePostRequest,
    IFeedsSQSEventRecord,
    IPostReactionsResponse,
    IPostCommentsResponse,
    IPostsInfo,
    IPostsInfoRequest,
    IPostsInfoResponse,
    IUpdatePostRequest,
    RequestHandler,
    IPostResponse,
    IPostActivityResponse,
    ICommentApiModel,
} from '../../../interfaces/app';
import { IActivity } from '../../../models/activities';
import { IComment, ICommentContent } from '../../../models/comments';
import { IPost, IPostsContent } from '../../../models/posts';
import { IReaction, IReactionType } from '../../../models/reactions';
import { SourceType } from '../../../models/shared';
import AVKKONNECT_CORE_SERVICE from '../../../services/avkonnect-core';
import { getSourceActivityForResources } from '../../../utils/db/generic';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';
import { getSourceIdsFromSourceMarkups, getSourceMarkupsFromPostOrComment } from '../../../utils/generic';
import SQS_QUEUE from '../../../utils/queue';
import { transformActivitiesListToResourceIdToActivityMap } from '../../../utils/transformers';

export const getPost: RequestHandler<{
    Params: { postId: string };
}> = async (request, reply) => {
    const {
        params: { postId },
        authUser,
    } = request;

    const userId = authUser?.id;
    const post = await DB_QUERIES.getPostById(postId);
    if (!post) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(post));
    userIds.push(post.sourceId);
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);

    const activity = await DB_QUERIES.getActivityByResource(post.id, 'post');
    if (!activity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

    let sourceComments: Record<string, ICommentContent[]> | undefined;
    let sourceReactions: Record<string, IReaction> | undefined;
    if (userId) {
        const sourceActivities = await getSourceActivityForResources(userId as string, new Set([postId]), 'post');
        sourceComments = sourceActivities.sourceComments;
        sourceReactions = sourceActivities.sourceReactions;
    }

    const postInfo: IPostResponse = {
        ...post,
        activity,
        sourceActivity: { reaction: sourceReactions?.[post.id]?.reaction, comments: sourceComments?.[post.id] },
        relatedSources: relatedUsersRes.data || [],
    };
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
    let sourceReactions: Record<string, IReaction> | undefined;
    let sourceComments: Record<string, Array<ICommentContent>> | undefined;

    if (userId) {
        const sourceActivities = await getSourceActivityForResources(userId, postIds, 'post');
        sourceReactions = sourceActivities.sourceReactions;
        sourceComments = sourceActivities.sourceComments;
    }

    const relatedUserIds: Array<string> = [];
    const postsInfo: Array<IPostsInfo> = [];
    posts.forEach((post) => {
        const activity = postIdToActivitiesMap[post.id];
        const postInfo: IPostsInfo = {
            postId: post.id,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            sourceId: post.sourceId,
            sourceType: SourceType.USER,
            contents: post.contents,
            visibleOnlyToConnections: post.visibleOnlyToConnections,
            commentsOnlyByConnections: post.commentsOnlyByConnections,
            activity: activity,
            sourceActivity: {
                reaction: sourceReactions?.[post.id]?.reaction,
                comments: sourceComments?.[post.id],
            },
            hashtags: post.hashtags,
            isBanned: false,
            isDeleted: false,
        };

        relatedUserIds.push(post.sourceId);
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
        reactionsCount: {
            like: 0,
            support: 0,
            sad: 0,
            love: 0,
            laugh: 0,
        },
        commentsCount: { comment: 0, subComment: 0 },
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
    userIds.push(createdPost.sourceId);
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);

    const createdPostInfo: IPostResponse = {
        ...createdPost,
        activity: createdActivity,
        relatedSources: relatedUsersRes.data || [],
    };
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
    const activity = await DB_QUERIES.getActivityByResource(updatedPost.id as string, 'post');
    if (!activity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(updatedPost));
    userIds.push(updatedPost.sourceId);
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);

    const { sourceReactions, sourceComments } = await getSourceActivityForResources(
        authUser.id,
        new Set([postId]),
        'post'
    );
    const updatedPostInfo: IPostResponse = {
        ...updatedPost,
        activity: activity,
        sourceActivity: {
            reaction: sourceReactions?.[updatedPost.id]?.reaction,
            comments: sourceComments?.[updatedPost.id],
        },
        relatedSources: relatedUsersRes.data || [],
    };
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
        authUser,
    } = request;
    const paginatedDocuments = await DB_QUERIES.getCommentsForResource(
        'post',
        postId,
        limit,
        nextSearchStartFromKey ? (JSON.parse(decodeURI(nextSearchStartFromKey)) as ObjectType) : undefined
    );

    const comments = paginatedDocuments.documents;
    const commentIds: Set<string> = new Set();
    const relatedUserIds = new Set<string>();
    comments?.forEach((comment) => {
        commentIds.add(comment.id as string);
        relatedUserIds.add(comment.sourceId as string);

        const taggedUserIds = getSourceIdsFromSourceMarkups(
            SourceType.USER,
            getSourceMarkupsFromPostOrComment(comment as IComment)
        );
        taggedUserIds.forEach((taggedUserId) => {
            relatedUserIds.add(taggedUserId);
        });
    });

    const activities = await DB_QUERIES.getActivitiesByResourceIds(commentIds, 'comment');

    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(
        ENV.AUTH_SERVICE_KEY,
        Array.from(relatedUserIds)
    );

    const { sourceReactions } = await getSourceActivityForResources(authUser?.id as string, commentIds, 'comment');

    const commentsWithActivity: ICommentApiModel[] | undefined = comments?.map((comment) => {
        const activity = activities.find((act) => act.resourceId === comment.id);
        return {
            ...(comment as IComment),
            sourceActivity: { reaction: sourceReactions?.[(comment as IComment).id]?.reaction },
            activity: activity as IActivity,
        };
    });

    const postComments: IPostCommentsResponse = {
        comments: commentsWithActivity || [],
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
    if (!postActivity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

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
    if (!postActivity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

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
