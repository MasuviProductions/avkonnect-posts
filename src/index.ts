import { fastify } from 'fastify';
import fastifyCors from '@fastify/cors';
import initializeV1Routes from './api/v1/routes';
import { initMongoDB, initDynamoDB } from './utils/db/client';

const APP = fastify({
    logger: true,
});

APP.register(fastifyCors);

initDynamoDB();
initMongoDB();

initializeV1Routes(APP);

export { APP };
export default APP;
