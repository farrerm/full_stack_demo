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

The code for the actual Lambda itself is in a file called index.ts for each Lambda, e.g. cdk_nu/ec2_launcher/index.ts.

I will describe the flow.

The frontend code is in cdk_nu/frontend.  It includes a form that allows text and file submission.  It is running ReactJS.

<img width="1320" alt="Screen Shot 2024-07-07 at 10 52 52 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/5016dec7-6bc3-485c-bdab-564808d2de00">

The first problem was how to obtain AWS credentials the correct way.  For this, I used an API Gateway and a Lambda, presigned_urls/index.ts. When the frontend receives data it wants to write, the Lambda is invoked and a presigned url is returned.  This allows the frontend to write the file directly to S3.  As well, the file contents and S3 path are passed to the API Gateway, which invokes the Lambda write_to_db.  After this step, the file is written to S3 and the text and s3 file path are written to DynamoDB.

When the record is written to Dynamo, this triggers the ec2_launcher lambda.  The ec2 is provided with a script that works as follows:

1. The ec2 downloads a Python script that was previous loaded into S3.  This script is called s3_script.py.

2. Based on the script, a new modified version of the original file is written to S3, and a new entry is inserted into DynamoDB (also based on the original data).  To prevent an infinite regress of Lambdas, we add an additional item to the Table, which tells us whether the data was processed already or not.  Only unprocessed data will spin up the ec2.

3. Following these modified writes, we needed a way to terminate the ec2 automatically without using sleep().  The way we did this was with an additional DynamoDB table, which we called completionTable.  Upon a succesful write to the completionTable, a new Lambda is invoked, terminate_ec2.  This terminates the ec2.

Here are some more screenshots showing the flow of data:


<img width="1442" alt="Screen Shot 2024-07-07 at 11 42 35 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/52ef1600-2af6-45b7-b106-41b478f48f3b">

Shot of console showing successful write to S3 and DynamoDB.
<br><br>

<img width="1461" alt="Screen Shot 2024-07-07 at 11 43 07 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/748fef26-3e5f-4d6d-9ef5-26d480f862e9">

Sucessful write to DynamoDB of unprocessed data spins up a new ec2 instance.
<br><br>

<img width="1664" alt="Screen Shot 2024-07-07 at 11 32 00 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/c3159fb2-8b70-4a9a-8f23-77066fbb0c7a">

Here, on a previous submission, we paused ec2 termination so we could examine the ec2 logs.  In this case, we see evidence that the python script is downloaded from s3 and executed successfully.
<br><br>

<img width="1379" alt="Screen Shot 2024-07-07 at 11 44 58 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/36b86a9c-b70d-4508-8e10-af1373de4749">

Before executing, in S3 there was only s3_script.py.  After execution there are 2 additional entries as expected.
<br><br>

<img width="1309" alt="Screen Shot 2024-07-07 at 11 44 37 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/7c27da40-9dec-4b11-b97b-b099ac300929">

After execution, DynamoDB table fovus_table has 2 entries, as expected.
<br><br>

<img width="1491" alt="Screen Shot 2024-07-07 at 11 43 57 PM" src="https://github.com/farrerm/fovus_code_challenge/assets/23005392/bf973259-bc51-42ae-a47e-d8b2fb8cd413">

Following execution, ec2 instance writes data to DynamoDB Completion Table and is terminated by Lambda function.
<br><br>

For local installation and testing, keep in mind that certain values such as table names are hardcode, and would need to be replaced as appropriate.  This project was written to run on my own AWS infrastructure, and I have not tested its portability by running it on other infrastructure.

Nevertheless, I would generally describe project dependencies as follows:
cdk stack: node.js and TypeScript.
frontend: ReactJS
Lambda folders: node.js and TypeScript.  

For sources, I made extensive use of Google, Stack Overflow and AWS documentation.













