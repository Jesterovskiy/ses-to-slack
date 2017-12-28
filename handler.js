'use strict';

const IncomingWebhook = require('@slack/client').IncomingWebhook;
const AWS = require('aws-sdk');
const s3 = new AWS.S3({'accessKeyId': process.env.aws_key_id, 'secretAccessKey': process.env.aws_secret_key});

const slackHookUrl = process.env.slack_hook_url;
const bucketName   = process.env.bucket_name;

module.exports.handler = (event, context, callback) => {
  let message = event.Records[0].ses.mail;

  s3.getObject({
    Bucket: bucketName,
    Key: message.messageId
  }, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      callback(err);
    } else {
      if (message.commonHeaders.from[0].includes('alerts@tracelyticsmail.com')) {
        handleReceived(message.commonHeaders.subject, data.Body, callback);
      } else {
        callback(`Unknown email sender: ${message.from[0]}`);
      }
    };
  });
};

function handleReceived(subject, message, callback) {
  const emailArray = String(message).split('\n');
  const appIndex = emailArray.findIndex(item => item === 'App:\r');
  let slackMessage;

  if (appIndex !== -1) {
    slackMessage = `${subject}\n Application: ${emailArray[appIndex + 2].replace(/\*\*/g, '')} Value: ${emailArray[appIndex + 10].replace(/\*\*/g, '')}`;
  } else {
    slackMessage = `${subject}. Additional info is not available - check email template.`;
  };

  const webhook = new IncomingWebhook(slackHookUrl);
  webhook.send(slackMessage, function(err, header, statusCode) {
    if (err) {
      console.log('Error posting message to Slack API:', err);
    } else {
      console.log('Message posted successfully', statusCode);
    }
  });
  callback(null, null);
}
