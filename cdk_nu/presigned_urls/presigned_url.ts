import { APIGatewayProxyHandler } from 'aws-lambda';
//import { S3 } from 'aws-sdk';
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  const fileName = event.queryStringParameters?.fileName;
  const fileType = event.queryStringParameters?.fileType;

  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'fileName and fileType are required query parameters' }),
    };
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: fileType,
    Expires: 300, // URL expires in 5 minutes
  };

  try {
    //const signedUrl = await s3.getSignedUrlPromise('putObject', params);
    const command = new PutObjectCommand({ Bucket: "your-bucket", Key: "your-key" });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Update this for production
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ signedUrl }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate presigned URL' }),
    };
  }
};
