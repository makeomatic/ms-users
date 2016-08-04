/**
 * Sends simple email using mailing microservice
 */
module.exports = exports = function definedSubjectAndSend({ email, type, context, emailTemplate }, wait = false) {
  const { config, mailer } = this;
  const { validation } = config;
  const { subjects, senders, email: mailingAccount } = validation;

  const mail = {
    subject: subjects[type] || '',
    from: senders[type] || 'noreply <support@example.com>',
    to: email,
    html: emailTemplate,
  };

  const mailSent = mailer
    .send(mailingAccount, mail)
    .return({ sent: true, context })
    .catch(err => ({
      context,
      err,
      sent: false,
    }));

  if (wait) {
    return mailSent;
  }

  return {
    queued: true,
    context,
  };
};
