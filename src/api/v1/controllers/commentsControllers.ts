import { SQS } from 'aws-sdk';
import { ObjectType } from 'dynamoose/dist/General';
import { v4 } from 'uuid';
import ENV from '../../../constants/env';
import { ErrorMessage, ErrorCode } from '../../../constants/errors';
import { INotificationActivity } from '../../../interfaces/api';
import {
    RequestHandler,
    ICreateCommentRequest,
    HttpResponse,
    IUpdateCommentRequest,
    IFeedsSQSEventRecord,
    ICommentResponse,
    ICommentCommentsResponse,
    ICommentActivityResponse,
} from '../../../interfaces/app';
import { IActivity } from '../../../models/activities';
import { IComment, ICommentContent } from '../../../models/comments';
import { SourceType } from '../../../models/shared';
import AVKKONNECT_CORE_SERVICE from '../../../services/avkonnect-core';
import { getResourceBasedOnResourceType, isResouceAComment } from '../../../utils/db/generic';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';
import { getSourceIdsFromSourceMarkups, getSourceMarkupsFromPostOrComment } from '../../../utils/generic';
import SQS_QUEUE from '../../../utils/queue';

export const createComment: RequestHandler<{
    Body: ICreateCommentRequest;
}> = async (request, reply) => {
    const { authUser, body } = request;
    const resource = await getResourceBasedOnResourceType(body.resourceType, body.resourceId);

    const currentTime = Date.now();
    const comment: IComment = {
        id: v4(),
        sourceId: authUser?.id as string,
        sourceType: SourceType.USER,
        createdAt: new Date(currentTime),
        resourceId: body.resourceId,
        resourceType: body.resourceType,
        contents: [{ ...body.comment, createdAt: new Date(currentTime) }],
        isBanned: false,
        isDeleted: false,
    };
    const createdComment = await DB_QUERIES.createComment(comment);
    if (!createdComment) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }

    const createdActivityForComment = await DB_QUERIES.createActivity({
        id: v4(),
        resourceId: createdComment.id,
        resourceType: 'comment',
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

    const activity = await DB_QUERIES.getActivityByResource(body.resourceId, body.resourceType);
    const updatedActivityForResource: Partial<Pick<IActivity, 'commentsCount' | 'reactions'>> = {
        commentsCount: activity.commentsCount + 1,
    };
    await DB_QUERIES.updateActivity(activity.resourceId, activity.resourceType, updatedActivityForResource);

    if (!createdActivityForComment) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }

    // NOTE: This comment is added to connections'/followers' feeds
    const feedsCommentEvent: IFeedsSQSEventRecord = {
        eventType: 'generateFeeds',
        resourceId: createdComment.id,
        resourceType: 'comment',
    };
    const feedsQueueParams: SQS.SendMessageRequest = {
        MessageBody: JSON.stringify(feedsCommentEvent),
        QueueUrl: ENV.AWS.FEEDS_SQS_URL,
    };
    await SQS_QUEUE.sendMessage(feedsQueueParams).promise();

    // NOTE: Notify the owner of the post regarding reactions
    let notificationActivity: INotificationActivity;
    if (isResouceAComment(resource)) {
        notificationActivity = {
            resourceId: resource?.id,
            resourceType: 'comment',
            resourceActivity: 'commentComment',
            sourceId: authUser?.id as string,
            sourceType: SourceType.USER,
        };
    } else {
        notificationActivity = {
            resourceId: resource?.id,
            resourceType: 'post',
            resourceActivity: 'postComment',
            sourceId: authUser?.id as string,
            sourceType: SourceType.USER,
        };
    }

    const notificationQueueParams: SQS.SendMessageRequest = {
        MessageBody: JSON.stringify(notificationActivity),
        QueueUrl: ENV.AWS.NOTIFICATIONS_SQS_URL,
    };
    await SQS_QUEUE.sendMessage(notificationQueueParams).promise();

    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(createdComment));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const createdCommentInfo: ICommentResponse = {
        ...createdComment,
        relatedSources: [...(relatedUsersRes.data || [])],
    };
    const response: HttpResponse<ICommentResponse> = {
        success: true,
        data: createdCommentInfo,
    };
    reply.status(200).send(response);
};

export const getComment: RequestHandler<{
    Params: { commentId: string };
}> = async (request, reply) => {
    const {
        params: { commentId },
    } = request;
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(comment));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const commentInfo: ICommentResponse = {
        ...comment,
        relatedSources: [...(relatedUsersRes.data || [])],
    };
    const response: HttpResponse<ICommentResponse> = {
        success: true,
        data: commentInfo,
    };
    reply.status(200).send(response);
};

export const updateComment: RequestHandler<{
    Params: { commentId: string };
    Body: IUpdateCommentRequest;
}> = async (request, reply) => {
    const {
        authUser,
        body,
        params: { commentId },
    } = request;
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != comment.sourceId) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    const newCommentContent: ICommentContent = { ...body.comment, createdAt: new Date(Date.now()) };
    const updatedComment = await DB_QUERIES.updateComment(comment.sourceId, comment.createdAt, {
        contents: [...comment.contents, newCommentContent],
    });
    if (!updatedComment) {
        throw new HttpError(ErrorMessage.BadRequest, 400, ErrorCode.BadRequest);
    }
    const userIds = getSourceIdsFromSourceMarkups(SourceType.USER, getSourceMarkupsFromPostOrComment(updatedComment));
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, userIds);
    const updatedCommentInfo: ICommentResponse = {
        ...updatedComment,
        relatedSources: [...(relatedUsersRes.data || [])],
    };
    const response: HttpResponse<ICommentResponse> = {
        success: true,
        data: updatedCommentInfo,
    };
    reply.status(200).send(response);
};

export const deleteComment: RequestHandler<{
    Params: { commentId: string };
}> = async (request, reply) => {
    const {
        params: { commentId },
        authUser,
    } = request;
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    if (authUser?.id != comment.sourceId) {
        if (comment.resourceType === 'comment') {
            const parentComment = await DB_QUERIES.getCommentById(comment.resourceId);
            if (authUser?.id !== parentComment?.sourceId) {
                throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
            }
        } else if (comment.resourceType === 'post') {
            const parentPost = await DB_QUERIES.getPostById(comment.resourceId);
            if (authUser?.id !== parentPost?.sourceId) {
                throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
            }
        } else {
            throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
        }
    }
    await DB_QUERIES.deleteComment(comment.sourceId, comment.createdAt);

    const activity = await DB_QUERIES.getActivityByResource(comment.resourceId, comment.resourceType);
    const updatedActivityForResource: Partial<Pick<IActivity, 'commentsCount' | 'reactions'>> = {
        commentsCount: activity.commentsCount - 1,
    };
    await DB_QUERIES.updateActivity(activity.resourceId, activity.resourceType, updatedActivityForResource);

    // TODO: Handle deletion of reacts and comments of comment
    const response: HttpResponse = {
        success: true,
    };
    reply.status(200).send(response);
};

export const getCommentComments: RequestHandler<{
    Params: { commentId: string };
    Querystring: { limit: number; nextSearchStartFromKey: string };
}> = async (request, reply) => {
    const {
        params: { commentId },
        query: { limit, nextSearchStartFromKey },
    } = request;
    const paginatedDocuments = await DB_QUERIES.getCommentsForResource(
        'comment',
        commentId,
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

    const commentsInfo: ICommentCommentsResponse = {
        comments: comments as IComment[],
        relatedSources: [...(relatedUsersRes.data || [])],
    };

    const response: HttpResponse<ICommentCommentsResponse> = {
        success: true,
        data: commentsInfo,
        dDBPagination: paginatedDocuments.dDBPagination,
    };
    reply.status(200).send(response);
};

export const getCommentActivity: RequestHandler<{
    Params: { commentId: string };
}> = async (request, reply) => {
    const { commentId } = request.params;
    const commentActivity = await DB_QUERIES.getActivityByResource(commentId, 'comment');
    const response: HttpResponse<ICommentActivityResponse> = {
        success: true,
        data: commentActivity,
    };
    reply.status(200).send(response);
};

export const postBanComment: RequestHandler<{
    Params: { commentId: string };
    Body: { banReason: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { commentId },
        body,
    } = request;

    if (!authUser) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    // TODO: Check if authorized user is performing ban operation
    const comment = await DB_QUERIES.getCommentById(commentId);
    if (!comment) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    const bannedPost = await DB_QUERIES.updateComment(comment.sourceId, comment.createdAt, { isBanned: true });
    const postActivity = await DB_QUERIES.getActivityByResource(commentId, 'comment');
    await DB_QUERIES.updateActivity(postActivity.resourceId, postActivity.resourceType, {
        banInfo: { sourceId: authUser.id, sourceType: SourceType.USER, banReason: body.banReason },
    });
    const response: HttpResponse<IComment> = {
        success: true,
        data: bannedPost,
    };
    reply.status(200).send(response);
};

export const postReportComment: RequestHandler<{
    Params: { commentId: string };
    Body: { reportReason: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { commentId },
        body,
    } = request;
    if (!authUser) {
        throw new HttpError(ErrorMessage.AuthorizationError, 403, ErrorCode.AuthorizationError);
    }
    // TODO: Check if authorized user is performing report operation
    const commentActivity = await DB_QUERIES.getActivityByResource(commentId, 'comment');
    if (commentActivity.reportInfo.sources.find((source) => source.sourceId === authUser.id)) {
        throw new HttpError(ErrorMessage.ReportAlreadyReportedBySource, 400, ErrorCode.RedundantRequest);
    }
    const reportedActivity = await DB_QUERIES.updateActivity(commentActivity.resourceId, commentActivity.resourceType, {
        reportInfo: {
            reportCount: commentActivity.reportInfo.reportCount + 1,
            sources: [
                ...commentActivity.reportInfo.sources,
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
