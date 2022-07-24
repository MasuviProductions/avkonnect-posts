import AWS from 'aws-sdk';
import ENV from '../../constants/env';

const SQS_QUEUE = new AWS.SQS({
    region: ENV.AWS.REGION,
    accessKeyId: ENV.AWS.KEY,
    secretAccessKey: ENV.AWS.SECRET,
});

export default SQS_QUEUE;
