/**
 * Sends simple email using mailing microservice
 */
module.exports = exports = function definedSubjectAndSend(props, wait = false) {
  const {
    email, type, context, emailTemplate, nodemailer = {},
  } = props;
  const { config, mailer } = this;
  const { validation } = config;
  const { subjects, senders, email: mailingAccount } = validation;

  const mail = {
    ...nodemailer,
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
