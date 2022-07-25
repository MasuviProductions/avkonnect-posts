import { IActivity } from '../models/activities';
import { IComment, ICommentContent } from '../models/comments';
import { IReaction } from '../models/reactions';

export const transformActivitiesListToResourceIdToActivityMap = (
    activities: Array<IActivity>
): Record<string, IActivity> => {
    const activitiesMap: Record<string, IActivity> = {};
    activities.forEach((activity) => {
        activitiesMap[activity.resourceId] = activity;
    });
    return activitiesMap;
};

export const transformReactionsListToResourceIdToReactionMap = (
    reactions: Array<IReaction>
): Record<string, IReaction> => {
    const reactionsMap: Record<string, IReaction> = {};
    reactions.forEach((reaction) => {
        reactionsMap[reaction.resourceId] = reaction;
    });
    return reactionsMap;
};

export const transformCommentsListToResourceIdToCommentMap = (
    comments: Array<IComment>
): Record<string, Array<ICommentContent>> => {
    const commentsMap: Record<string, Array<ICommentContent>> = {};
    comments.forEach((comment) => {
        commentsMap[comment.resourceId] = [
            ...(commentsMap[comment.resourceId] || []),
            comment.contents[comment.contents.length - 1],
        ];
    });
    return commentsMap;
};
