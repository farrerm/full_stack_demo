Full stack React.js + AWS application.

Uses AWS Cloud Development Kit (CDK) to deploy all cloud resources.

Allows user to post text and file, then performs various backend actions.

To run the front end code on local host:

cd into cdk_nu/frontend/<br>
npm install<br>
npm run build<br>
npm start<br>



<img width="1320" alt="Screen Shot 2024-07-07 at 10 52 52 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/5016dec7-6bc3-485c-bdab-564808d2de00">

To deploy the backend code:<br>
from cdk_nu/<br>
cdk deploy<br>

CDK has several dependencies.  You can install the AWS CDK Toolkit globally using npm:<br>

npm install -g aws-cdk<br>

You will also need locally configured AWS credentials with permissions needed to perform the various backend operations.

The backend code proceeds as follows:

1. obtains presigned URL from Lambda with permission to write file directly to S3.<br>
2. writes file to S3.<br>
3. Writes S3 path and text input to DynamoDB.<br>
4. Spins up EC2 instance that downloads script from S3.  EC2 executes script.<br>
5. Script downloads file from S3 and writes modified contents to DynamoDB.<br>
6. EC2 is automatically terminated by Lambda after execution.

Here are some more screenshots showing the flow of data:


<img width="1442" alt="Screen Shot 2024-07-07 at 11 42 35 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/52ef1600-2af6-45b7-b106-41b478f48f3b">

Shot of console showing successful write to S3 and DynamoDB.
<br><br>

<img width="1461" alt="Screen Shot 2024-07-07 at 11 43 07 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/748fef26-3e5f-4d6d-9ef5-26d480f862e9">

Sucessful write to DynamoDB of unprocessed data spins up a new ec2 instance.
<br><br>

<img width="1664" alt="Screen Shot 2024-07-07 at 11 32 00 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/c3159fb2-8b70-4a9a-8f23-77066fbb0c7a">

Here, on a previous run, we paused ec2 termination so we could examine the ec2 logs.  In this case, we see evidence that the python script is downloaded from s3 and executed successfully.
<br><br>

<img width="1491" alt="Screen Shot 2024-07-07 at 11 43 57 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/bf973259-bc51-42ae-a47e-d8b2fb8cd413">

Following execution, ec2 instance writes data to DynamoDB Completion Table and is terminated by Lambda function.
<br><br>














