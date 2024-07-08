At the time of submission, all code is working correctly and satisfies project requirements 100 percent.

Since I am short on time, I will focus on providing a verbal description of the project, and the design decisions I made.

All code is under the master folder cdk_nu.

Here is how the folders are structured:

Cloud Development Kit (CDK) was used for management of all AWS resources.

cdk_nu/lib/cdk_nu-stack.ts includes the high level declaration for all AWS resources.

Frontend code has its own folder, cdk_nu/frontend/.  It is a ReactJS project that I ran locally in my browser via localhost.

Each Lambda has its own folder with a descriptive name.  They are:

cdk_nu/ec2_launcher

cdk_nu/presigned_urls

cdk_nu/terminate_ec2

cdk_nu/write_to_db

The code for the actual Lambda itself is in a file called index.ts for each Lambda, i.e. cdk_nu/ec2_launcher/index.ts.

I will describe the flow.

The frontend code is in cdk_nu/frontend.  It includes form that allows text and file submission.  It is running ReactJS.

<img width="1320" alt="Screen Shot 2024-07-07 at 10 52 52 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/5016dec7-6bc3-485c-bdab-564808d2de00">

The first problem was how to obtain AWS credentials the correct way.  For this, I used an API Gateway and a Lambda, presigned_urls/index.ts. When the frontend receives data it wants to write, the Lambda is invoked and a presigned url is returned.  This allows the frontend to write the file directly to S3.  As well, the file contents and S3 path are passed to the API Gateway, which invokes the Lambda write_to_db.  After this step, the file is written to S3 and the text is written to DynamoDB.

When the record is written to Dynamo, this triggers the ec2_launcher lambda.  The ec2 is provided with a script that works as follows:

1. The ec2 downloads a Python script that was previous loaded into S3.  This script is called S3_script.py.

2. Based on the script, a new modified version of the original file is written to S3, and a new entry is inserted into DynamoDB (also based on the original data).  To prevent an infinite regress of Lambdas, we add an additional item to the Table, which tells us whether the data was processed already or not.  Only unprocessed data will spin up the ec2.

3. Following these modified writes, we needed a way to terminate the ec2 automatically without using sleep().  The way we did this was with an additional DynamoDB table, which we called completionTable.  Upon a succesful write to the completionTable, a new Lambda is invoked, terminate_ec2.  This terminates the ec2.

I will try and provide screenshots, time permitting.

For local installation, I am not sure of the steps.  You would need to install various aws libraries.  You would need to install reources for the front end.  The Lambdas all use TypeScript.  Each one is structured as its own TypeScript project.  

For sources, I made extensive use of Google, Stack Overflow and AWS documentation.













