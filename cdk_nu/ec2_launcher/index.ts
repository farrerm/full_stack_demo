import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { EC2Client, RunInstancesCommand, RunInstancesCommandInput, TagSpecification } from '@aws-sdk/client-ec2';

const ec2Client = new EC2Client({});

export const handler = async (event: DynamoDBStreamEvent, context: Context): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      console.log('New item inserted in DynamoDB');
      
      try {
        const tagSpecifications: TagSpecification[] = [
          {
            ResourceType: 'instance',
            Tags: [
              {
                Key: 'CompletionTableName',
                Value: process.env.COMPLETION_TABLE_NAME || '',
              },
            ],
          },
        ];

        const params: RunInstancesCommandInput = {
          LaunchTemplate: {
            LaunchTemplateId: process.env.LAUNCH_TEMPLATE_ID,
            Version: '$Latest'
          },
          MinCount: 1,
          MaxCount: 1,
          SubnetId: process.env.SUBNET_ID, // Add this line
          IamInstanceProfile: {
            Arn: process.env.INSTANCE_PROFILE_ARN,
          },
          TagSpecifications: tagSpecifications,
        };
        
        const command = new RunInstancesCommand(params);
        const response = await ec2Client.send(command);
        const instanceId = response.Instances?.[0].InstanceId;
        console.log('Launched EC2 instance:', instanceId);

      } 
      catch (error) {
        console.error('Error launching EC2 instance:', error);
        throw error;
      }
    }
  }
};
