import ENV from './env';

export const TABLE = {
    POSTS: `avk-${ENV.DEPLOYMENT_ENV}-posts2`, //this is to test the post schema so that we can have data consistency
    ACTIVITIES: `avk-${ENV.DEPLOYMENT_ENV}-activities`,
    REACTIONS: `avk-${ENV.DEPLOYMENT_ENV}-reactions`,
    COMMENTS: `avk-${ENV.DEPLOYMENT_ENV}-comments`,
};
