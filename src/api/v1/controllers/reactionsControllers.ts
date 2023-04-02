import { SQS } from 'aws-sdk';
import { v4 } from 'uuid';
import ENV from '../../../constants/env';
import { ErrorMessage, ErrorCode } from '../../../constants/errors';
import { INotificationActivity } from '../../../interfaces/api';
import {
    RequestHandler,
    ICreateReactionRequest,
    HttpResponse,
    IFeedsSQSEventRecord,
    IReactionResponse,
    IRelatedSource,
} from '../../../interfaces/app';
import { IActivity } from '../../../models/activities';
import { REACTIONS, IReaction, IResourceType } from '../../../models/reactions';
import { SourceType } from '../../../models/shared';
import AVKKONNECT_CORE_SERVICE from '../../../services/avkonnect-core';
import { getResourceBasedOnResourceType, isResouceAComment } from '../../../utils/db/generic';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';
import SQS_QUEUE from '../../../utils/queue';

export const createReaction: RequestHandler<{
    Body: ICreateReactionRequest;
}> = async (request, reply) => {
    const { authUser, body } = request;
    const userId = authUser?.id as string;

    if (!REACTIONS.includes(body.reaction)) {
        throw new HttpError(ErrorMessage.InvalidReactionTypeError, 400, ErrorCode.InputError);
    }
    const resource = await getResourceBasedOnResourceType(body.resourceType, body.resourceId);

    const existingReaction = await DB_QUERIES.getReactionsBySourceForResource(
        userId,
        body.resourceId,
        body.resourceType
    );

    const activity = await DB_QUERIES.getActivityByResource(body.resourceId, body.resourceType);
    if (!activity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

    let reaction: IReaction | undefined = existingReaction;

    if (!existingReaction) {
        reaction = await DB_QUERIES.createReaction({
            id: v4(),
            sourceId: userId,
            sourceType: SourceType.USER,
            createdAt: new Date(Date.now()),
            resourceId: body.resourceId,
            resourceType: body.resourceType,
            reaction: body.reaction,
        });
        if (!reaction) {
            throw new HttpError(ErrorMessage.InvalidReactionTypeError, 400, ErrorCode.InputError);
        }

        const updatedActivity: Partial<Pick<IActivity, 'commentsCount' | 'reactionsCount'>> = {
            reactionsCount: {
                ...activity.reactionsCount,
                [body.reaction]: activity.reactionsCount[body.reaction] + 1,
            },
        };
        await DB_QUERIES.updateActivity(activity.resourceId, activity.resourceType, updatedActivity);
        // NOTE: This reactions is added to connections followers' feeds
        const feedsReactionEvent: IFeedsSQSEventRecord = {
            eventType: 'generateFeeds',
            resourceId: reaction.id,
            resourceType: 'reaction',
        };
        const feedsQueueParams: SQS.SendMessageRequest = {
            MessageBody: JSON.stringify(feedsReactionEvent),
            QueueUrl: ENV.AWS.FEEDS_SQS_URL,
        };
        await SQS_QUEUE.sendMessage(feedsQueueParams).promise();

        let notificationActivity: INotificationActivity | undefined;
        // NOTE: Notify the owner of the post regarding reactions
        if (resource.sourceId != authUser?.id) {
            if (isResouceAComment(resource)) {
                notificationActivity = {
                    resourceId: resource.id,
                    resourceType: 'comment',
                    resourceActivity: 'commentReaction',
                    sourceId: userId,
                    sourceType: SourceType.USER,
                };
            } else {
                notificationActivity = {
                    resourceId: resource.id,
                    resourceType: 'post',
                    resourceActivity: 'postReaction',
                    sourceId: userId,
                    sourceType: SourceType.USER,
                };
            }
            const notificationQueueParams: SQS.SendMessageRequest = {
                MessageBody: JSON.stringify(notificationActivity),
                QueueUrl: ENV.AWS.NOTIFICATIONS_SQS_URL,
            };
            await SQS_QUEUE.sendMessage(notificationQueueParams).promise();
        }
    } else {
        if (existingReaction.reaction != body.reaction) {
            reaction = await DB_QUERIES.updateReactionTypeForReaction(
                userId,
                existingReaction.createdAt,
                body.reaction
            );

            if (!reaction) {
                throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
            }
            const updatedActivity: Partial<Pick<IActivity, 'commentsCount' | 'reactionsCount'>> = {
                reactionsCount: {
                    ...activity.reactionsCount,
                    [body.reaction]: activity.reactionsCount[body.reaction] + 1,
                    [existingReaction.reaction]: activity.reactionsCount[existingReaction.reaction] - 1,
                },
            };
            await DB_QUERIES.updateActivity(activity.resourceId, activity.resourceType, updatedActivity);
        }
    }

    if (!reaction) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }

    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, [reaction.sourceId]);

    const reactionInfo: IReactionResponse = {
        ...reaction,
        relatedSource: relatedUsersRes.data?.[0] as IRelatedSource,
    };

    const response: HttpResponse<IReactionResponse> = {
        success: true,
        data: reactionInfo,
    };
    reply.status(200).send(response);
};

export const getReaction: RequestHandler<{
    Params: { reactionId: string };
}> = async (request, reply) => {
    const {
        params: { reactionId },
    } = request;
    const reaction = await DB_QUERIES.getReaction(reactionId);
    if (!reaction) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    const relatedUsersRes = await AVKKONNECT_CORE_SERVICE.getUsersInfo(ENV.AUTH_SERVICE_KEY, [reaction.sourceId]);

    const reactionInfo: IReactionResponse = {
        ...reaction,
        relatedSource: relatedUsersRes.data?.[0] as IRelatedSource,
    };

    const response: HttpResponse<IReactionResponse> = {
        success: true,
        data: reactionInfo,
    };
    reply.status(200).send(response);
};

export const deleteReaction: RequestHandler<{
    Params: { resourceType: IResourceType; resourceId: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { resourceId, resourceType },
    } = request;
    const userId = authUser?.id as string;

    await getResourceBasedOnResourceType(resourceType, resourceId);

    const existingReaction = await DB_QUERIES.getReactionsBySourceForResource(userId, resourceId, resourceType);

    if (!existingReaction) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }
    await DB_QUERIES.deleteReaction(userId, existingReaction.createdAt);
    const activity = await DB_QUERIES.getActivityByResource(existingReaction.resourceId, existingReaction.resourceType);
    if (!activity) {
        throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
    }

    const updatedActivity: Partial<Pick<IActivity, 'commentsCount' | 'reactionsCount'>> = {
        reactionsCount: {
            ...activity.reactionsCount,
            [existingReaction.reaction]: activity.reactionsCount[existingReaction.reaction] - 1,
        },
    };
    await DB_QUERIES.updateActivity(existingReaction.resourceId, existingReaction.resourceType, updatedActivity);

    const response: HttpResponse = {
        success: true,
    };
    reply.status(200).send(response);
};
