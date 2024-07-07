import { APIGatewayProxyHandler } from 'aws-lambda';
//import { S3 } from 'aws-sdk';
import { S3Client } from "@aws-sdk/client-s3";
//import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

export const handler: APIGatewayProxyHandler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  
  const fileName = event.queryStringParameters?.fileName;
  const fileType = event.queryStringParameters?.fileType;

  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Restrict this in production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'fileName and fileType are required query parameters' }),
    };
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    ContentType: fileType,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // URL expires in 5 minutes
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Update this for production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ signedUrl }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin, // Restrict this in production
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ error: 'Failed to generate presigned URL' }),
    };
  }
};
