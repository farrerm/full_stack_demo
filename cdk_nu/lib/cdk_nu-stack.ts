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

    const launchTemplate = new ec2.LaunchTemplate(this, 'EC2LaunchTemplate', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      userData: ec2.UserData.custom(`
        #!/bin/bash
        echo "Running your script here"
        # Add your script commands here
      `),
    });

    // Ensure the launch template ID is available
    const launchTemplateId = launchTemplate.launchTemplateId;

    // Throw an error if the launch template ID is undefined
    if (!launchTemplateId) {
      throw new Error('Launch Template ID is undefined');
    }


    // 3. Create Lambda function to process DynamoDB events and launch EC2
    const ec2LauncherFunction = new lambda.Function(this, 'EC2LauncherFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/ec2-launcher'),
      environment: {
        LAUNCH_TEMPLATE_ID: launchTemplate.launchTemplateId,
      },
    });

    // 4. Add DynamoDB Stream as event source for Lambda
    ec2LauncherFunction.addEventSource(new DynamoEventSource(fileTable, {
      startingPosition: lambda.StartingPosition.LATEST,
    }));

    // 5. Grant permissions to Lambda to launch EC2 instances
    ec2LauncherFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:RunInstances'],
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

  }
}
