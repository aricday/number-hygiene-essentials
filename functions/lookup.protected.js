const PASS_LINE_STATUSES = ['active', 'reachable', 'unknown'];
const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  function respond(statusCode, body) {
    response.setStatusCode(statusCode);
    response.setBody(body);
    return callback(null, response);
  }

  const { phoneNumber, lastVerifiedDate } = event;

  if (!phoneNumber || !PHONE_REGEX.test(phoneNumber)) {
    return respond(400, { decision: 'REMOVE', reason: 'Invalid', error: 'Invalid or missing phone number' });
  }

  const client = context.getTwilioClient();

  try {
    // Stage 1: Line Type Intelligence
    let result;
    try {
      result = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({
        fields: 'line_type_intelligence'
      });
    } catch (err) {
      if (err.status === 404 || err.code === 20404) {
        return respond(200, { decision: 'REMOVE', reason: 'Invalid', lineType: null });
      }
      throw err;
    }

    const lineType = result.lineTypeIntelligence?.type;
    if (lineType !== 'mobile') {
      return respond(200, { decision: 'REMOVE', reason: 'Non-Mobile', lineType: lineType ?? 'unknown' });
    }

    // Stage 2: Line Status
    result = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({
      fields: 'line_status'
    });

    const lineStatus = result.lineStatus?.status;
    if (!PASS_LINE_STATUSES.includes(lineStatus)) {
      return respond(200, {
        decision: 'REMOVE',
        reason: 'Inactive',
        lineType: 'mobile',
        lineStatus: lineStatus ?? 'unknown'
      });
    }

    // Stage 3: Reassigned Number
    const fetchOpts = { fields: 'reassigned_number' };
    if (lastVerifiedDate) {
      fetchOpts.lastVerifiedDate = lastVerifiedDate;
    }

    result = await client.lookups.v2.phoneNumbers(phoneNumber).fetch(fetchOpts);

    // Note: nested object keys are NOT deep-camelCased by the SDK
    const isReassigned = result.reassignedNumber?.is_number_reassigned;
    if (isReassigned === true) {
      return respond(200, {
        decision: 'REMOVE',
        reason: 'Reassigned',
        lineType: 'mobile',
        lineStatus,
        reassigned: true
      });
    }

    return respond(200, {
      decision: 'APPROVE',
      reason: 'Passed all checks',
      lineType: 'mobile',
      lineStatus,
      reassigned: false
    });

  } catch (err) {
    console.error('Lookup error:', err.message, err.code);
    return respond(500, { decision: 'REMOVE', reason: 'Error', error: err.message });
  }
};
