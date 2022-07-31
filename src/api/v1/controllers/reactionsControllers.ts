import { v4 } from 'uuid';
import { ErrorMessage, ErrorCode } from '../../../constants/errors';
import { RequestHandler, ICreateReactionRequest, HttpResponse } from '../../../interfaces/app';
import { IActivity } from '../../../models/activities';
import { REACTIONS, IReaction } from '../../../models/reactions';
import { throwErrorIfResourceNotFound } from '../../../utils/db/generic';
import DB_QUERIES from '../../../utils/db/queries';
import { HttpError } from '../../../utils/error';

export const createReaction: RequestHandler<{
    Body: ICreateReactionRequest;
}> = async (request, reply) => {
    const { authUser, body } = request;
    const userId = authUser?.id as string;

    if (!REACTIONS.includes(body.reaction)) {
        throw new HttpError(ErrorMessage.InvalidReactionTypeError, 400, ErrorCode.InputError);
    }
    await throwErrorIfResourceNotFound(body.resourceType, body.resourceId);
    const existingReaction = await DB_QUERIES.getReactionsByUserIdForResource(
        userId,
        body.resourceId,
        body.resourceType
    );
    let reaction: IReaction | undefined = existingReaction;
    if (!existingReaction) {
        reaction = await DB_QUERIES.createReaction({
            id: v4(),
            userId: userId,
            createdAt: new Date(Date.now()),
            resourceId: body.resourceId,
            resourceType: body.resourceType,
            reaction: body.reaction,
        });
        const activity = await DB_QUERIES.getActivityByResource(body.resourceId, body.resourceType);
        const updatedActivity: Partial<Pick<IActivity, 'commentsCount' | 'reactions'>> = {
            reactions: {
                ...activity.reactions,
                [body.reaction]: activity.reactions[body.reaction] + 1,
            },
        };
        await DB_QUERIES.updateActivity(activity.resourceId, activity.resourceType, updatedActivity);
    } else {
        if (existingReaction.reaction != body.reaction) {
            reaction = await DB_QUERIES.updateReactionTypeForReaction(
                userId,
                existingReaction.createdAt,
                body.reaction
            );
        }
    }
    if (!reaction) {
        throw new HttpError(ErrorMessage.CreationError, 400, ErrorCode.CreationError);
    }
    const response: HttpResponse<IReaction> = {
        success: true,
        data: reaction,
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
    const response: HttpResponse<IReaction> = {
        success: true,
        data: reaction,
    };
    reply.status(200).send(response);
};

export const deleteReaction: RequestHandler<{
    Params: { reactionId: string };
}> = async (request, reply) => {
    const {
        authUser,
        params: { reactionId },
    } = request;
    const userId = authUser?.id as string;
    const existingReaction = await DB_QUERIES.getReactionByIdForUser(reactionId, userId);
    if (existingReaction) {
        await DB_QUERIES.deleteReaction(userId, existingReaction.createdAt);
        const activity = await DB_QUERIES.getActivityByResource(
            existingReaction.resourceId,
            existingReaction.resourceType
        );
        const updatedActivity: Partial<Pick<IActivity, 'commentsCount' | 'reactions'>> = {
            reactions: {
                ...activity.reactions,
                [existingReaction.reaction]: activity.reactions[existingReaction.reaction] - 1,
            },
        };
        await DB_QUERIES.updateActivity(existingReaction.resourceId, existingReaction.resourceType, updatedActivity);
    }
    const response: HttpResponse = {
        success: true,
    };
    reply.status(200).send(response);
};
