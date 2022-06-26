import { fastify } from 'fastify';
import initializeV1Routes from './api/v1/routes';
import { initMongoDB, initDynamoDB } from './utils/db/client';

const APP = fastify({
    logger: true,
});

initDynamoDB();
initMongoDB();

initializeV1Routes(APP);

export { APP };
export default APP;
