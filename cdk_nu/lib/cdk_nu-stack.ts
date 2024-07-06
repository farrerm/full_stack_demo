import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkNuStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // Create S3 bucket
    const bucket = new s3.Bucket(this, 'nu_bucket', {
      bucketName: 'nuufovus', // Optional: Specify a unique name
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
