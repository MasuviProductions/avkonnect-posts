import { ErrorCode, ErrorMessage } from '../../constants/errors';
import { IComment, ICommentContent } from '../../models/comments';
import { IPost } from '../../models/posts';
import { IReaction, IResourceType } from '../../models/reactions';
import { HttpError } from '../error';
import {
    transformCommentsListToResourceIdToCommentMap,
    transformReactionsListToResourceIdToReactionMap,
} from '../transformers';
import DB_QUERIES from './queries';

export const getResourceBasedOnResourceType = async (
    resourceType: IResourceType,
    resourceId: string
): Promise<IPost | IComment> => {
    switch (resourceType) {
        case 'post': {
            const post = await DB_QUERIES.getPostById(resourceId);
            if (!post) {
                throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
            }
            return post;
        }
        case 'comment': {
            const comment = await DB_QUERIES.getCommentById(resourceId);
            if (!comment) {
                throw new HttpError(ErrorMessage.NotFound, 404, ErrorCode.NotFound);
            }
            return comment;
        }
        default: {
            throw new HttpError(ErrorMessage.InvalidResourceTypeError, 400, ErrorCode.InputError);
        }
    }
};

export const isResouceAComment = (resource: IPost | IComment): resource is IComment => {
    return (resource as IComment).resourceType != undefined;
};

export const getSourceActivityForResources = async (
    userId: string,
    resourceIds: Set<string>,
    resourceType: IResourceType
): Promise<{
    sourceReactions?: Record<string, IReaction>;
    sourceComments?: Record<string, Array<ICommentContent>>;
}> => {
    const postReactions = await DB_QUERIES.getReactionsByResourceIdsForSource(userId, resourceIds, resourceType);
    const sourceReactions: Record<string, IReaction> = transformReactionsListToResourceIdToReactionMap(postReactions);

    if (resourceType === 'comment') {
        return { sourceReactions, sourceComments: undefined };
    }

    const postComments = await DB_QUERIES.getCommentsByResourceIdsForSource(userId, resourceIds, resourceType, 5);
    const sourceComments: Record<string, Array<ICommentContent>> = transformCommentsListToResourceIdToCommentMap(
        postComments.documents as Array<IComment>
    );

    return { sourceReactions, sourceComments };
};
