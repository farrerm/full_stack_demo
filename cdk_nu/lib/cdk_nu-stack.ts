import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkNuStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    const securityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'Security group for EC2 instance',
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access'
    );

    // Allow ICMP (ping)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      'Allow ICMP ping'
    );

    // Create S3 bucket
    const bucket = new s3.Bucket(this, 'nu_bucket', {
      bucketName: 'nuufovus', // Optional: Specify a unique name
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['http://localhost:3000'], // Replace with your frontend URL
          allowedHeaders: ['*'],
        },
      ],
    });

    // Create Lambda function
    const presignedUrlLambda = new NodejsFunction(this, 'PresignedUrlLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../presigned_urls/index.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        ALLOWED_ORIGIN: 'http://localhost:3000', // or your production frontend URL
      },
      //bundling: {
     //   minify: true,
     //   externalModules: ['aws-sdk'],
     // },
    });
    
    // Grant the Lambda function permission to generate presigned URLs
    bucket.grantReadWrite(presignedUrlLambda);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'PresignedUrlApi', {
      restApiName: 'Presigned URL Service',
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'], // Replace with your frontend URL
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
    });

    const presignedUrlIntegration = new apigateway.LambdaIntegration(presignedUrlLambda);

    api.root.addMethod('GET', presignedUrlIntegration, {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Headers': true,
        },
      }],
    });

    // Create DynamoDB table
    const fileTable = new dynamodb.Table(this, 'FileTable', {
      tableName: 'fovus_table',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOTE: Use with caution in production
    });
    // Add a GSI for efficient queries by filepath
    fileTable.addGlobalSecondaryIndex({
      indexName: 'filepathIndex',
      partitionKey: { name: 'filepath', type: dynamodb.AttributeType.STRING },
    });

    // Create DynamoDB table for completion signals
    const completionTable = new dynamodb.Table(this, 'CompletionTable', {
      partitionKey: { name: 'InstanceId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use with caution, only for non-production,
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Enable streams
    });

    // Create the new Lambda function for writing to DynamoDB
    const writeToDbLambda = new NodejsFunction(this, 'WriteToDbLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../write_to_db/index.ts'), // Adjust this path as needed
      environment: {
        TABLE_NAME: fileTable.tableName,
      },
    });

    // Grant the new Lambda function permission to write to DynamoDB
    fileTable.grantWriteData(writeToDbLambda);

    // Create a new resource and method for writing to DynamoDB
    const writeToDbResource = api.root.addResource('write_to_db');
    const writeToDbIntegration = new apigateway.LambdaIntegration(writeToDbLambda);

    writeToDbResource.addMethod('POST', writeToDbIntegration, {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
        },
      }],
    });

    // Create IAM role for EC2 instance 
    //const ec2Role = new iam.Role(this, 'EC2Role', {
   //   assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  //  });

  //  ec2Role.addToPolicy(new iam.PolicyStatement({
  //    actions: ['ec2:TerminateInstances', 'ec2:DescribeInstances'],
  //    resources: ['*'],
  //  }));// Grant EC2 instance permissions to write to DynamoDB
    const ec2Role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [completionTable.tableArn],
    }));// Create instance conprofile

    // Also add permissions to describe EC2 tags
    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ec2:DescribeTags', 
        'ec2:DescribeInstances',
        'ec2:DescribeInstanceAttribute',
        'ec2:DescribeLaunchTemplateVersions',  // Add this line
      ],
      resources: ['*'],
    }));

    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams'
      ],
      resources: ['arn:aws:logs:*:*:*'],
    }));

    // Add S3 read permissions to the role
    ec2Role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket',
        's3:PutObject'
      ],
      resources: [
        'arn:aws:s3:::nuufovus',
        'arn:aws:s3:::nuufovus/*'
      ],
    }));

    ec2Role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',// Include this if your script also needs to write to DynamoDB
        'dynamodb:UpdateItem',  // Include if needed
        'dynamodb:DeleteItem'  // Include if needed
      ],
      resources: ['arn:aws:dynamodb:*:*:table/fovus_table'],
    }));
    
    const instanceProfile = new iam.InstanceProfile(this, 'EC2InstanceProfile', {
      role: ec2Role,
    });

    const launchTemplate = new ec2.LaunchTemplate(this, 'EC2LaunchTemplate', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      role: ec2Role,
      keyName: 'instance_key', // Add this line
      securityGroup: securityGroup,
      userData: ec2.UserData.custom(`
        #!/bin/bash
        
        set -x

        exec > /var/log/user-data.log 2>&1

        echo "Starting user data script execution"

        # Set the AWS region
        export AWS_DEFAULT_REGION=us-east-1
        echo "AWS_DEFAULT_REGION set to $AWS_DEFAULT_REGION"# Install required packages

        sudo yum update -y
        sudo yum install -y python3 python3-pip
        pip3 install boto3

        # Download the script from S3
        aws s3 cp s3://nuufovus/s3_script.py ./s3_script.py

        # Execute the script
        python3 s3_script.py

        echo "Retrieving instance ID"
        INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
        echo "Instance ID: $INSTANCE_ID"

        echo "Retrieving Completion Table name from instance tags"
        COMPLETION_TABLE_NAME=$(aws ec2 describe-tags --filters "Name=resource-id,Values=$INSTANCE_ID" "Name=key,Values=CompletionTableName" --query "Tags[0].Value" --output text)
        echo "Completion Table name: $COMPLETION_TABLE_NAME"

        if [ -z "$COMPLETION_TABLE_NAME" ]; then
          echo "Error: CompletionTableName tag not found on the instance"
          exit 1
        fi

        echo "Writing to DynamoDB"
        aws dynamodb put-item \
          --table-name $COMPLETION_TABLE_NAME \
          --item '{"InstanceId": {"S": "'$INSTANCE_ID'"}}' \
          --region $AWS_DEFAULT_REGION

        # Log the result of the DynamoDB write
        if [ $? -eq 0 ]; then
          echo "Successfully wrote to Completion Table"
        else
          echo "Failed to write to Completion Table"
          echo "Error code: $?"
        fi

        echo "User data script completed"

      `),
    });

    // Ensure the launch template ID is available
    const launchTemplateId = launchTemplate.launchTemplateId;

    // Throw an error if the launch template ID is undefined
    if (!launchTemplateId) {
      throw new Error('Launch Template ID is undefined');
    }

    // 3. Create Lambda function to process DynamoDB events and launch EC2
    const ec2LauncherFunction = new NodejsFunction(this, 'EC2LauncherFunction', {
      entry: path.join(__dirname, '../ec2_launcher/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        LAUNCH_TEMPLATE_ID: launchTemplateId,
        INSTANCE_PROFILE_ARN: instanceProfile.instanceProfileArn,
        COMPLETION_TABLE_NAME: completionTable.tableName,
        SUBNET_ID: vpc.publicSubnets[0].subnetId, // Use a public subnet
      },
      //timeout: cdk.Duration.minutes(16),  // Set timeout to 16 minutes
    });

    // 4. Add DynamoDB Stream as event source for Lambda
    ec2LauncherFunction.addEventSource(new DynamoEventSource(fileTable, {
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // 5. Grant permissions to Lambda to launch EC2 instances
    ec2LauncherFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ec2:RunInstances',
        'ec2:CreateTags',
        'ec2:TerminateInstances',
          // Add this line'
        'iam:PassRole'
      ],
      resources: ['*'],
    }));

    // Create Lambda function to terminate EC2
    const ec2TerminatorFunction = new NodejsFunction(this, 'EC2TerminatorFunction', {
      entry: path.join(__dirname, '../terminate_ec2/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(3),
    });

    // Add DynamoDB Stream as event source for EC2 Terminator Lambda
    ec2TerminatorFunction.addEventSource(new DynamoEventSource(completionTable, {
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // Grant permissions to Lambda functions
    ec2TerminatorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:TerminateInstances'],
      resources: ['*'],
    }));
  
    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API URL',
    });

    new cdk.CfnOutput(this, 'WriteToDbLambdaName', {
      value: writeToDbLambda.functionName,
      description: 'Write To DB Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'ApiWriteToDbEndpoint', {
      value: `${api.url}write-to-db`,
      description: 'API Endpoint for Writing to DB',
    });

    // Output the table name
    new cdk.CfnOutput(this, 'TableName', { value: fileTable.tableName });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
      description: 'Security Group ID',
    });

  }
}
