import { UUID_REGEX_STRING } from '../constants/app';
import { IComment } from '../models/comments';
import { IPost } from '../models/posts';
import { SOURCE_TYPES, SourceType } from '../models/shared';

const getSourceMarkupsFromText = (text: string): string[] => {
    const markupRegex = new RegExp(`@(${SOURCE_TYPES.join('|')})_` + UUID_REGEX_STRING, 'g');
    return text.match(markupRegex) || [];
};

export const getSourceMarkupsFromPostOrComment = (post: IPost | IComment): string[] => {
    const sourceMarkups: string[] = [];
    post.contents.forEach((content) => {
        const extractedMarkups = getSourceMarkupsFromText(content.text);
        extractedMarkups.forEach((markup) => {
            sourceMarkups.push(markup);
        });
    });
    return sourceMarkups;
};

export const getSourceIdsFromSourceMarkups = (sourceType: SourceType, sourceMarkups: string[]) => {
    const sourceIds: string[] = [];
    sourceMarkups.forEach((markup) => {
        if (markup.indexOf(sourceType)) {
            const [, userId] = markup.split(`@${sourceType}_`);
            sourceIds.push(userId);
        }
    });
    return Array.from(new Set(sourceIds));
};
