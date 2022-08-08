import { ErrorCode, ErrorMessage } from '../../constants/errors';
import { IComment } from '../../models/comments';
import { IPost } from '../../models/posts';
import { IResourceType } from '../../models/reactions';
import { HttpError } from '../error';
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
