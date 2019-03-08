'use strict';

const alexaVerifier = require('alexa-verifier');
const AssistantV1 = require('watson-developer-cloud/assistant/v1');
const openwhisk = require('openwhisk');

function errorResponse(reason) {
  return {
	version: '1.0',
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: 'PlainText',
        text: reason || 'An unexpected error occurred. Please try again later.'
      }
    }
  };
}

// Using some globals for now
let assistant;

function verifyFromAlexa(args, rawBody) {
  return new Promise(function(resolve, reject) {
    const certUrl = args.__ow_headers.signaturecertchainurl;
    const signature = args.__ow_headers.signature;
    alexaVerifier(certUrl, signature, rawBody, function(err) {
      if (err) {
        console.error('err? ' + JSON.stringify(err));
        throw new Error('Alexa verification failed.');
      }
      resolve();
    });
  });
}

function initClients(args) {
  // Connect a client to Watson Assistant
  if (args.ASSISTANT_IAM_APIKEY) {
    assistant = new AssistantV1({
      version: '2018-02-16',
      iam_apikey: args.ASSISTANT_IAM_APIKEY,
      url: args.ASSISTANT_IAM_URL
    });
  } else if (args.ASSISTANT_USERNAME) {
    assistant = new AssistantV1({
      version: '2018-02-16',
      username: args.ASSISTANT_USERNAME,
      password: args.ASSISTANT_PASSWORD
    });
  } else {
    console.error('err? ' + 'Invalid Credentials');
    throw new Error('Invalid Credentials');
  }

  console.log('Connected to Watson Assistant');
}

function assistantMessage(request, workspaceId) {
  return new Promise(function(resolve, reject) {
    const input = request.intent ? request.intent.slots.EverythingSlot.value : 'start skill';
    console.log('WORKSPACE_ID: ' + workspaceId);
    console.log('Input text: ' + input);

    assistant.message(
      {
        input: { text: input },
        workspace_id: workspaceId
      },
      function(err, watsonResponse) {
        if (err) {
          console.error(err);
          reject('Error talking to Watson.');
        } else {
          console.log(watsonResponse);
          resolve(watsonResponse);
        }
      }
    );
  });
}

function sendResponse(response, resolve) {
  console.log('Begin sendResponse');
  console.log(response);

  // Get text from JSON Watson response
  const output = response.output.text.join(' ');
  console.log('Output text: ' + output);

  // Resolve the main promise now that we have our response
  resolve({
    version: '1.0',
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: 'PlainText',
        text: output
      }
    }
  });
}

function main(args) {
  console.log('Begin action');
  console.log(args);
  return new Promise(function(resolve, reject) {
	if (!args.__ow_body) {
      return reject(errorResponse('Must be called from Alexa.'));
    }

    const rawBody = Buffer.from(args.__ow_body, 'base64').toString('ascii');
    const body = JSON.parse(rawBody);
	console.log(body);
    const request = body.request;

    verifyFromAlexa(args, rawBody)
      .then(() => initClients(args))
      .then(() => assistantMessage(request, args.WORKSPACE_ID))
      .then(watsonResponse => sendResponse(watsonResponse, resolve))
      .catch(err => {
        console.error('Caught error: ');
        console.log(err);
        reject(errorResponse(err));
      });
  });
}

exports.main = main;