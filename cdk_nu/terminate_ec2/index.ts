import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { EC2Client, TerminateInstancesCommand } from '@aws-sdk/client-ec2';

const ec2Client = new EC2Client({});

export const handler = async (event: DynamoDBStreamEvent, context: Context): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const instanceId = record.dynamodb?.NewImage?.InstanceId?.S;
      
      if (instanceId) {
        try {
          const terminateCommand = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
          await ec2Client.send(terminateCommand);
          console.log('Terminated EC2 instance:', instanceId);
        } catch (error) {
          console.error('Error terminating EC2 instance:', error);
          throw error;
        }
      }
    }
  }
};
