import ENV from './env';

export const TABLE = {
    POSTS: `avk-${ENV.DEPLOYMENT_ENV}-posts`,
    ACTIVITIES: `avk-${ENV.DEPLOYMENT_ENV}-activities`,
    REACTIONS: `avk-${ENV.DEPLOYMENT_ENV}-reactions`,
    COMMENTS: `avk-${ENV.DEPLOYMENT_ENV}-comments`,
};
