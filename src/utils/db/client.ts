import mongoose from 'mongoose';
import dynamoose from 'dynamoose';
import ENV from '../../constants/env';

const initDynamoDB = () => {
    const DYNAMOOSE_CLIENT = new dynamoose.aws.sdk.DynamoDB({
        region: ENV.AWS.REGION,
        accessKeyId: ENV.AWS.KEY,
        secretAccessKey: ENV.AWS.SECRET,
    });
    dynamoose.aws.ddb.set(DYNAMOOSE_CLIENT);
};

const initMongoDB = async () => {
    const options = {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        keepAlive: true,
    };

    await mongoose.connect(ENV.MONGODB_URL, options);
};

export { initMongoDB, initDynamoDB };
